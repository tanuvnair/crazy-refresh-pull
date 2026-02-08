import { APIEvent } from "@solidjs/start/server";
import { log } from "~/lib/logger";
import { handleYouTubeSearchRequest } from "~/services/youtube.server";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const query = url.searchParams.get("q") ?? "";
  try {
    const response = await handleYouTubeSearchRequest(event.request);
    if (response.ok) {
      log.info("youtube GET: search completed", { query: query.slice(0, 60) });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("youtube GET: failed", { query: query.slice(0, 60), message });
    throw error;
  }
}
