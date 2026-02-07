import type { Video } from "~/components/video-card";

/**
 * Apply feedback exclusion, custom filtering, and recommendation ranking to a list of videos.
 * Shared by feed, pool search, and YouTube API path.
 */
export async function applyFiltersAndRank(
  videos: Video[],
  maxResults: number,
  useCustomFiltering: boolean,
  authenticityThreshold: number,
): Promise<Video[]> {
  let out = videos;
  try {
    const { getPositiveFeedback, getNegativeFeedback } =
      await import("./feedback.server");
    const positiveFeedback = await getPositiveFeedback();
    const negativeFeedback = await getNegativeFeedback();
    const allFeedbackIds = new Set([...positiveFeedback, ...negativeFeedback]);
    out = out.filter((video) => !allFeedbackIds.has(video.id));
  } catch {
    // Continue without feedback filter
  }
  if (useCustomFiltering && out.length > 0) {
    try {
      const { analyzeVideos, filterVideosByAnalysis } =
        await import("./filter.server");
      const analysisResults = await analyzeVideos(out, authenticityThreshold);
      out = await filterVideosByAnalysis(
        out,
        analysisResults,
        authenticityThreshold,
      );
    } catch {
      // Keep current list
    }
  }
  out = out.slice(0, maxResults);
  try {
    const { isModelAvailable, scoreVideo } =
      await import("./recommendation-model.server");
    if (await isModelAvailable()) {
      const scored = await Promise.all(
        out.map(async (video) => ({
          video,
          score: (await scoreVideo(video)) ?? 0.5,
        })),
      );
      scored.sort((a, b) => b.score - a.score);
      out = scored.map((s) => s.video);
    }
  } catch {
    // Keep order
  }
  return out;
}
