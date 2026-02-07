import { sql, ensureSchema } from "~/services/db.server";

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
export async function upsert(data: FeedbackInsert): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO feedback (id, sentiment, title, description, channel_title, published_at, view_count, like_count, url)
    VALUES (
      ${data.id},
      ${data.sentiment},
      ${data.title ?? null},
      ${data.description ?? null},
      ${data.channelTitle ?? null},
      ${data.publishedAt ?? null},
      ${data.viewCount ?? null},
      ${data.likeCount ?? null},
      ${data.url ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      sentiment = EXCLUDED.sentiment,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      channel_title = EXCLUDED.channel_title,
      published_at = EXCLUDED.published_at,
      view_count = EXCLUDED.view_count,
      like_count = EXCLUDED.like_count,
      url = EXCLUDED.url
  `;
}

/**
 * Delete a feedback row by video id.
 */
export async function deleteById(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM feedback WHERE id = ${id}`;
}

/**
 * Get all ids for a given sentiment.
 */
export async function findIdsBySentiment(sentiment: Sentiment): Promise<string[]> {
  await ensureSchema();
  const rows = await sql`SELECT id FROM feedback WHERE sentiment = ${sentiment}`;
  return rows.map((r) => r.id as string);
}

/**
 * Get all rows for a given sentiment.
 */
export async function findBySentiment(sentiment: Sentiment): Promise<FeedbackRow[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM feedback WHERE sentiment = ${sentiment}`;
  return rows as FeedbackRow[];
}

/**
 * Get the sentiment for a single video id. Returns null if not found.
 */
export async function findSentimentById(id: string): Promise<Sentiment | null> {
  await ensureSchema();
  const rows = await sql`SELECT sentiment FROM feedback WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rows[0].sentiment as Sentiment;
}

/**
 * Get the sentiment for multiple video ids at once.
 */
export async function findSentimentsByIds(ids: string[]): Promise<Map<string, Sentiment | null>> {
  await ensureSchema();
  const result = new Map<string, Sentiment | null>();

  if (ids.length === 0) return result;

  const rows = await sql`SELECT id, sentiment FROM feedback WHERE id = ANY(${ids})`;
  const found = new Map<string, Sentiment>();
  for (const row of rows) {
    found.set(row.id as string, row.sentiment as Sentiment);
  }
  for (const id of ids) {
    result.set(id, found.get(id) ?? null);
  }
  return result;
}
