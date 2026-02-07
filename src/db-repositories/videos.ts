import { getDb, MAX_POOL_SIZE } from "~/services/db.server";

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
export function insertIgnore(data: VideoInsert): boolean {
  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO videos
        (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.title,
      data.description ?? null,
      data.thumbnail ?? null,
      data.channelTitle ?? null,
      data.publishedAt ?? null,
      data.viewCount ?? null,
      data.likeCount ?? null,
      data.url
    );
  return info.changes > 0;
}

/**
 * Insert many videos in a transaction. Returns the number of new rows added.
 */
export function insertMany(videos: VideoInsert[]): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO videos
      (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let added = 0;
  const tx = db.transaction(() => {
    for (const v of videos) {
      if (!v.id) continue;
      const info = stmt.run(
        v.id,
        v.title,
        v.description ?? null,
        v.thumbnail ?? null,
        v.channelTitle ?? null,
        v.publishedAt ?? null,
        v.viewCount ?? null,
        v.likeCount ?? null,
        v.url
      );
      if (info.changes > 0) added++;
    }
  });
  tx();
  return added;
}

/**
 * Evict oldest rows so the table has at most MAX_POOL_SIZE rows.
 */
export function evictOldest(): void {
  getDb()
    .prepare(
      `DELETE FROM videos WHERE id NOT IN (
        SELECT id FROM videos ORDER BY created_at DESC LIMIT ?
      )`
    )
    .run(MAX_POOL_SIZE);
}

/**
 * Get the total row count.
 */
export function count(): number {
  return (getDb().prepare("SELECT count(*) as cnt FROM videos").get() as { cnt: number }).cnt;
}

/**
 * Get the most recent created_at value, or null if empty.
 */
export function lastUpdatedAt(): string | null {
  const row = getDb()
    .prepare("SELECT created_at FROM videos ORDER BY created_at DESC LIMIT 1")
    .get() as { created_at: string } | undefined;
  return row?.created_at ?? null;
}

/**
 * Get all videos ordered by newest first.
 */
export function findAll(): VideoRow[] {
  return getDb()
    .prepare("SELECT * FROM videos ORDER BY created_at DESC")
    .all() as VideoRow[];
}

/**
 * Get newest videos, limited.
 */
export function findNewest(limit: number): VideoRow[] {
  return getDb()
    .prepare("SELECT * FROM videos ORDER BY created_at DESC LIMIT ?")
    .all(limit) as VideoRow[];
}

/**
 * Search by terms using LIKE. Returns up to `limit` rows matching any term in title or description.
 */
export function searchByTerms(terms: string[], limit: number): VideoRow[] {
  if (terms.length === 0) {
    return findNewest(limit);
  }

  const conditions = terms.map(() => "(LOWER(title) LIKE ? OR LOWER(description) LIKE ?)");
  const whereClause = conditions.join(" OR ");
  const params: Array<string | number> = [];
  for (const t of terms) {
    const like = `%${t}%`;
    params.push(like, like);
  }
  params.push(limit);

  return getDb()
    .prepare(`SELECT * FROM videos WHERE ${whereClause} LIMIT ?`)
    .all(...params) as VideoRow[];
}

/**
 * Delete all rows and re-insert the given videos in a transaction.
 */
export function replaceAll(videos: VideoInsert[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM videos").run();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO videos
        (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const v of videos) {
      if (!v.id) continue;
      stmt.run(
        v.id,
        v.title,
        v.description ?? null,
        v.thumbnail ?? null,
        v.channelTitle ?? null,
        v.publishedAt ?? null,
        v.viewCount ?? null,
        v.likeCount ?? null,
        v.url
      );
    }
  });
  tx();
}
