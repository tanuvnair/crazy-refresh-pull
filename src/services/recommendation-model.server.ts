import * as modelRepo from "~/db-repositories/model";
import {
  getPositiveFeedbackWithMetadata,
  getNegativeFeedbackWithMetadata,
} from "./feedback.server";

/** Video-like type for feature extraction (Video or VideoMetadata). */
export interface VideoLike {
  id: string;
  title?: string;
  description?: string;
  channelTitle?: string;
  viewCount?: string;
  likeCount?: string;
}

const MODEL_KEY = "recommendation_model";

/** Number of features the model expects. */
export const FEATURE_COUNT = 10;

export interface RecommendationModelData {
  version: 1;
  weights: number[];
  bias: number;
  featureNames: string[];
  trainedAt: string;
  positiveCount: number;
  negativeCount: number;
}

const FEATURE_NAMES: string[] = [
  "clickbait",
  "descriptionQuality",
  "engagement",
  "titleLengthNorm",
  "positiveKeywordOverlap",
  "negativeKeywordOverlap",
  "positiveChannelMatch",
  "negativeChannelMatch",
  "descriptionLengthNorm",
  "engagementLikeRatio",
];

// ---------- text helpers ----------

function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const keywords: string[] = [];
  const stopWords = new Set([
    "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "a", "an", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "this", "that", "these", "those",
  ]);
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, "");
    if (cleanWord.length >= 3 && !stopWords.has(cleanWord)) {
      keywords.push(cleanWord);
    }
  }
  return keywords;
}

function detectClickbait(title: string): number {
  if (!title) return 0;
  const lowerTitle = title.toLowerCase();
  let clickbaitScore = 0;
  const capsRatio = (title.match(/[A-Z]/g) || []).length / title.length;
  if (capsRatio > 0.5) clickbaitScore += 0.3;
  const emojiCount = (title.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 2) clickbaitScore += 0.2;
  const clickbaitPhrases = [
    "you won't believe", "this will shock you", "number one will",
    "top 10", "watch until the end", "gone wrong", "gone sexual",
    "they don't want you to know", "doctors hate this", "one weird trick",
    "click here", "subscribe now", "like and subscribe", "smash that like button",
  ];
  for (const phrase of clickbaitPhrases) {
    if (lowerTitle.includes(phrase)) clickbaitScore += 0.2;
  }
  const exclamationCount = (title.match(/!/g) || []).length;
  const questionCount = (title.match(/\?/g) || []).length;
  if (exclamationCount > 2 || questionCount > 2) clickbaitScore += 0.1;
  return Math.min(clickbaitScore, 1.0);
}

function calculateEngagementScore(viewCount?: string, likeCount?: string): number {
  if (!viewCount || !likeCount) return 0.5;
  const views = parseInt(viewCount, 10);
  const likes = parseInt(likeCount, 10);
  if (views === 0) return 0.3;
  const likeRatio = likes / views;
  if (likeRatio > 0.01) return 0.8;
  if (likeRatio > 0.005) return 0.6;
  if (likeRatio > 0.001) return 0.4;
  return 0.2;
}

function analyzeDescriptionQuality(description: string): number {
  if (!description || description.trim().length === 0) return 0.3;
  const desc = description.toLowerCase();
  let score = 0.5;
  if (description.length > 200) score += 0.1;
  if (desc.includes("subscribe") && desc.includes("like") && desc.includes("notification")) {
    score -= 0.2;
  }
  const linkCount = (description.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}

// ---------- feedback patterns ----------

interface FeedbackPatterns {
  positiveKeywords: Set<string>;
  negativeKeywords: Set<string>;
  positiveChannels: Set<string>;
  negativeChannels: Set<string>;
}

async function loadFeedbackPatterns(): Promise<FeedbackPatterns> {
  const positive = await getPositiveFeedbackWithMetadata();
  const negative = await getNegativeFeedbackWithMetadata();
  const positiveKeywords = new Set<string>();
  const negativeKeywords = new Set<string>();
  const positiveChannels = new Set<string>();
  const negativeChannels = new Set<string>();
  for (const m of positive.values()) {
    if (m.title) extractKeywords(m.title).forEach((k) => positiveKeywords.add(k));
    if (m.description) extractKeywords(m.description).forEach((k) => positiveKeywords.add(k));
    if (m.channelTitle) positiveChannels.add(m.channelTitle);
  }
  for (const m of negative.values()) {
    if (m.title) extractKeywords(m.title).forEach((k) => negativeKeywords.add(k));
    if (m.description) extractKeywords(m.description).forEach((k) => negativeKeywords.add(k));
    if (m.channelTitle) negativeChannels.add(m.channelTitle);
  }
  return { positiveKeywords, negativeKeywords, positiveChannels, negativeChannels };
}

// ---------- feature extraction ----------

/**
 * Extract a fixed-size feature vector for a video (used for training and scoring).
 */
export async function extractFeatures(
  video: VideoLike,
  patterns: FeedbackPatterns
): Promise<number[]> {
  const title = (video.title ?? "").trim();
  const description = (video.description ?? "").trim();
  const channelTitle = (video.channelTitle ?? "").trim();

  const clickbait = detectClickbait(title);
  const descriptionQuality = analyzeDescriptionQuality(description);
  const engagement = calculateEngagementScore(video.viewCount, video.likeCount);
  const titleLengthNorm = Math.min(1, title.length / 100);
  const descriptionLengthNorm = Math.min(1, description.length / 500);

  const videoKeywords = new Set([
    ...extractKeywords(title),
    ...extractKeywords(description),
  ]);
  let positiveOverlap = 0;
  let negativeOverlap = 0;
  const totalKeywords = videoKeywords.size || 1;
  for (const k of videoKeywords) {
    if (patterns.positiveKeywords.has(k)) positiveOverlap += 1;
    if (patterns.negativeKeywords.has(k)) negativeOverlap += 1;
  }
  const positiveKeywordOverlap = positiveOverlap / totalKeywords;
  const negativeKeywordOverlap = negativeOverlap / totalKeywords;

  const positiveChannelMatch = patterns.positiveChannels.has(channelTitle) ? 1 : 0;
  const negativeChannelMatch = patterns.negativeChannels.has(channelTitle) ? 1 : 0;

  let engagementLikeRatio = 0.5;
  if (video.viewCount && video.likeCount) {
    const v = parseInt(video.viewCount, 10);
    const l = parseInt(video.likeCount, 10);
    engagementLikeRatio = v > 0 ? Math.min(1, (l / v) * 100) : 0.5;
  }

  return [
    clickbait,
    descriptionQuality,
    engagement,
    titleLengthNorm,
    Math.min(1, positiveKeywordOverlap),
    Math.min(1, negativeKeywordOverlap),
    positiveChannelMatch,
    negativeChannelMatch,
    descriptionLengthNorm,
    engagementLikeRatio,
  ];
}

// ---------- math ----------

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

// ---------- model persistence via repository ----------

let cachedModel: RecommendationModelData | null = null;

async function saveModel(data: RecommendationModelData): Promise<void> {
  await modelRepo.setValue(MODEL_KEY, JSON.stringify(data));
  cachedModel = data;
}

async function loadModelFromDb(): Promise<RecommendationModelData | null> {
  if (cachedModel) return cachedModel;
  const raw = await modelRepo.getValue(MODEL_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as RecommendationModelData;
    if (data.version !== 1 || !Array.isArray(data.weights) || data.weights.length !== FEATURE_COUNT) {
      return null;
    }
    cachedModel = data;
    return data;
  } catch {
    return null;
  }
}

// ---------- public API ----------

/**
 * Train a logistic regression model on positive (1) and negative (0) feedback.
 * Requires at least 2 positive and 2 negative samples.
 */
export async function trainModel(): Promise<{
  success: boolean;
  message: string;
  positiveCount: number;
  negativeCount: number;
}> {
  const positive = await getPositiveFeedbackWithMetadata();
  const negativeMap = await getNegativeFeedbackWithMetadata();

  const positiveList = Array.from(positive.values());
  const negativeList = Array.from(negativeMap.values());

  const MIN_POSITIVE = 2;
  const MIN_NEGATIVE = 2;
  if (positiveList.length < MIN_POSITIVE || negativeList.length < MIN_NEGATIVE) {
    return {
      success: false,
      message: `Need at least ${MIN_POSITIVE} positive and ${MIN_NEGATIVE} negative feedback samples to train. You have ${positiveList.length} positive and ${negativeList.length} negative.`,
      positiveCount: positiveList.length,
      negativeCount: negativeList.length,
    };
  }

  const patterns = await loadFeedbackPatterns();
  const examples: { features: number[]; label: number }[] = [];

  for (const m of positiveList) {
    const features = await extractFeatures(m, patterns);
    examples.push({ features, label: 1 });
  }
  for (const m of negativeList) {
    const features = await extractFeatures(m, patterns);
    examples.push({ features, label: 0 });
  }

  const numFeatures = FEATURE_COUNT;
  const weights = new Array<number>(numFeatures).fill(0);
  let bias = 0;
  const learningRate = 0.1;
  const epochs = 500;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;
    const gradW = new Array<number>(numFeatures).fill(0);
    let gradB = 0;

    for (const { features, label } of examples) {
      let z = bias;
      for (let i = 0; i < numFeatures; i++) {
        z += weights[i] * features[i];
      }
      const pred = sigmoid(z);
      const err = pred - label;
      totalLoss += label * Math.log(pred + 1e-15) + (1 - label) * Math.log(1 - pred + 1e-15);
      gradB += err;
      for (let i = 0; i < numFeatures; i++) {
        gradW[i] += err * features[i];
      }
    }

    const n = examples.length;
    bias -= (learningRate * gradB) / n;
    for (let i = 0; i < numFeatures; i++) {
      weights[i] -= (learningRate * gradW[i]) / n;
    }

    if (epoch > 0 && epoch % 100 === 0 && totalLoss / n > -0.1) {
      break;
    }
  }

  const modelData: RecommendationModelData = {
    version: 1,
    weights,
    bias,
    featureNames: FEATURE_NAMES,
    trainedAt: new Date().toISOString(),
    positiveCount: positiveList.length,
    negativeCount: negativeList.length,
  };

  await saveModel(modelData);

  return {
    success: true,
    message: `Model trained on ${positiveList.length} positive and ${negativeList.length} negative samples. Use it to rank search results for better "watch while eating" recommendations.`,
    positiveCount: positiveList.length,
    negativeCount: negativeList.length,
  };
}

/**
 * Load the recommendation model (cached in-memory, persisted in Neon PostgreSQL).
 */
export async function loadModel(): Promise<RecommendationModelData | null> {
  return await loadModelFromDb();
}

/**
 * Invalidate cached model (call after training or when feedback changes).
 */
export function invalidateModelCache(): void {
  cachedModel = null;
}

/**
 * Score a video with the recommendation model (0 = dislike, 1 = like).
 * Returns null if no model is trained.
 */
export async function scoreVideo(video: VideoLike): Promise<number | null> {
  const model = await loadModelFromDb();
  if (!model) return null;
  const patterns = await loadFeedbackPatterns();
  const features = await extractFeatures(video, patterns);
  let z = model.bias;
  for (let i = 0; i < model.weights.length && i < features.length; i++) {
    z += model.weights[i] * features[i];
  }
  return sigmoid(z);
}

/**
 * Check if the recommendation model is available (trained and loaded).
 */
export async function isModelAvailable(): Promise<boolean> {
  return (await loadModelFromDb()) !== null;
}
