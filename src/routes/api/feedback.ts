import { APIEvent } from "@solidjs/start/server";
import { log } from "~/lib/logger";
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
      log.warn("feedback POST: invalid content type");
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
      log.warn("feedback POST: missing action or videoId");
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
        log.warn("feedback POST: invalid action", { action });
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
    log.info("feedback POST: updated", { action, videoId, status });

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
    log.error("feedback POST: failed", { message: errorMessage });

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
        log.warn("feedback GET: empty videoIds");
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
      log.info("feedback GET: batch", { count: videoIds.length });
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
      log.warn("feedback GET: missing videoId");
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
    log.error("feedback GET: failed", { message: errorMessage });

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
