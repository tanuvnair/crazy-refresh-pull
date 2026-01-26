import { APIEvent } from "@solidjs/start/server";
import { getVideoById, extractVideoIdFromUrl } from "~/services/youtube.server";
import { addPositiveFeedback } from "~/services/feedback.server";

export async function POST(event: APIEvent) {
  try {
    const contentType = event.request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({
          error: "Content-Type must be application/json",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await event.request.json();
    const { url, apiKey } = body;

    if (!url || !apiKey) {
      return new Response(
        JSON.stringify({
          error: "URL and API key are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract video ID from URL
    const videoId = extractVideoIdFromUrl(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({
          error: "Invalid YouTube URL or video ID",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch video details
    const video = await getVideoById(videoId, apiKey);
    if (!video) {
      return new Response(
        JSON.stringify({
          error: "Video not found or is a Short (videos must be longer than 60 seconds)",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add to positive feedback with metadata
    await addPositiveFeedback(videoId, {
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      url: video.url,
    });

    return new Response(
      JSON.stringify({
        success: true,
        video,
        message: "Video added to favorites successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: "Failed to add video",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
