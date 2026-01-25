import { APIEvent } from "@solidjs/start/server";
import { searchVideosWithFiltering } from "~/services/youtube.server";

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const query = url.searchParams.get("q");
    const maxResults = parseInt(url.searchParams.get("maxResults") || "10", 10);
    const apiKey = url.searchParams.get("apiKey") || process.env.YOUTUBE_API_KEY;
    const geminiApiKey = url.searchParams.get("geminiApiKey");
    const useGeminiFiltering = url.searchParams.get("useGeminiFiltering") === "true";

    const result = await searchVideosWithFiltering({
      query: query || "",
      youtubeApiKey: apiKey || "",
      maxResults,
      geminiApiKey: geminiApiKey || undefined,
      useGeminiFiltering,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const statusCode = errorMessage.includes("required") ? 400 : 500;

    return new Response(
      JSON.stringify({
        error: "Failed to fetch YouTube videos",
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
