import { APIEvent } from "@solidjs/start/server";
import { handleYouTubeSearchRequest } from "~/services/youtube.server";

export async function GET(event: APIEvent) {
  return handleYouTubeSearchRequest(event.request);
}
