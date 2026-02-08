import { prisma } from "~/services/db.server";
import type { Video as VideoRow } from "../../prisma/generated/prisma/client";
import { Prisma } from "../../prisma/generated/prisma/client";

export type { Video as VideoRow } from "../../prisma/generated/prisma/client";

/** Maximum number of videos kept in the pool. Oldest are evicted when exceeded. */
export const MAX_POOL_SIZE = 3000;

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
  const result = await prisma.video.createMany({
    data: [
      {
        id: data.id,
        title: data.title,
        description: data.description ?? null,
        thumbnail: data.thumbnail ?? null,
        channelTitle: data.channelTitle ?? null,
        publishedAt: data.publishedAt ?? null,
        viewCount: data.viewCount ?? null,
        likeCount: data.likeCount ?? null,
        url: data.url,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

/**
 * Insert many videos. Returns the number of new rows added.
 */
export async function insertMany(videos: VideoInsert[]): Promise<number> {
  if (videos.length === 0) return 0;

  const data = videos
    .filter((v) => v.id)
    .map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description ?? null,
      thumbnail: v.thumbnail ?? null,
      channelTitle: v.channelTitle ?? null,
      publishedAt: v.publishedAt ?? null,
      viewCount: v.viewCount ?? null,
      likeCount: v.likeCount ?? null,
      url: v.url,
    }));

  const result = await prisma.video.createMany({
    data,
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Evict oldest rows so the table has at most MAX_POOL_SIZE rows.
 */
export async function evictOldest(): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "Video" WHERE id NOT IN (
      SELECT id FROM "Video" ORDER BY "createdAt" DESC LIMIT ${MAX_POOL_SIZE}
    )
  `;
}

/**
 * Get the total row count.
 */
export async function count(): Promise<number> {
  return prisma.video.count();
}

/**
 * Get the most recent createdAt value, or null if empty.
 */
export async function lastUpdatedAt(): Promise<string | null> {
  const row = await prisma.video.findFirst({
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return row.createdAt.toISOString();
}

/**
 * Get all videos ordered by newest first.
 */
export async function findAll(): Promise<VideoRow[]> {
  return prisma.video.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get newest videos, limited.
 */
export async function findNewest(limit: number): Promise<VideoRow[]> {
  return prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** All video columns for raw queries. */
const VIDEO_COLUMNS = Prisma.raw(
  `id, title, description, thumbnail, "channelTitle", "publishedAt", "viewCount", "likeCount", url, "createdAt"`
);

/**
 * Get random videos from the pool for the feed. Optionally exclude given IDs.
 */
export async function findRandom(
  limit: number,
  excludeIds?: string[],
): Promise<VideoRow[]> {
  if (excludeIds && excludeIds.length > 0) {
    return prisma.$queryRaw<VideoRow[]>`
      SELECT ${VIDEO_COLUMNS} FROM "Video"
      WHERE NOT (id = ANY(${excludeIds}))
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
  }
  return prisma.$queryRaw<VideoRow[]>`
    SELECT ${VIDEO_COLUMNS} FROM "Video"
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
}

/**
 * Search by terms using case-insensitive matching. Returns up to `limit` rows
 * matching any term in title or description.
 */
export async function searchByTerms(
  terms: string[],
  limit: number,
): Promise<VideoRow[]> {
  if (terms.length === 0) {
    return findNewest(limit);
  }

  const orConditions: Prisma.VideoWhereInput[] = terms.flatMap((term) => [
    { title: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  return prisma.video.findMany({
    where: { OR: orConditions },
    take: limit,
  });
}

/**
 * Delete all rows and re-insert the given videos.
 */
export async function replaceAll(videos: VideoInsert[]): Promise<void> {
  const data = videos
    .filter((v) => v.id)
    .map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description ?? null,
      thumbnail: v.thumbnail ?? null,
      channelTitle: v.channelTitle ?? null,
      publishedAt: v.publishedAt ?? null,
      viewCount: v.viewCount ?? null,
      likeCount: v.likeCount ?? null,
      url: v.url,
    }));

  await prisma.$transaction([
    prisma.video.deleteMany(),
    prisma.video.createMany({ data, skipDuplicates: true }),
  ]);
}
