import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const FEEDBACK_DIR = join(process.cwd(), "data");
const POSITIVE_FEEDBACK_FILE = join(FEEDBACK_DIR, "positive-feedback.txt");
const NEGATIVE_FEEDBACK_FILE = join(FEEDBACK_DIR, "negative-feedback.txt");

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

/**
 * Ensure the feedback directory exists
 */
async function ensureFeedbackDir(): Promise<void> {
  if (!existsSync(FEEDBACK_DIR)) {
    await mkdir(FEEDBACK_DIR, { recursive: true });
  }
}

/**
 * Read video metadata from a feedback file
 * Supports both old format (just IDs) and new format (JSON objects)
 */
async function readFeedbackFile(filePath: string): Promise<Map<string, VideoMetadata>> {
  try {
    if (!existsSync(filePath)) {
      return new Map<string, VideoMetadata>();
    }
    const content = await readFile(filePath, "utf-8");
    const feedbackMap = new Map<string, VideoMetadata>();
    
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    
    for (const line of lines) {
      try {
        // Try to parse as JSON (new format)
        const metadata: VideoMetadata = JSON.parse(line);
        if (metadata.id) {
          feedbackMap.set(metadata.id, metadata);
        }
      } catch {
        // Fall back to old format (just ID)
        if (line.length > 0) {
          feedbackMap.set(line, { id: line });
        }
      }
    }
    
    return feedbackMap;
  } catch (error) {
    console.error(`Failed to read feedback file ${filePath}:`, error);
    return new Map<string, VideoMetadata>();
  }
}

/**
 * Write video metadata to a feedback file
 */
async function writeFeedbackFile(filePath: string, feedbackMap: Map<string, VideoMetadata>): Promise<void> {
  try {
    await ensureFeedbackDir();
    const lines = Array.from(feedbackMap.values()).map((metadata) => JSON.stringify(metadata));
    const content = lines.join("\n");
    await writeFile(filePath, content, "utf-8");
  } catch (error) {
    console.error(`Failed to write feedback file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Add a video with metadata to positive feedback
 */
export async function addPositiveFeedback(videoId: string, metadata?: Partial<VideoMetadata>): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveFeedback = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeFeedback = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  // Remove from negative if it exists there
  negativeFeedback.delete(videoId);
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeFeedback);

  // Add to positive with metadata
  const videoMetadata: VideoMetadata = {
    id: videoId.trim(),
    ...metadata,
  };
  positiveFeedback.set(videoId.trim(), videoMetadata);
  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveFeedback);
}

/**
 * Add a video with metadata to negative feedback
 */
export async function addNegativeFeedback(videoId: string, metadata?: Partial<VideoMetadata>): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveFeedback = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeFeedback = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  // Remove from positive if it exists there
  positiveFeedback.delete(videoId);
  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveFeedback);

  // Add to negative with metadata
  const videoMetadata: VideoMetadata = {
    id: videoId.trim(),
    ...metadata,
  };
  negativeFeedback.set(videoId.trim(), videoMetadata);
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeFeedback);
}

/**
 * Remove a video ID from all feedback
 */
export async function removeFeedback(videoId: string): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveFeedback = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeFeedback = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  positiveFeedback.delete(videoId.trim());
  negativeFeedback.delete(videoId.trim());

  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveFeedback);
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeFeedback);
}

/**
 * Get all positive feedback video IDs (for backward compatibility)
 */
export async function getPositiveFeedback(): Promise<Set<string>> {
  const feedback = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  return new Set(feedback.keys());
}

/**
 * Get all negative feedback video IDs (for backward compatibility)
 */
export async function getNegativeFeedback(): Promise<Set<string>> {
  const feedback = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);
  return new Set(feedback.keys());
}

/**
 * Get all positive feedback with metadata
 */
export async function getPositiveFeedbackWithMetadata(): Promise<Map<string, VideoMetadata>> {
  return readFeedbackFile(POSITIVE_FEEDBACK_FILE);
}

/**
 * Get all negative feedback with metadata
 */
export async function getNegativeFeedbackWithMetadata(): Promise<Map<string, VideoMetadata>> {
  return readFeedbackFile(NEGATIVE_FEEDBACK_FILE);
}

/**
 * Get feedback summary for AI prompt
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
 * Get feedback status for a specific video
 */
export async function getVideoFeedbackStatus(videoId: string): Promise<"positive" | "negative" | null> {
  const positiveIds = await getPositiveFeedback();
  const negativeIds = await getNegativeFeedback();

  if (positiveIds.has(videoId)) {
    return "positive";
  }
  if (negativeIds.has(videoId)) {
    return "negative";
  }
  return null;
}

/**
 * Get feedback status for multiple videos at once (batch operation)
 */
export async function getBatchVideoFeedbackStatus(
  videoIds: string[]
): Promise<Map<string, "positive" | "negative" | null>> {
  const positiveIds = await getPositiveFeedback();
  const negativeIds = await getNegativeFeedback();
  const statusMap = new Map<string, "positive" | "negative" | null>();

  for (const videoId of videoIds) {
    if (positiveIds.has(videoId)) {
      statusMap.set(videoId, "positive");
    } else if (negativeIds.has(videoId)) {
      statusMap.set(videoId, "negative");
    } else {
      statusMap.set(videoId, null);
    }
  }

  return statusMap;
}
