import type { Video } from "~/components/video-card";
import { decodeHtmlEntities } from "~/lib/html-entities";
import { applyFiltersAndRank } from "./apply-filters-rank.server";

interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        medium: { url: string; width: number; height: number };
        high: { url: string; width: number; height: number };
      };
      channelTitle: string;
      publishedAt: string;
    };
  }>;
  nextPageToken?: string;
}

interface YouTubeVideoDetailsResponse {
  items: Array<{
    id: string;
    statistics?: {
      viewCount: string;
      likeCount: string;
    };
    contentDetails?: {
      duration: string;
    };
  }>;
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Search YouTube videos with pagination support
 * @param maxResults - Maximum number of videos to return after filtering
 * @param initialFetchCount - Target number of videos to fetch from YouTube API (before filtering)
 * @param pageToken - Optional page token for pagination
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults: number = 50,
  initialFetchCount: number = 300,
  pageToken?: string,
  minVideoDurationSeconds: number = 60,
): Promise<{ videos: Video[]; nextPageToken?: string }> {
  const YOUTUBE_API_MAX_PER_REQUEST = 50;
  const allVideos: Video[] = [];
  let currentPageToken: string | undefined = pageToken;
  let totalFetched = 0;
  const maxFetchAttempts = initialFetchCount; // Maximum videos to fetch from API

  // Fetch a single page or multiple pages if needed
  // If pageToken is provided, fetch only one page. Otherwise, fetch until we have enough.
  const fetchSinglePage = pageToken !== undefined;

  while (allVideos.length < maxResults && totalFetched < maxFetchAttempts) {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set(
      "maxResults",
      YOUTUBE_API_MAX_PER_REQUEST.toString(),
    );
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("key", apiKey);

    if (currentPageToken) {
      searchUrl.searchParams.set("pageToken", currentPageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      let error = "Unknown error";
      try {
        const contentType = searchResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await searchResponse.json();
          // Extract the actual error message from YouTube API response
          if (errorData.error) {
            error =
              errorData.error.message ||
              errorData.error.errors?.[0]?.message ||
              JSON.stringify(errorData.error);
          } else {
            error = JSON.stringify(errorData);
          }
        } else {
          error = await searchResponse.text();
        }
      } catch {
        error = `HTTP ${searchResponse.status}: ${searchResponse.statusText}`;
      }

      // Provide more user-friendly error messages for common cases
      let userFriendlyError = error;
      if (
        error.includes("API key not valid") ||
        error.includes("Invalid API key") ||
        error.includes("keyInvalid")
      ) {
        userFriendlyError =
          "Invalid YouTube API key. Please check your API key and try again.";
      } else if (
        error.includes("quota") ||
        error.includes("quotaExceeded") ||
        error.includes("dailyLimitExceeded")
      ) {
        userFriendlyError =
          "YouTube API quota exceeded. The daily quota for your API key has been reached. Please try again tomorrow or upgrade your quota in the Google Cloud Console.";
      } else if (error.includes("403") || error.includes("Forbidden")) {
        userFriendlyError =
          "Access denied. Please check your YouTube API key permissions and ensure the YouTube Data API v3 is enabled.";
      } else if (error.includes("400") || error.includes("Bad Request")) {
        userFriendlyError = `Invalid request: ${error}`;
      } else if (error.includes("401") || error.includes("Unauthorized")) {
        userFriendlyError =
          "Unauthorized. Please verify your YouTube API key is correct.";
      } else if (
        error.includes("blocked") ||
        error.includes("V3DataSearchService.List")
      ) {
        userFriendlyError =
          "YouTube Search API is blocked for this key. In Google Cloud Console: (1) Enable 'YouTube Data API v3' for your project, (2) Under API key restrictions, allow 'YouTube Data API v3' or use an unrestricted key for testing.";
      }

      throw new Error(userFriendlyError);
    }

    let searchData: YouTubeSearchResponse;
    try {
      const contentType = searchResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      searchData = await searchResponse.json();
    } catch (parseError) {
      throw new Error(
        `Failed to parse YouTube API response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }

    // Update pagination token
    currentPageToken = searchData.nextPageToken;
    totalFetched += searchData.items.length;

    // Get video IDs to fetch statistics and content details
    const videoIds = searchData.items.map((item) => item.id.videoId);

    // Fetch statistics and content details
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "statistics,contentDetails");
    detailsUrl.searchParams.set("id", videoIds.join(","));
    detailsUrl.searchParams.set("key", apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    let detailsData: YouTubeVideoDetailsResponse = { items: [] };

    if (detailsResponse.ok) {
      try {
        const contentType = detailsResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          detailsData = await detailsResponse.json();
        }
      } catch (parseError) {
        console.warn(
          "Failed to parse video details response, using empty data:",
          parseError,
        );
        detailsData = { items: [] };
      }
    }

    // Create maps for efficient lookup
    const statsMap = new Map<
      string,
      { viewCount?: string; likeCount?: string }
    >();
    const durationMap = new Map<string, number>();

    if (detailsData.items) {
      for (const item of detailsData.items) {
        if (item.id) {
          if (item.statistics) {
            statsMap.set(item.id, item.statistics);
          }
          if (item.contentDetails?.duration) {
            const durationSeconds = parseDuration(item.contentDetails.duration);
            durationMap.set(item.id, durationSeconds);
          }
        }
      }
    }

    // Process this page's results with filtering
    for (const item of searchData.items) {
      const videoId = item.id.videoId;
      const duration = durationMap.get(videoId);
      const title = decodeHtmlEntities(item.snippet.title);
      const description = decodeHtmlEntities(item.snippet.description);
      const channelTitle = decodeHtmlEntities(item.snippet.channelTitle);

      // Filter out Shorts (videos shorter than configured minimum duration)
      // Content quality filtering is handled by custom AI filter if enabled
      if (duration === undefined || duration < minVideoDurationSeconds) {
        continue;
      }

      const stats = statsMap.get(videoId) || {};
      allVideos.push({
        id: videoId,
        title,
        description,
        thumbnail:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium.url,
        channelTitle,
        publishedAt: item.snippet.publishedAt,
        viewCount: stats.viewCount,
        likeCount: stats.likeCount,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });

      // Stop if we have enough videos
      if (allVideos.length >= maxResults) {
        break;
      }
    }

    // Stop if no more pages available or if we're only fetching a single page
    if (!currentPageToken || fetchSinglePage) {
      break;
    }
  }

  return { videos: allVideos, nextPageToken: currentPageToken };
}

/**
 * Fetch video details by video ID
 */
export async function getVideoById(
  videoId: string,
  apiKey: string,
): Promise<Video | null> {
  try {
    // Fetch video details
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    detailsUrl.searchParams.set("id", videoId);
    detailsUrl.searchParams.set("key", apiKey);

    const response = await fetch(detailsUrl.toString());
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }

    const item = data.items[0];
    const duration = item.contentDetails?.duration
      ? parseDuration(item.contentDetails.duration)
      : undefined;

    // Filter out Shorts (default 60 seconds, but this function doesn't have access to settings)
    // This is used for adding favorites, so we'll use a reasonable default
    if (duration !== undefined && duration < 60) {
      return null;
    }

    return {
      id: item.id,
      title: decodeHtmlEntities(item.snippet.title),
      description: decodeHtmlEntities(item.snippet.description),
      thumbnail:
        item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
      channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
      publishedAt: item.snippet.publishedAt,
      viewCount: item.statistics?.viewCount,
      likeCount: item.statistics?.likeCount,
      url: `https://www.youtube.com/watch?v=${item.id}`,
    };
  } catch (error) {
    console.error("Failed to fetch video by ID:", error);
    return null;
  }
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle different YouTube URL formats
    if (urlObj.hostname.includes("youtube.com")) {
      return urlObj.searchParams.get("v");
    } else if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1);
    }

    // If it's already just an ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
      return url.trim();
    }

    return null;
  } catch {
    // If URL parsing fails, try to extract ID directly
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    return match ? match[1] : null;
  }
}

export interface SearchVideosOptions {
  query: string;
  youtubeApiKey: string;
  maxResults?: number;
  maxPagesToSearch?: number;
  maxTotalVideosToFetch?: number;
  minVideoDurationSeconds?: number;
  /** If true (default), search the local video pool first and only call the API when needed. */
  usePoolFirst?: boolean;
}

export interface SearchVideosResult {
  videos: Video[];
  poolOnly?: boolean;
}

/**
 * Handle YouTube search API request
 * Parses query parameters, validates inputs, and returns formatted response
 */
export async function handleYouTubeSearchRequest(
  request: Request,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);
    const apiKey =
      url.searchParams.get("apiKey") || process.env.YOUTUBE_API_KEY || "";
    // YouTube API quota limits: 10,000 units/day, ~101 units per page (100 for search + 1 for videos.list)
    let maxPagesToSearch = parseInt(
      url.searchParams.get("maxPagesToSearch") || "20",
      10,
    );
    let maxTotalVideosToFetch = parseInt(
      url.searchParams.get("maxTotalVideosToFetch") || "1000",
      10,
    );
    const minVideoDurationSeconds = parseInt(
      url.searchParams.get("minVideoDurationSeconds") || "60",
      10,
    );
    const usePoolFirst = url.searchParams.get("usePoolFirst") !== "false";

    // Enforce YouTube API quota limits
    // Max ~99 pages per day (10,000 units / 101 units per page), use 95 as safe limit
    maxPagesToSearch = Math.min(maxPagesToSearch, 95);
    // Max ~4,750 videos per day (95 pages * 50 videos per page)
    maxTotalVideosToFetch = Math.min(maxTotalVideosToFetch, 4750);

    const result = await searchVideosWithFiltering({
      query,
      youtubeApiKey: apiKey,
      maxResults,
      maxPagesToSearch,
      maxTotalVideosToFetch,
      minVideoDurationSeconds,
      usePoolFirst,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const statusCode =
      errorMessage.includes("required") || errorMessage.includes("API key")
        ? 400
        : 500;

    // Log the full error for debugging
    console.error("YouTube search error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to fetch YouTube videos",
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Search YouTube videos. When usePoolFirst is true, searches the local video pool first (no API cost); falls back to API only when needed.
 * Ranking uses the learned recommendation model when available.
 */
export async function searchVideosWithFiltering(
  options: SearchVideosOptions,
): Promise<SearchVideosResult> {
  const {
    query,
    youtubeApiKey,
    maxResults = 50,
    maxPagesToSearch = 20,
    maxTotalVideosToFetch = 1000,
    minVideoDurationSeconds = 60,
    usePoolFirst = true,
  } = options;

  if (!query || query.trim().length === 0) {
    throw new Error("Query parameter is required");
  }

  const hasApiKey = Boolean(youtubeApiKey && youtubeApiKey.trim().length > 0);
  const POOL_SEARCH_LIMIT = Math.max(maxResults * 5, 200);

  if (!hasApiKey) {
    try {
      const { readPool, searchPool } = await import("./video-pool.server");
      const pool = await readPool();
      if (pool.videos.length > 0) {
        const candidates = await searchPool(pool, query, POOL_SEARCH_LIMIT);
        if (candidates.length > 0) {
          const filtered = await applyFiltersAndRank(candidates, maxResults);
          console.log(
            `Pool-only search: ${filtered.length} video(s) from pool (${pool.videos.length} total).`,
          );
          return { videos: filtered, poolOnly: true };
        }
      }
      return { videos: [], poolOnly: true };
    } catch (poolErr) {
      console.warn("Pool-only search failed:", poolErr);
      return { videos: [], poolOnly: true };
    }
  }

  if (usePoolFirst) {
    try {
      const { readPool, searchPool } = await import("./video-pool.server");
      const pool = await readPool();
      if (pool.videos.length > 0) {
        const candidates = await searchPool(pool, query, POOL_SEARCH_LIMIT);
        if (candidates.length > 0) {
          const filtered = await applyFiltersAndRank(candidates, maxResults);
          if (filtered.length > 0) {
            console.log(
              `Served ${filtered.length} video(s) from pool (no API calls). Pool size: ${pool.videos.length}`,
            );
            return { videos: filtered };
          }
        }
      }
    } catch (poolErr) {
      console.warn("Pool search failed, falling back to API:", poolErr);
    }
  }

  const MAX_TOTAL_FETCH = maxTotalVideosToFetch;
  const VIDEOS_PER_PAGE = 50;
  let allFetchedVideos: Video[] = [];
  let nextPageToken: string | undefined = undefined;
  let totalFetched = 0;
  let pageCount = 0;
  const MAX_PAGES = maxPagesToSearch;

  while (
    allFetchedVideos.length < maxResults &&
    totalFetched < MAX_TOTAL_FETCH &&
    pageCount < MAX_PAGES
  ) {
    pageCount++;

    // Fetch a single page of videos
    const pageResult = await searchYouTubeVideos(
      query,
      youtubeApiKey,
      VIDEOS_PER_PAGE,
      VIDEOS_PER_PAGE,
      nextPageToken,
      minVideoDurationSeconds,
    );
    const pageVideos = pageResult.videos;
    nextPageToken = pageResult.nextPageToken;

    if (pageVideos.length === 0) {
      // No more videos available
      break;
    }

    totalFetched += pageVideos.length;

    // Filter out videos that are already in feedback (repeats)
    let filteredPageVideos = pageVideos;
    try {
      const { getPositiveFeedback, getNegativeFeedback } =
        await import("./feedback.server");
      const positiveFeedback = await getPositiveFeedback();
      const negativeFeedback = await getNegativeFeedback();
      const allFeedbackIds = new Set([
        ...positiveFeedback,
        ...negativeFeedback,
      ]);

      filteredPageVideos = pageVideos.filter(
        (video) => !allFeedbackIds.has(video.id),
      );
    } catch (feedbackError) {
      console.warn(
        "Failed to load feedback for repeat filtering:",
        feedbackError,
      );
      // Continue without repeat filtering if it fails
    }

    // Add filtered videos to our collection
    allFetchedVideos.push(...filteredPageVideos);

    // Check if we have enough results now
    if (allFetchedVideos.length >= maxResults) {
      break;
    }

    // If no more pages available, stop
    if (!nextPageToken) {
      break;
    }
  }

  if (allFetchedVideos.length > 0) {
    try {
      const { addToPool } = await import("./video-pool.server");
      const { added, total } = await addToPool(allFetchedVideos);
      if (added > 0) {
        console.log(
          `Pool updated: +${added} new videos (total ${total}). Future searches can use them without API calls.`,
        );
      }
    } catch (poolErr) {
      console.warn("Failed to update pool:", poolErr);
    }
  }

  let videos = allFetchedVideos.slice(0, maxResults);

  try {
    const { isModelAvailable, scoreVideo } =
      await import("./recommendation-model.server");
    if (await isModelAvailable()) {
      const scored = await Promise.all(
        videos.map(async (video) => ({
          video,
          score: (await scoreVideo(video)) ?? 0.5,
        })),
      );
      scored.sort((a, b) => b.score - a.score);
      videos = scored.map((s) => s.video);
    }
  } catch (recommendationError) {
    console.warn("Recommendation model ranking skipped:", recommendationError);
  }

  if (videos.length === 0 && totalFetched > 0) {
    console.log(
      `Searched through ${totalFetched} videos across ${pageCount} page(s) but found no authentic videos after filtering`,
    );
  } else if (videos.length > 0) {
    console.log(
      `Found ${videos.length} authentic video(s) after searching through ${totalFetched} videos across ${pageCount} page(s)`,
    );
  }

  return { videos };
}
