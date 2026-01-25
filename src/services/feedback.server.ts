import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const FEEDBACK_DIR = join(process.cwd(), "data");
const POSITIVE_FEEDBACK_FILE = join(FEEDBACK_DIR, "positive-feedback.txt");
const NEGATIVE_FEEDBACK_FILE = join(FEEDBACK_DIR, "negative-feedback.txt");

/**
 * Ensure the feedback directory exists
 */
async function ensureFeedbackDir(): Promise<void> {
  if (!existsSync(FEEDBACK_DIR)) {
    await mkdir(FEEDBACK_DIR, { recursive: true });
  }
}

/**
 * Read video IDs from a feedback file
 */
async function readFeedbackFile(filePath: string): Promise<Set<string>> {
  try {
    if (!existsSync(filePath)) {
      return new Set<string>();
    }
    const content = await readFile(filePath, "utf-8");
    const videoIds = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return new Set(videoIds);
  } catch (error) {
    console.error(`Failed to read feedback file ${filePath}:`, error);
    return new Set<string>();
  }
}

/**
 * Write video IDs to a feedback file
 */
async function writeFeedbackFile(filePath: string, videoIds: Set<string>): Promise<void> {
  try {
    await ensureFeedbackDir();
    const content = Array.from(videoIds).join("\n");
    await writeFile(filePath, content, "utf-8");
  } catch (error) {
    console.error(`Failed to write feedback file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Add a video ID to positive feedback
 */
export async function addPositiveFeedback(videoId: string): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveIds = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeIds = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  // Remove from negative if it exists there
  negativeIds.delete(videoId);
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeIds);

  // Add to positive
  positiveIds.add(videoId.trim());
  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveIds);
}

/**
 * Add a video ID to negative feedback
 */
export async function addNegativeFeedback(videoId: string): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveIds = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeIds = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  // Remove from positive if it exists there
  positiveIds.delete(videoId);
  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveIds);

  // Add to negative
  negativeIds.add(videoId.trim());
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeIds);
}

/**
 * Remove a video ID from all feedback
 */
export async function removeFeedback(videoId: string): Promise<void> {
  if (!videoId || videoId.trim().length === 0) {
    throw new Error("Video ID is required");
  }

  const positiveIds = await readFeedbackFile(POSITIVE_FEEDBACK_FILE);
  const negativeIds = await readFeedbackFile(NEGATIVE_FEEDBACK_FILE);

  positiveIds.delete(videoId.trim());
  negativeIds.delete(videoId.trim());

  await writeFeedbackFile(POSITIVE_FEEDBACK_FILE, positiveIds);
  await writeFeedbackFile(NEGATIVE_FEEDBACK_FILE, negativeIds);
}

/**
 * Get all positive feedback video IDs
 */
export async function getPositiveFeedback(): Promise<Set<string>> {
  return readFeedbackFile(POSITIVE_FEEDBACK_FILE);
}

/**
 * Get all negative feedback video IDs
 */
export async function getNegativeFeedback(): Promise<Set<string>> {
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
}> {
  const positiveIds = await getPositiveFeedback();
  const negativeIds = await getNegativeFeedback();

  return {
    positiveCount: positiveIds.size,
    negativeCount: negativeIds.size,
    positiveExamples: Array.from(positiveIds).slice(0, 10),
    negativeExamples: Array.from(negativeIds).slice(0, 10),
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
