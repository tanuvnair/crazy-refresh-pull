import * as feedbackRepo from "~/db-repositories/feedback";
import type { FeedbackRow } from "~/db-repositories/feedback";

export interface VideoMetadata {
  id: string;
  title?: string;
  description?: string;
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: string;
  likeCount?: string;
  url?: string;
}

function rowToMetadata(row: FeedbackRow): VideoMetadata {
  return {
    id: row.id,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    channelTitle: row.channel_title ?? undefined,
    publishedAt: row.published_at ?? undefined,
    viewCount: row.view_count ?? undefined,
    likeCount: row.like_count ?? undefined,
    url: row.url ?? undefined,
  };
}

function rowsToMetadataMap(rows: FeedbackRow[]): Map<string, VideoMetadata> {
  const map = new Map<string, VideoMetadata>();
  for (const row of rows) {
    map.set(row.id, rowToMetadata(row));
  }
  return map;
}

// ---------- writes ----------

/**
 * Add a video with metadata to positive feedback.
 * Removes it from negative if present (upsert replaces the row).
 */
export async function addPositiveFeedback(videoId: string, metadata?: Partial<VideoMetadata>): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }
  await feedbackRepo.upsert({
    id: videoId.trim(),
    sentiment: "positive",
    title: metadata?.title,
    description: metadata?.description,
    channelTitle: metadata?.channelTitle,
    publishedAt: metadata?.publishedAt,
    viewCount: metadata?.viewCount,
    likeCount: metadata?.likeCount,
    url: metadata?.url,
  });
}

/**
 * Add a video with metadata to negative feedback.
 * Removes it from positive if present (upsert replaces the row).
 */
export async function addNegativeFeedback(videoId: string, metadata?: Partial<VideoMetadata>): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }
  await feedbackRepo.upsert({
    id: videoId.trim(),
    sentiment: "negative",
    title: metadata?.title,
    description: metadata?.description,
    channelTitle: metadata?.channelTitle,
    publishedAt: metadata?.publishedAt,
    viewCount: metadata?.viewCount,
    likeCount: metadata?.likeCount,
    url: metadata?.url,
  });
}

/**
 * Remove a video from all feedback.
 */
export async function removeFeedback(videoId: string): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }
  await feedbackRepo.deleteById(videoId.trim());
}

// ---------- reads ----------

/**
 * Get all positive feedback video IDs.
 */
export async function getPositiveFeedback(): Promise<Set<string>> {
  return new Set(await feedbackRepo.findIdsBySentiment("positive"));
}

/**
 * Get all negative feedback video IDs.
 */
export async function getNegativeFeedback(): Promise<Set<string>> {
  return new Set(await feedbackRepo.findIdsBySentiment("negative"));
}

/**
 * Get all positive feedback with metadata.
 */
export async function getPositiveFeedbackWithMetadata(): Promise<Map<string, VideoMetadata>> {
  return rowsToMetadataMap(await feedbackRepo.findBySentiment("positive"));
}

/**
 * Get all negative feedback with metadata.
 */
export async function getNegativeFeedbackWithMetadata(): Promise<Map<string, VideoMetadata>> {
  return rowsToMetadataMap(await feedbackRepo.findBySentiment("negative"));
}

/**
 * Get feedback summary for AI prompt.
 */
export async function getFeedbackSummary(): Promise<{
  positiveCount: number;
  negativeCount: number;
  positiveExamples: string[];
  negativeExamples: string[];
  positiveMetadata: VideoMetadata[];
  negativeMetadata: VideoMetadata[];
}> {
  const positiveFeedback = await getPositiveFeedbackWithMetadata();
  const negativeFeedback = await getNegativeFeedbackWithMetadata();
  return {
    positiveCount: positiveFeedback.size,
    negativeCount: negativeFeedback.size,
    positiveExamples: Array.from(positiveFeedback.keys()).slice(0, 10),
    negativeExamples: Array.from(negativeFeedback.keys()).slice(0, 10),
    positiveMetadata: Array.from(positiveFeedback.values()),
    negativeMetadata: Array.from(negativeFeedback.values()),
  };
}

/**
 * Get feedback status for a specific video.
 */
export async function getVideoFeedbackStatus(videoId: string): Promise<"positive" | "negative" | null> {
  return await feedbackRepo.findSentimentById(videoId);
}

/**
 * Get feedback status for multiple videos at once (batch operation).
 */
export async function getBatchVideoFeedbackStatus(
  videoIds: string[]
): Promise<Map<string, "positive" | "negative" | null>> {
  return await feedbackRepo.findSentimentsByIds(videoIds);
}
