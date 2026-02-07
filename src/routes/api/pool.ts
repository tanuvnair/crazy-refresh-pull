import { APIEvent } from "@solidjs/start/server";
import { getPoolStatus, addToPool } from "~/services/video-pool.server";
import { searchYouTubeVideos } from "~/services/youtube.server";
import type { Video } from "~/components/video-card";

/**
 * GET: Return pool status (count, updatedAt).
 */
export async function GET(_event: APIEvent) {
  try {
    const status = await getPoolStatus();
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to get pool status", message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

const MAX_PAGES_PER_QUERY = 5;
const MAX_QUERIES = 10;

/**
 * POST: Seed the video pool by fetching videos from YouTube for the given queries.
 * Body: { apiKey: string, queries: string[], maxPagesPerQuery?: number }
 * Cost: ~101 units per page (search.list 100 + videos.list 1). Default 2 pages per query = 202 units per query.
 */
export async function POST(event: APIEvent) {
  try {
    const contentType = event.request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const body = (await event.request.json()) as {
      apiKey?: string;
      queries?: string[];
      maxPagesPerQuery?: number;
    };
    const apiKey = body.apiKey?.trim();
    const rawQueries = body.queries;
    const maxPagesPerQuery = Math.min(
      MAX_PAGES_PER_QUERY,
      Math.max(1, body.maxPagesPerQuery ?? 2)
    );

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "apiKey is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!Array.isArray(rawQueries) || rawQueries.length === 0) {
      return new Response(
        JSON.stringify({ error: "queries must be a non-empty array of strings" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const queries = rawQueries
      .filter((q) => typeof q === "string" && q.trim().length > 0)
      .map((q) => (q as string).trim())
      .slice(0, MAX_QUERIES);

    if (queries.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one non-empty query is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const allVideos: Video[] = [];
    let totalPagesUsed = 0;

    for (const query of queries) {
      let nextPageToken: string | undefined = undefined;
      let pagesFetched = 0;
      while (pagesFetched < maxPagesPerQuery) {
        const result = await searchYouTubeVideos(
          query,
          apiKey,
          50,
          50,
          nextPageToken,
          60
        );
        allVideos.push(...result.videos);
        nextPageToken = result.nextPageToken;
        pagesFetched++;
        totalPagesUsed++;
        if (!nextPageToken) break;
      }
    }

    const { added, total } = await addToPool(allVideos);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched ${allVideos.length} video(s) in ${totalPagesUsed} API page(s) (~${totalPagesUsed * 101} units). Pool now has ${total} videos (${added} new).`,
        pagesUsed: totalPagesUsed,
        videosFetched: allVideos.length,
        poolTotal: total,
        poolAdded: added,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Failed to seed pool",
        message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
