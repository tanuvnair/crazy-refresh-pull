import { APIEvent } from "@solidjs/start/server";
import { getRandomRecommendations } from "~/services/video-pool.server";

/**
 * GET /api/feed
 * Returns random authentic videos from the pool (no YouTube API calls).
 * API key is optional; when omitted, poolOnly is true in the response.
 * Query params: limit (default 20), useCustomFiltering, authenticityThreshold, apiKey (optional).
 */
export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const limit = Math.min(
      Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
      100,
    );
    const apiKey = (url.searchParams.get("apiKey") || "").trim();
    const useCustomFiltering =
      url.searchParams.get("useCustomFiltering") !== "false";
    const authenticityThreshold = parseFloat(
      url.searchParams.get("authenticityThreshold") || "0.4",
    );

    const videos = await getRandomRecommendations(limit, {
      useCustomFiltering,
      authenticityThreshold,
    });

    const poolOnly = !apiKey;
    const body: { videos: typeof videos; empty?: boolean; poolOnly?: boolean } =
      {
        videos,
        poolOnly,
      };
    if (videos.length === 0) {
      body.empty = true;
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to load feed", message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
