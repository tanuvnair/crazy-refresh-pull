import { getDb } from "~/services/db.server";

export type Sentiment = "positive" | "negative";

export interface FeedbackRow {
  id: string;
  sentiment: string;
  title: string | null;
  description: string | null;
  channel_title: string | null;
  published_at: string | null;
  view_count: string | null;
  like_count: string | null;
  url: string | null;
  created_at: string;
}

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
export function upsert(data: FeedbackInsert): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO feedback
        (id, sentiment, title, description, channel_title, published_at, view_count, like_count, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.sentiment,
      data.title ?? null,
      data.description ?? null,
      data.channelTitle ?? null,
      data.publishedAt ?? null,
      data.viewCount ?? null,
      data.likeCount ?? null,
      data.url ?? null
    );
}

/**
 * Delete a feedback row by video id.
 */
export function deleteById(id: string): void {
  getDb().prepare("DELETE FROM feedback WHERE id = ?").run(id);
}

/**
 * Get all ids for a given sentiment.
 */
export function findIdsBySentiment(sentiment: Sentiment): string[] {
  const rows = getDb()
    .prepare("SELECT id FROM feedback WHERE sentiment = ?")
    .all(sentiment) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

/**
 * Get all rows for a given sentiment.
 */
export function findBySentiment(sentiment: Sentiment): FeedbackRow[] {
  return getDb()
    .prepare("SELECT * FROM feedback WHERE sentiment = ?")
    .all(sentiment) as FeedbackRow[];
}

/**
 * Get the sentiment for a single video id. Returns null if not found.
 */
export function findSentimentById(id: string): Sentiment | null {
  const row = getDb()
    .prepare("SELECT sentiment FROM feedback WHERE id = ?")
    .get(id) as { sentiment: string } | undefined;
  return row ? (row.sentiment as Sentiment) : null;
}

/**
 * Get the sentiment for multiple video ids at once.
 */
export function findSentimentsByIds(ids: string[]): Map<string, Sentiment | null> {
  const db = getDb();
  const stmt = db.prepare("SELECT sentiment FROM feedback WHERE id = ?");
  const result = new Map<string, Sentiment | null>();
  for (const id of ids) {
    const row = stmt.get(id) as { sentiment: string } | undefined;
    result.set(id, row ? (row.sentiment as Sentiment) : null);
  }
  return result;
}
