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

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
  displayName?: string;
}

interface ListModelsResponse {
  models?: GeminiModel[];
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
 * List available Gemini models for the given API key
 */
export async function listAvailableModels(apiKey: string): Promise<GeminiModel[]> {
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }

  // Try both v1 and v1beta
  const apiVersions = ["v1", "v1beta"];
  
  for (const version of apiVersions) {
    try {
      const listUrl = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
      const response = await fetch(listUrl);
      
      if (response.ok) {
        try {
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Response is not JSON");
          }
          const data: ListModelsResponse = await response.json();
          if (data.models && data.models.length > 0) {
            console.log(`Found ${data.models.length} models in ${version}:`, 
              data.models.map(m => ({ name: m.name, methods: m.supportedGenerationMethods })));
            return data.models;
          }
        } catch (parseError) {
          console.warn(`Failed to parse models response from ${version}:`, parseError);
        }
      }
    } catch (error) {
      console.warn(`Failed to list models from ${version}:`, error);
    }
  }
  
  throw new Error("Failed to list available models from any API version");
}

/**
 * Get an available model that supports generateContent
 */
async function getAvailableModel(apiKey: string): Promise<string> {
  const models = await listAvailableModels(apiKey);
  
  // Prefer models that support generateContent
  const generateContentModels = models.filter(
    (model) => model.supportedGenerationMethods?.includes("generateContent")
  );
  
  if (generateContentModels.length > 0) {
    // Prefer flash models (faster, cheaper) over pro models
    // Sort to prefer newer versions (2.5 > 2.0) and non-lite versions
    const flashModels = generateContentModels.filter((m) => 
      m.name.includes("flash") && !m.name.includes("preview")
    );
    
    if (flashModels.length > 0) {
      // Sort: prefer higher version numbers, prefer non-lite
      flashModels.sort((a, b) => {
        const aVersion = parseFloat(a.name.match(/gemini-(\d+\.\d+)/)?.[1] || "0");
        const bVersion = parseFloat(b.name.match(/gemini-(\d+\.\d+)/)?.[1] || "0");
        if (bVersion !== aVersion) {
          return bVersion - aVersion; // Higher version first
        }
        // If same version, prefer non-lite
        if (a.name.includes("lite") && !b.name.includes("lite")) return 1;
        if (!a.name.includes("lite") && b.name.includes("lite")) return -1;
        return 0;
      });
      return flashModels[0].name;
    }
    
    // Fallback to any flash model
    const anyFlashModel = generateContentModels.find((m) => m.name.includes("flash"));
    if (anyFlashModel) {
      return anyFlashModel.name;
    }
    
    // Use the first available model
    return generateContentModels[0].name;
  }
  
  throw new Error("No models found that support generateContent");
}

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

  // Load feedback data to enhance the prompt
  let feedbackContext = "";
  try {
    const { getFeedbackSummary } = await import("./feedback.server");
    const feedback = await getFeedbackSummary();
    
    if (feedback.positiveCount > 0 || feedback.negativeCount > 0) {
      feedbackContext = `\n\nLEARNING FROM USER FEEDBACK:\n`;
      feedbackContext += `The user has provided feedback on ${feedback.positiveCount} positive examples and ${feedback.negativeCount} negative examples.\n`;
      
      if (feedback.positiveExamples.length > 0) {
        feedbackContext += `\nPositive feedback video IDs (examples of authentic content the user liked):\n`;
        feedbackContext += feedback.positiveExamples.map((id) => `- ${id}`).join("\n");
        feedbackContext += `\nUse these as reference for what the user considers authentic and valuable content.\n`;
      }
      
      if (feedback.negativeExamples.length > 0) {
        feedbackContext += `\nNegative feedback video IDs (examples of content the user disliked):\n`;
        feedbackContext += feedback.negativeExamples.map((id) => `- ${id}`).join("\n");
        feedbackContext += `\nUse these as reference for what the user considers low-quality or "slop" content.\n`;
      }
      
      feedbackContext += `\nWhen analyzing videos, consider patterns from these feedback examples to better match the user's preferences.\n`;
    }
  } catch (error) {
    console.warn("Failed to load feedback data for AI learning:", error);
    // Continue without feedback if it fails
  }

  const prompt = customPrompt || DEFAULT_ANALYSIS_PROMPT;

  // Prepare video data for analysis
  const videoData = videos.map((video) => ({
    id: video.id,
    title: video.title,
    description: video.description.substring(0, 500), // Limit description length
    channelTitle: video.channelTitle,
  }));

  const analysisPrompt = `${prompt}${feedbackContext}

Videos to analyze:
${JSON.stringify(videoData, null, 2)}

Respond with a JSON array of analysis results.`;

  // Get an available model that supports generateContent
  const modelName = await getAvailableModel(apiKey);
  console.log(`Using model: ${modelName}`);
  
  // Extract just the model name (remove "models/" prefix if present)
  const cleanModelName = modelName.replace(/^models\//, "");
  
  // Try both API versions - v1beta first as it has more models
  const apiVersions = ["v1beta", "v1"];
  const maxRetries = 3;
  let response: Response | null = null;
  let lastError: Error | null = null;

  // Try each API version
  for (const version of apiVersions) {
    const geminiUrl = `https://generativelanguage.googleapis.com/${version}/models/${cleanModelName}:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await fetch(geminiUrl, {
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
          const errorText = await response.text();
          let errorData: { error?: { code?: number; message?: string; details?: Array<{ "@type"?: string; retryDelay?: string }> } } = {};
          
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // If parsing fails, use the raw text
          }

          // If 404, try next API version
          if (response.status === 404) {
            console.log(`Model not found in ${version}, trying next API version...`);
            lastError = new Error(`Model not found in ${version}: ${errorText}`);
            break; // Break out of retry loop, try next version
          }

          // Check if it's a rate limit error (429) and has retry info
          if (response.status === 429 && errorData.error?.details) {
            const retryInfo = errorData.error.details.find(
              (detail) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
            );
            
            if (retryInfo?.retryDelay && attempt < maxRetries - 1) {
              const delaySeconds = parseFloat(retryInfo.retryDelay.replace("s", "")) || Math.pow(2, attempt) * 2;
              const delayMs = Math.min(delaySeconds * 1000, 60000); // Cap at 60 seconds
              
              console.log(`Rate limit hit, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              continue;
            }
          }

          // For other errors, throw immediately (don't retry)
          throw new Error(`Gemini API error: ${errorText}`);
        }

        // Success - break out of both loops
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If it's a 404, try next API version
        if (error instanceof Error && error.message.includes("404")) {
          break; // Try next API version
        }
        
        // If it's a 429 and we have retries left, continue
        if (error instanceof Error && error.message.includes("429") && attempt < maxRetries - 1) {
          continue;
        }
        
        // For other errors or last attempt, try next API version or throw
        if (version === apiVersions[apiVersions.length - 1] && attempt === maxRetries - 1) {
          throw lastError;
        }
        break; // Try next API version
      }
    }
    
    // If we got a successful response, break out of version loop
    if (response && response.ok) {
      break;
    }
  }

  if (!response || !response.ok) {
    if (lastError) {
      throw lastError;
    }
    throw new Error("Failed to get response from Gemini API");
  }

  let data: GeminiResponse;
  try {
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    data = await response.json();
  } catch (parseError) {
    throw new Error(`Failed to parse Gemini API response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`);
  }

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
 * Made less strict: only filter out videos that are explicitly marked as not authentic
 * Videos with unclear analysis or missing data are included
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
    // Only filter if explicitly marked as NOT authentic (isAuthentic === false)
    // Include if: authentic (true), not analyzed (undefined), or missing analysis
    // This makes filtering less strict - only clear slop is filtered
    if (analysis === undefined) {
      return true; // Include if not analyzed
    }
    // Only exclude if explicitly false - be lenient with borderline cases
    return analysis.isAuthentic !== false;
  });
}

interface AnalyzeVideosRequest {
  videos: Video[];
  apiKey: string;
  customPrompt?: string;
}

/**
 * Handle list Gemini models API request
 * Validates API key and returns formatted response
 */
export async function handleListGeminiModelsRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get("apiKey");
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "API key is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const models = await listAvailableModels(apiKey);
    
    return new Response(
      JSON.stringify({
        models: models.map((m) => ({
          name: m.name,
          displayName: m.displayName,
          supportedMethods: m.supportedGenerationMethods,
        })),
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
        error: "Failed to list Gemini models",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Handle analyze videos API request
 * Validates request body and returns formatted response
 */
export async function handleAnalyzeVideosRequest(request: Request): Promise<Response> {
  try {
    let body;
    try {
      const contentType = request.headers.get("content-type");
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
      body = await request.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
          message: parseError instanceof Error ? parseError.message : "Failed to parse JSON",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const requestData = body as AnalyzeVideosRequest;
    
    if (!requestData.videos || !Array.isArray(requestData.videos)) {
      return new Response(
        JSON.stringify({
          error: "Videos array is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!requestData.apiKey) {
      return new Response(
        JSON.stringify({
          error: "API key is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await analyzeVideosWithGemini(
      requestData.videos,
      requestData.apiKey,
      requestData.customPrompt
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
