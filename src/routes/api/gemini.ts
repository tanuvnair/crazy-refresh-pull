import { APIEvent } from "@solidjs/start/server";
import { analyzeVideosWithGemini } from "~/services/gemini.server";

export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const result = await analyzeVideosWithGemini(
      body.videos,
      body.apiKey,
      body.customPrompt
    );

    return new Response(
      JSON.stringify({
        results: result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const statusCode = errorMessage.includes("required") ? 400 : 500;

    return new Response(
      JSON.stringify({
        error: "Failed to analyze videos with Gemini",
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
