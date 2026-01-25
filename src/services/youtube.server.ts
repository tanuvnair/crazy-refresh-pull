import type { Video } from "~/components/video-card";

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
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults: number = 50,
  initialFetchCount: number = 300
): Promise<Video[]> {
  const YOUTUBE_API_MAX_PER_REQUEST = 50;
  const allVideos: Video[] = [];
  let nextPageToken: string | undefined = undefined;
  let totalFetched = 0;
  const maxFetchAttempts = initialFetchCount; // Maximum videos to fetch from API
  
  // Fetch multiple pages if needed to get enough videos after filtering
  // Continue until we have enough videos OR we've fetched the max OR no more pages
  while (allVideos.length < maxResults && totalFetched < maxFetchAttempts) {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", YOUTUBE_API_MAX_PER_REQUEST.toString());
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("key", apiKey);
    
    if (nextPageToken) {
      searchUrl.searchParams.set("pageToken", nextPageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      let error = "Unknown error";
      try {
        const contentType = searchResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await searchResponse.json();
          error = errorData.error?.message || JSON.stringify(errorData);
        } else {
          error = await searchResponse.text();
        }
      } catch {
        error = `HTTP ${searchResponse.status}: ${searchResponse.statusText}`;
      }
      throw new Error(`YouTube API error: ${error}`);
    }

    let searchData: YouTubeSearchResponse;
    try {
      const contentType = searchResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      searchData = await searchResponse.json();
    } catch (parseError) {
      throw new Error(`Failed to parse YouTube API response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`);
    }

    // Update pagination token
    nextPageToken = searchData.nextPageToken;
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
        console.warn("Failed to parse video details response, using empty data:", parseError);
        detailsData = { items: [] };
      }
    }

    // Create maps for efficient lookup
    const statsMap = new Map<string, { viewCount?: string; likeCount?: string }>();
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
      const title = item.snippet.title;
      const description = item.snippet.description;
      const channelTitle = item.snippet.channelTitle;

      // Filter out Shorts (videos shorter than 60 seconds)
      // Content quality filtering is handled by Gemini AI if enabled
      if (duration === undefined || duration < 60) {
        continue;
      }

      const stats = statsMap.get(videoId) || {};
      allVideos.push({
        id: videoId,
        title,
        description,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
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

    // Stop if no more pages available
    if (!nextPageToken) {
      break;
    }
  }

  return allVideos;
}

export interface SearchVideosOptions {
  query: string;
  youtubeApiKey: string;
  maxResults?: number;
  geminiApiKey?: string;
  useGeminiFiltering?: boolean;
  customGeminiPrompt?: string;
}

export interface SearchVideosResult {
  videos: Video[];
}

/**
 * Handle YouTube search API request
 * Parses query parameters, validates inputs, and returns formatted response
 */
export async function handleYouTubeSearchRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);
    const apiKey = url.searchParams.get("apiKey") || process.env.YOUTUBE_API_KEY || "";
    const geminiApiKey = url.searchParams.get("geminiApiKey") || undefined;
    const useGeminiFiltering = url.searchParams.get("useGeminiFiltering") === "true";

    const result = await searchVideosWithFiltering({
      query,
      youtubeApiKey: apiKey,
      maxResults,
      geminiApiKey,
      useGeminiFiltering,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const statusCode = errorMessage.includes("required") ? 400 : 500;

    return new Response(
      JSON.stringify({
        error: "Failed to fetch YouTube videos",
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Search YouTube videos with optional Gemini AI filtering
 * This is the main business logic function that orchestrates the entire search flow
 */
export async function searchVideosWithFiltering(
  options: SearchVideosOptions
): Promise<SearchVideosResult> {
  const { query, youtubeApiKey, maxResults = 50, geminiApiKey, useGeminiFiltering, customGeminiPrompt } = options;

  // Validate inputs
  if (!query || query.trim().length === 0) {
    throw new Error("Query parameter is required");
  }

  if (!youtubeApiKey || youtubeApiKey.trim().length === 0) {
    throw new Error("YouTube API key is required");
  }

  if (useGeminiFiltering && (!geminiApiKey || geminiApiKey.trim().length === 0)) {
    throw new Error("Gemini API key is required when Gemini filtering is enabled");
  }

  // Search and filter videos using YouTube service
  // Fetch more videos initially (300) to account for filtering, then return maxResults
  let videos = await searchYouTubeVideos(query, youtubeApiKey, maxResults, 300);

  // Filter out videos that are already in feedback (repeats)
  try {
    const { getPositiveFeedback, getNegativeFeedback } = await import("./feedback.server");
    const positiveFeedback = await getPositiveFeedback();
    const negativeFeedback = await getNegativeFeedback();
    const allFeedbackIds = new Set([...positiveFeedback, ...negativeFeedback]);
    
    const videosBeforeRepeatFiltering = videos.length;
    videos = videos.filter((video) => !allFeedbackIds.has(video.id));
    const repeatFilteredCount = videosBeforeRepeatFiltering - videos.length;
    
    if (repeatFilteredCount > 0) {
      console.log(`Repeat filtering: ${repeatFilteredCount} video(s) filtered out (already in feedback)`);
    }
  } catch (feedbackError) {
    console.warn("Failed to load feedback for repeat filtering:", feedbackError);
    // Continue without repeat filtering if it fails
  }

  // Apply Gemini AI filtering if enabled
  if (useGeminiFiltering && geminiApiKey && videos.length > 0) {
    try {
      const videosBeforeFiltering = videos.length;
      const { analyzeVideosWithGemini, filterVideosByAnalysis } = await import("./gemini.server");
      const analysisResults = await analyzeVideosWithGemini(videos, geminiApiKey, customGeminiPrompt);
      videos = filterVideosByAnalysis(videos, analysisResults);
      const videosAfterFiltering = videos.length;
      const filteredCount = videosBeforeFiltering - videosAfterFiltering;
      
      if (filteredCount > 0) {
        console.log(`AI filtering applied: ${filteredCount} video(s) filtered out (${videosBeforeFiltering} → ${videosAfterFiltering})`);
      } else {
        console.log(`AI filtering applied: All ${videosBeforeFiltering} video(s) passed the authenticity check`);
      }
    } catch (geminiError) {
      console.error("Failed to analyze videos with Gemini:", geminiError);
      // If Gemini fails, use the videos we already have (graceful degradation)
    }
  }

  // Limit final results
  videos = videos.slice(0, maxResults);

  return { videos };
}
