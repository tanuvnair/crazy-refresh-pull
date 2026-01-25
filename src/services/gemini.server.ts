import type { Video } from "~/components/video-card";

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export interface VideoAnalysisResult {
  videoId: string;
  isAuthentic: boolean;
  reasoning?: string;
}

/**
 * Default prompt for analyzing content authenticity
 */
const DEFAULT_ANALYSIS_PROMPT = `You are an expert at identifying authentic, high-quality YouTube content versus "slop" or manufactured content.

"Slop" typically includes:
- Clickbait titles with excessive capitalization, emojis, or misleading claims
- Low-effort content designed only for algorithm engagement
- Manufactured drama or fake reactions
- Content farms producing repetitive, low-value videos
- Overly optimized thumbnails and titles that don't match content quality
- Channels that prioritize quantity over quality

Authentic content typically includes:
- Genuine, well-researched information
- Original perspectives and thoughtful analysis
- Content creators who value quality over virality
- Educational or informative content with substance
- Personal experiences or expertise shared authentically

For each video, analyze the title, description, and channel name. Respond with a JSON array where each object has:
- "videoId": the video ID
- "isAuthentic": boolean (true if authentic, false if slop)
- "reasoning": brief explanation (1-2 sentences)

Return ONLY valid JSON, no markdown, no code blocks.`;

/**
 * Analyze videos using Gemini AI to determine if they are authentic or "slop"
 */
export async function analyzeVideosWithGemini(
  videos: Video[],
  apiKey: string,
  customPrompt?: string
): Promise<VideoAnalysisResult[]> {
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }

  if (!videos || videos.length === 0) {
    throw new Error("Videos array is required");
  }

  const prompt = customPrompt || DEFAULT_ANALYSIS_PROMPT;

  // Prepare video data for analysis
  const videoData = videos.map((video) => ({
    id: video.id,
    title: video.title,
    description: video.description.substring(0, 500), // Limit description length
    channelTitle: video.channelTitle,
  }));

  const analysisPrompt = `${prompt}

Videos to analyze:
${JSON.stringify(videoData, null, 2)}

Respond with a JSON array of analysis results.`;

  // Call Gemini API
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: analysisPrompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data: GeminiResponse = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API");
  }

  const responseText = data.candidates[0].content.parts[0].text;

  // Parse the JSON response (Gemini might wrap it in markdown or add extra text)
  let analysisResults: VideoAnalysisResult[] = [];
  try {
    // Try to extract JSON from the response (in case it's wrapped in markdown)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      analysisResults = JSON.parse(jsonMatch[0]);
    } else {
      analysisResults = JSON.parse(responseText);
    }
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", responseText);
    // Fallback: if parsing fails, mark all as authentic to avoid filtering everything
    analysisResults = videos.map((video) => ({
      videoId: video.id,
      isAuthentic: true,
      reasoning: "Analysis failed, defaulting to authentic",
    }));
  }

  // Ensure we have results for all videos
  const resultsMap = new Map<string, VideoAnalysisResult>();
  for (const result of analysisResults) {
    if (result.videoId) {
      resultsMap.set(result.videoId, result);
    }
  }

  // Fill in missing videos (default to authentic if not analyzed)
  for (const video of videos) {
    if (!resultsMap.has(video.id)) {
      resultsMap.set(video.id, {
        videoId: video.id,
        isAuthentic: true,
        reasoning: "Not analyzed by Gemini",
      });
    }
  }

  return Array.from(resultsMap.values());
}

/**
 * Filter videos based on Gemini analysis results
 */
export function filterVideosByAnalysis(
  videos: Video[],
  analysisResults: VideoAnalysisResult[]
): Video[] {
  const analysisMap = new Map<string, VideoAnalysisResult>();
  for (const result of analysisResults) {
    if (result.videoId) {
      analysisMap.set(result.videoId, result);
    }
  }

  return videos.filter((video) => {
    const analysis = analysisMap.get(video.id);
    return analysis?.isAuthentic !== false; // Include if authentic or not analyzed
  });
}
