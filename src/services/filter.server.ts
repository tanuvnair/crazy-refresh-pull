import type { Video } from "~/components/video-card";
import { getPositiveFeedback, getNegativeFeedback, getPositiveFeedbackWithMetadata, getNegativeFeedbackWithMetadata } from "./feedback.server";
import type { VideoMetadata } from "./feedback.server";

export interface VideoAnalysisResult {
  videoId: string;
  isAuthentic: boolean;
  score: number;
  reasoning?: string;
}

interface VideoPatterns {
  positiveTitles: string[];
  negativeTitles: string[];
  positiveChannels: string[];
  negativeChannels: string[];
  positiveKeywords: Set<string>;
  negativeKeywords: Set<string>;
}

/**
 * Extract keywords from text (common words, phrases)
 */
function extractKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const keywords: string[] = [];
  
  // Add individual significant words (3+ chars, not common stop words)
  const stopWords = new Set(["the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "this", "that", "these", "those"]);
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, "");
    if (cleanWord.length >= 3 && !stopWords.has(cleanWord)) {
      keywords.push(cleanWord);
    }
  }
  
  // Add 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`.replace(/[^\w\s]/g, "");
    if (phrase.length >= 5) {
      keywords.push(phrase);
    }
  }
  
  return keywords;
}

/**
 * Load patterns from feedback data using stored metadata
 */
async function loadFeedbackPatterns(): Promise<VideoPatterns> {
  const positiveFeedback = await getPositiveFeedbackWithMetadata();
  const negativeFeedback = await getNegativeFeedbackWithMetadata();
  
  const positiveKeywords = new Set<string>();
  const negativeKeywords = new Set<string>();
  const positiveTitles: string[] = [];
  const negativeTitles: string[] = [];
  const positiveChannels: string[] = [];
  const negativeChannels: string[] = [];
  
  // Extract patterns from positive feedback
  for (const metadata of positiveFeedback.values()) {
    if (metadata.title) {
      positiveTitles.push(metadata.title);
      const keywords = extractKeywords(metadata.title);
      keywords.forEach((kw) => positiveKeywords.add(kw));
    }
    if (metadata.description) {
      const keywords = extractKeywords(metadata.description);
      keywords.forEach((kw) => positiveKeywords.add(kw));
    }
    if (metadata.channelTitle) {
      positiveChannels.push(metadata.channelTitle);
    }
  }
  
  // Extract patterns from negative feedback
  for (const metadata of negativeFeedback.values()) {
    if (metadata.title) {
      negativeTitles.push(metadata.title);
      const keywords = extractKeywords(metadata.title);
      keywords.forEach((kw) => negativeKeywords.add(kw));
    }
    if (metadata.description) {
      const keywords = extractKeywords(metadata.description);
      keywords.forEach((kw) => negativeKeywords.add(kw));
    }
    if (metadata.channelTitle) {
      negativeChannels.push(metadata.channelTitle);
    }
  }
  
  return {
    positiveTitles,
    negativeTitles,
    positiveChannels,
    negativeChannels,
    positiveKeywords,
    negativeKeywords,
  };
}

/**
 * Detect clickbait patterns in title
 */
function detectClickbait(title: string): number {
  const lowerTitle = title.toLowerCase();
  let clickbaitScore = 0;
  
  // Excessive capitalization
  const capsRatio = (title.match(/[A-Z]/g) || []).length / title.length;
  if (capsRatio > 0.5) {
    clickbaitScore += 0.3;
  }
  
  // Excessive emojis
  const emojiCount = (title.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 2) {
    clickbaitScore += 0.2;
  }
  
  // Clickbait phrases
  const clickbaitPhrases = [
    "you won't believe",
    "this will shock you",
    "number one will",
    "top 10",
    "watch until the end",
    "gone wrong",
    "gone sexual",
    "they don't want you to know",
    "doctors hate this",
    "one weird trick",
    "click here",
    "subscribe now",
    "like and subscribe",
    "smash that like button",
  ];
  
  for (const phrase of clickbaitPhrases) {
    if (lowerTitle.includes(phrase)) {
      clickbaitScore += 0.2;
    }
  }
  
  // Excessive punctuation
  const exclamationCount = (title.match(/!/g) || []).length;
  const questionCount = (title.match(/\?/g) || []).length;
  if (exclamationCount > 2 || questionCount > 2) {
    clickbaitScore += 0.1;
  }
  
  return Math.min(clickbaitScore, 1.0);
}

/**
 * Calculate engagement quality score
 */
function calculateEngagementScore(viewCount?: string, likeCount?: string): number {
  if (!viewCount || !likeCount) {
    return 0.5; // Neutral if no data
  }
  
  const views = parseInt(viewCount, 10);
  const likes = parseInt(likeCount, 10);
  
  if (views === 0) {
    return 0.3; // Low score for no views
  }
  
  const likeRatio = likes / views;
  
  // Good engagement: > 0.01 (1% like ratio)
  // Medium: 0.005-0.01
  // Low: < 0.005
  if (likeRatio > 0.01) {
    return 0.8;
  } else if (likeRatio > 0.005) {
    return 0.6;
  } else if (likeRatio > 0.001) {
    return 0.4;
  }
  
  return 0.2;
}

/**
 * Analyze description quality
 */
function analyzeDescription(description: string): number {
  if (!description || description.trim().length === 0) {
    return 0.3; // Low score for empty description
  }
  
  const desc = description.toLowerCase();
  let score = 0.5; // Base score
  
  // Positive indicators
  if (description.length > 200) {
    score += 0.1; // Longer descriptions often indicate more effort
  }
  
  // Negative indicators
  if (desc.includes("subscribe") && desc.includes("like") && desc.includes("notification")) {
    score -= 0.2; // Excessive self-promotion
  }
  
  if (desc.includes("http://") || desc.includes("https://")) {
    // Links can be good or bad, but multiple links might indicate spam
    const linkCount = (description.match(/https?:\/\//g) || []).length;
    if (linkCount > 3) {
      score -= 0.1;
    }
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Analyze video using custom AI logic with feedback-based learning
 */
export async function analyzeVideo(video: Video, patterns?: VideoPatterns): Promise<VideoAnalysisResult> {
  let score = 0.5; // Start with neutral score
  const reasons: string[] = [];
  
  // 1. Clickbait detection (negative impact)
  const clickbaitScore = detectClickbait(video.title);
  if (clickbaitScore > 0.3) {
    score -= clickbaitScore * 0.4;
    reasons.push(`Clickbait patterns detected in title (${Math.round(clickbaitScore * 100)}%)`);
  } else if (clickbaitScore < 0.1) {
    score += 0.1;
    reasons.push("Title appears authentic");
  }
  
  // 2. Description quality
  const descScore = analyzeDescription(video.description);
  score += (descScore - 0.5) * 0.2; // Adjust based on description quality
  if (descScore > 0.6) {
    reasons.push("Good description quality");
  } else if (descScore < 0.4) {
    reasons.push("Low description quality");
  }
  
  // 3. Engagement metrics
  const engagementScore = calculateEngagementScore(video.viewCount, video.likeCount);
  score += (engagementScore - 0.5) * 0.2;
  if (engagementScore > 0.7) {
    reasons.push("Good engagement metrics");
  } else if (engagementScore < 0.3) {
    reasons.push("Low engagement metrics");
  }
  
  // 4. Channel name patterns (simple heuristic)
  const channelLower = video.channelTitle.toLowerCase();
  if (channelLower.includes("official") && !channelLower.includes("unofficial")) {
    score += 0.05; // Slight positive for official channels
  }
  
  // 5. Title length (very short or very long titles can be suspicious)
  const titleLength = video.title.length;
  if (titleLength < 10) {
    score -= 0.1;
    reasons.push("Title too short");
  } else if (titleLength > 100) {
    score -= 0.05;
    reasons.push("Title unusually long");
  }
  
  // 6. Feedback-based learning (if patterns are available)
  if (patterns) {
    const videoKeywords = new Set([
      ...extractKeywords(video.title),
      ...extractKeywords(video.description),
    ]);
    
    // Check for positive patterns
    let positiveMatches = 0;
    let negativeMatches = 0;
    
    for (const keyword of videoKeywords) {
      if (patterns.positiveKeywords.has(keyword)) {
        positiveMatches++;
      }
      if (patterns.negativeKeywords.has(keyword)) {
        negativeMatches++;
      }
    }
    
    // Check channel matches
    if (patterns.positiveChannels.includes(video.channelTitle)) {
      positiveMatches += 2; // Channel match is stronger
    }
    if (patterns.negativeChannels.includes(video.channelTitle)) {
      negativeMatches += 2;
    }
    
    // Apply feedback-based scoring
    if (positiveMatches > 0 && positiveMatches > negativeMatches) {
      const feedbackBoost = Math.min(0.15, (positiveMatches - negativeMatches) * 0.03);
      score += feedbackBoost;
      reasons.push(`Matches ${positiveMatches} positive pattern(s) from feedback`);
    } else if (negativeMatches > 0 && negativeMatches > positiveMatches) {
      const feedbackPenalty = Math.min(0.15, (negativeMatches - positiveMatches) * 0.03);
      score -= feedbackPenalty;
      reasons.push(`Matches ${negativeMatches} negative pattern(s) from feedback`);
    }
  }
  
  // Normalize score to 0-1 range
  score = Math.max(0, Math.min(1, score));
  
  // Determine if authentic (threshold: 0.4)
  const isAuthentic = score >= 0.4;
  
  return {
    videoId: video.id,
    isAuthentic,
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "Analyzed using custom filtering",
  };
}

/**
 * Analyze multiple videos with feedback-based learning
 */
export async function analyzeVideos(videos: Video[]): Promise<VideoAnalysisResult[]> {
  const patterns = await loadFeedbackPatterns();
  
  const results: VideoAnalysisResult[] = [];
  
  for (const video of videos) {
    const result = await analyzeVideo(video, patterns);
    results.push(result);
  }
  
  return results;
}

/**
 * Filter videos based on analysis results
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
    if (analysis === undefined) {
      return true; // Include if not analyzed
    }
    // Only exclude if explicitly false - be lenient with borderline cases
    return analysis.isAuthentic !== false;
  });
}
