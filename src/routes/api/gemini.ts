import { APIEvent } from "@solidjs/start/server";
import { handleListGeminiModelsRequest, handleAnalyzeVideosRequest } from "~/services/gemini.server";

export async function GET(event: APIEvent) {
  return handleListGeminiModelsRequest(event.request);
}

export async function POST(event: APIEvent) {
  return handleAnalyzeVideosRequest(event.request);
}
