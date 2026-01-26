import { APIEvent } from "@solidjs/start/server";
import {
  addPositiveFeedback,
  addNegativeFeedback,
  removeFeedback,
  getVideoFeedbackStatus,
  getBatchVideoFeedbackStatus,
} from "~/services/feedback.server";
import type { VideoMetadata } from "~/services/feedback.server";

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
    const { action, videoId, metadata } = body;

    if (!action || !videoId) {
      return new Response(
        JSON.stringify({
          error: "Action and videoId are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Prepare metadata if provided
    const videoMetadata: Partial<VideoMetadata> | undefined = metadata
      ? {
          id: videoId,
          title: metadata.title,
          description: metadata.description,
          channelTitle: metadata.channelTitle,
          publishedAt: metadata.publishedAt,
          viewCount: metadata.viewCount,
          likeCount: metadata.likeCount,
          url: metadata.url,
        }
      : undefined;

    switch (action) {
      case "like":
        await addPositiveFeedback(videoId, videoMetadata);
        break;
      case "dislike":
        await addNegativeFeedback(videoId, videoMetadata);
        break;
      case "remove":
        await removeFeedback(videoId);
        break;
      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action. Must be 'like', 'dislike', or 'remove'",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
    }

    const status = await getVideoFeedbackStatus(videoId);

    return new Response(
      JSON.stringify({
        success: true,
        status,
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
        error: "Failed to update feedback",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const videoId = url.searchParams.get("videoId");
    const videoIdsParam = url.searchParams.get("videoIds");

    // Support batch requests
    if (videoIdsParam) {
      const videoIds = videoIdsParam.split(",").filter((id) => id.trim().length > 0);
      if (videoIds.length === 0) {
        return new Response(
          JSON.stringify({
            error: "At least one video ID is required",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const statusMap = await getBatchVideoFeedbackStatus(videoIds);
      const statusObject: Record<string, "positive" | "negative" | null> = {};
      for (const [id, status] of statusMap.entries()) {
        statusObject[id] = status;
      }

      return new Response(
        JSON.stringify({
          statuses: statusObject,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Single video request
    if (!videoId) {
      return new Response(
        JSON.stringify({
          error: "Video ID is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const status = await getVideoFeedbackStatus(videoId);

    return new Response(
      JSON.stringify({
        status,
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
        error: "Failed to get feedback status",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
