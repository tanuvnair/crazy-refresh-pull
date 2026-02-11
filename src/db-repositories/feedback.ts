import { prisma } from "~/services/db.server";
import type { Feedback as FeedbackRow } from "../../prisma/generated/prisma/client";

export type { Feedback as FeedbackRow } from "../../prisma/generated/prisma/client";

export type Sentiment = "positive" | "negative";

export interface FeedbackInsert {
  id: string;
  sentiment: Sentiment;
  title?: string | null;
  description?: string | null;
  channelTitle?: string | null;
  publishedAt?: string | null;
  viewCount?: string | null;
  likeCount?: string | null;
  url?: string | null;
}

/**
 * Upsert a feedback row. If it already exists, the sentiment and metadata are replaced.
 */
export async function upsert(data: FeedbackInsert): Promise<void> {
  const payload = {
    sentiment: data.sentiment,
    title: data.title ?? null,
    description: data.description ?? null,
    channelTitle: data.channelTitle ?? null,
    publishedAt: data.publishedAt ?? null,
    viewCount: data.viewCount ?? null,
    likeCount: data.likeCount ?? null,
    url: data.url ?? null,
  };

  await prisma.feedback.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
}

/**
 * Delete a feedback row by video id.
 */
export async function deleteById(id: string): Promise<void> {
  await prisma.feedback.deleteMany({ where: { id } });
}

/**
 * Get all ids for a given sentiment.
 */
export async function findIdsBySentiment(
  sentiment: Sentiment,
): Promise<string[]> {
  const rows = await prisma.feedback.findMany({
    where: { sentiment },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Get all rows for a given sentiment.
 */
export async function findBySentiment(
  sentiment: Sentiment,
): Promise<FeedbackRow[]> {
  return prisma.feedback.findMany({ where: { sentiment } });
}

/**
 * Get the sentiment for a single video id. Returns null if not found.
 */
export async function findSentimentById(id: string): Promise<Sentiment | null> {
  const row = await prisma.feedback.findUnique({
    where: { id },
    select: { sentiment: true },
  });
  if (!row) return null;
  return row.sentiment as Sentiment;
}

/**
 * Get the sentiment for multiple video ids at once.
 */
export async function findSentimentsByIds(
  ids: string[],
): Promise<Map<string, Sentiment | null>> {
  const result = new Map<string, Sentiment | null>();
  if (ids.length === 0) return result;

  const rows = await prisma.feedback.findMany({
    where: { id: { in: ids } },
    select: { id: true, sentiment: true },
  });

  const found = new Map<string, Sentiment>();
  for (const row of rows) {
    found.set(row.id, row.sentiment as Sentiment);
  }
  for (const id of ids) {
    result.set(id, found.get(id) ?? null);
  }
  return result;
}
