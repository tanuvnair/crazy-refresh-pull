import { sql, ensureSchema } from "~/services/db.server";

/** Maximum number of videos kept in the pool. Oldest are evicted when exceeded. */
export const MAX_POOL_SIZE = 3000;

export interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  channel_title: string | null;
  published_at: string | null;
  view_count: string | null;
  like_count: string | null;
  url: string;
  created_at: string;
}

export interface VideoInsert {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  channelTitle?: string | null;
  publishedAt?: string | null;
  viewCount?: string | null;
  likeCount?: string | null;
  url: string;
}

/**
 * Insert a video, ignoring if the id already exists. Returns true if inserted.
 */
export async function insertIgnore(data: VideoInsert): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    INSERT INTO videos (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
    VALUES (
      ${data.id},
      ${data.title},
      ${data.description ?? null},
      ${data.thumbnail ?? null},
      ${data.channelTitle ?? null},
      ${data.publishedAt ?? null},
      ${data.viewCount ?? null},
      ${data.likeCount ?? null},
      ${data.url}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Insert many videos. Returns the number of new rows added.
 */
export async function insertMany(videos: VideoInsert[]): Promise<number> {
  if (videos.length === 0) return 0;
  await ensureSchema();

  let added = 0;
  for (const v of videos) {
    if (!v.id) continue;
    const rows = await sql`
      INSERT INTO videos (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
      VALUES (
        ${v.id},
        ${v.title},
        ${v.description ?? null},
        ${v.thumbnail ?? null},
        ${v.channelTitle ?? null},
        ${v.publishedAt ?? null},
        ${v.viewCount ?? null},
        ${v.likeCount ?? null},
        ${v.url}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) added++;
  }
  return added;
}

/**
 * Evict oldest rows so the table has at most MAX_POOL_SIZE rows.
 */
export async function evictOldest(): Promise<void> {
  await ensureSchema();
  await sql`
    DELETE FROM videos WHERE id NOT IN (
      SELECT id FROM videos ORDER BY created_at DESC LIMIT ${MAX_POOL_SIZE}
    )
  `;
}

/**
 * Get the total row count.
 */
export async function count(): Promise<number> {
  await ensureSchema();
  const rows = await sql`SELECT count(*) as cnt FROM videos`;
  return parseInt(rows[0].cnt as string, 10);
}

/**
 * Get the most recent created_at value, or null if empty.
 */
export async function lastUpdatedAt(): Promise<string | null> {
  await ensureSchema();
  const rows = await sql`SELECT created_at FROM videos ORDER BY created_at DESC LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0].created_at as string;
}

/**
 * Get all videos ordered by newest first.
 */
export async function findAll(): Promise<VideoRow[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM videos ORDER BY created_at DESC`;
  return rows as VideoRow[];
}

/**
 * Get newest videos, limited.
 */
export async function findNewest(limit: number): Promise<VideoRow[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM videos ORDER BY created_at DESC LIMIT ${limit}`;
  return rows as VideoRow[];
}

/**
 * Search by terms using ILIKE. Returns up to `limit` rows matching any term in title or description.
 */
export async function searchByTerms(terms: string[], limit: number): Promise<VideoRow[]> {
  if (terms.length === 0) {
    return findNewest(limit);
  }
  await ensureSchema();

  // Build a dynamic OR condition with ILIKE patterns
  const patterns = terms.map((t) => `%${t}%`);
  const rows = await sql`
    SELECT * FROM videos
    WHERE title ILIKE ANY(${patterns}) OR description ILIKE ANY(${patterns})
    LIMIT ${limit}
  `;
  return rows as VideoRow[];
}

/**
 * Delete all rows and re-insert the given videos.
 */
export async function replaceAll(videos: VideoInsert[]): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM videos`;
  for (const v of videos) {
    if (!v.id) continue;
    await sql`
      INSERT INTO videos (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
      VALUES (
        ${v.id},
        ${v.title},
        ${v.description ?? null},
        ${v.thumbnail ?? null},
        ${v.channelTitle ?? null},
        ${v.publishedAt ?? null},
        ${v.viewCount ?? null},
        ${v.likeCount ?? null},
        ${v.url}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}
