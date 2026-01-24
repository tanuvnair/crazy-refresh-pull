import { APIEvent } from "@solidjs/start/server";

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
    statistics?: {
      viewCount: string;
      likeCount: string;
    };
  }>;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  likeCount?: string;
  url: string;
}

// Helper function to parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Filter out SLOP/manufactured content
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

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const query = url.searchParams.get("q");
  const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);
  const apiKey = url.searchParams.get("apiKey") || process.env.YOUTUBE_API_KEY;

  if (!query) {
    return new Response(
      JSON.stringify({ error: "Query parameter 'q' is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "YouTube API key is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // First, search for videos based on the query
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", maxResults.toString());
    searchUrl.searchParams.set("order", "relevance");
    searchUrl.searchParams.set("key", apiKey);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`YouTube API error: ${error}`);
    }

    const searchData: YouTubeSearchResponse = await searchResponse.json();

    // Get video IDs to fetch statistics and content details (for duration)
    const videoIds = searchData.items.map((item) => item.id.videoId);

    // Fetch statistics and content details for the videos
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "statistics,contentDetails");
    detailsUrl.searchParams.set("id", videoIds.join(","));
    detailsUrl.searchParams.set("key", apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = detailsResponse.ok ? await detailsResponse.json() : { items: [] };

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
    const videos: YouTubeVideo[] = [];
    
    for (const item of searchData.items) {
      const videoId = item.id.videoId;
      const duration = durationMap.get(videoId);
      const title = item.snippet.title;
      const description = item.snippet.description;
      const channelTitle = item.snippet.channelTitle;

      // Filter out Shorts (videos shorter than 60 seconds)
      // Only include videos where we have duration info and it's at least 60 seconds
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

    return new Response(JSON.stringify({ videos }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("YouTube API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch YouTube videos",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
