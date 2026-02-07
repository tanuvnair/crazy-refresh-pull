import * as videosRepo from "~/db-repositories/videos";
import type { VideoRow } from "~/db-repositories/videos";
import type { Video } from "~/components/video-card";

export interface VideoPoolData {
  updatedAt: string;
  videos: Video[];
}

function rowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    thumbnail: row.thumbnail ?? "",
    channelTitle: row.channel_title ?? "",
    publishedAt: row.published_at ?? "",
    viewCount: row.view_count ?? undefined,
    likeCount: row.like_count ?? undefined,
    url: row.url,
  };
}

function videoToInsert(v: Video): { id: string; title: string; description?: string | null; thumbnail?: string | null; channelTitle?: string | null; publishedAt?: string | null; viewCount?: string | null; likeCount?: string | null; url: string } {
  return {
    id: v.id,
    title: v.title ?? "",
    description: v.description ?? null,
    thumbnail: v.thumbnail ?? null,
    channelTitle: v.channelTitle ?? null,
    publishedAt: v.publishedAt ?? null,
    viewCount: v.viewCount ?? null,
    likeCount: v.likeCount ?? null,
    url: v.url ?? "",
  };
}

/**
 * Read the entire video pool. Prefer searchPool() for large pools.
 */
export async function readPool(): Promise<VideoPoolData> {
  const rows = videosRepo.findAll();
  const lastRow = rows[0];
  return {
    updatedAt: lastRow?.created_at ?? new Date(0).toISOString(),
    videos: rows.map(rowToVideo),
  };
}

/**
 * Merge new videos into the pool by id. Enforces MAX_POOL_SIZE by evicting the oldest rows.
 */
export async function addToPool(newVideos: Video[]): Promise<{ added: number; total: number }> {
  const inserts = newVideos.filter((v) => v.id).map(videoToInsert);
  const added = videosRepo.insertMany(inserts);
  videosRepo.evictOldest();
  const total = videosRepo.count();
  return { added, total };
}

/**
 * Search pool by query. Returns up to limit results ranked by relevance.
 * The first parameter is accepted for backward compatibility but ignored; data comes from SQLite.
 */
export function searchPool(_pool: VideoPoolData | null, query: string, limit: number): Video[] {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length >= 2);
  const rows = videosRepo.searchByTerms(terms, limit);

  if (terms.length === 0) {
    return rows.map(rowToVideo);
  }

  // Re-rank by how many terms matched (SQLite LIKE doesn't produce a score)
  const scored = rows.map((row) => {
    const title = (row.title ?? "").toLowerCase();
    const desc = (row.description ?? "").toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 2;
      else if (desc.includes(t)) score += 1;
    }
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => rowToVideo(s.row));
}

/**
 * Get pool status for UI.
 */
export async function getPoolStatus(): Promise<{ count: number; updatedAt: string | null }> {
  const cnt = videosRepo.count();
  if (cnt === 0) {
    return { count: 0, updatedAt: null };
  }
  return { count: cnt, updatedAt: videosRepo.lastUpdatedAt() };
}

/**
 * Write the full pool (used only if needed for compatibility). Prefer addToPool().
 */
export async function writePool(data: VideoPoolData): Promise<void> {
  const inserts = data.videos.filter((v) => v.id).map(videoToInsert);
  videosRepo.replaceAll(inserts);
}
