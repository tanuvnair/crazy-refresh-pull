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
 * Filter out SLOP/manufactured content using heuristics
 */
function isAuthenticContent(title: string, description: string, channelTitle: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const lowerChannel = channelTitle.toLowerCase();

  // Filter out Shorts indicators
  if (lowerTitle.includes("#shorts") || lowerDesc.includes("#shorts")) {
    return false;
  }

  // Filter out excessive emojis (more than 3 in title)
  const emojiCount = (title.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 3) {
    return false;
  }

  // Filter out clickbait patterns
  const clickbaitPatterns = [
    /\b(you won't believe|shocked|this will blow your mind|number \d+ will shock you)\b/i,
    /\b(click here|watch until the end|subscribe now|like and subscribe)\b/i,
    /^(\d+|\d+th|\d+st|\d+nd|\d+rd)\s+(ways?|reasons?|things?|secrets?|tricks?)/i,
    /\b(guaranteed|instant|free|limited time|act now)\b/i,
  ];

  for (const pattern of clickbaitPatterns) {
    if (pattern.test(title)) {
      return false;
    }
  }

  // Filter out channels with suspicious patterns
  const suspiciousChannelPatterns = [
    /\b(compilation|viral|trending|shorts|reels)\b/i,
  ];

  for (const pattern of suspiciousChannelPatterns) {
    if (pattern.test(lowerChannel) && lowerChannel.length < 20) {
      return false;
    }
  }

  // Filter out titles that are too short (likely low effort)
  if (title.length < 10) {
    return false;
  }

  // Filter out titles that are ALL CAPS (often clickbait)
  if (title === title.toUpperCase() && title.length > 20) {
    return false;
  }

  return true;
}

/**
 * Search YouTube videos
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults: number = 50
): Promise<Video[]> {
  // Search for videos
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", maxResults.toString());
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("key", apiKey);

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

  // Combine search results with filtering
  const videos: Video[] = [];

  for (const item of searchData.items) {
    const videoId = item.id.videoId;
    const duration = durationMap.get(videoId);
    const title = item.snippet.title;
    const description = item.snippet.description;
    const channelTitle = item.snippet.channelTitle;

    // Filter out Shorts (videos shorter than 60 seconds)
    if (duration === undefined || duration < 60) {
      continue;
    }

    // Filter out SLOP/manufactured content
    if (!isAuthenticContent(title, description, channelTitle)) {
      continue;
    }

    const stats = statsMap.get(videoId) || {};
    videos.push({
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

    // Limit to maxResults after filtering
    if (videos.length >= maxResults) {
      break;
    }
  }

  return videos;
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
  let videos = await searchYouTubeVideos(query, youtubeApiKey, maxResults);

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
