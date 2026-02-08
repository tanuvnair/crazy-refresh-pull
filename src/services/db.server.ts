import { neon } from "@netlify/neon";
import { log } from "~/lib/logger";

/**
 * Neon PostgreSQL client. Reads NETLIFY_DATABASE_URL automatically.
 */
export const sql = neon();

let schemaInitialized = false;

/**
 * Ensure all tables exist. Safe to call multiple times; only runs DDL once.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;

  log.info("db: ensuring schema (first run)");
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id            TEXT    PRIMARY KEY,
      sentiment     TEXT    NOT NULL CHECK(sentiment IN ('positive', 'negative')),
      title         TEXT,
      description   TEXT,
      channel_title TEXT,
      published_at  TEXT,
      view_count    TEXT,
      like_count    TEXT,
      url           TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS videos (
      id            TEXT    PRIMARY KEY,
      title         TEXT    NOT NULL,
      description   TEXT,
      thumbnail     TEXT,
      channel_title TEXT,
      published_at  TEXT,
      view_count    TEXT,
      like_count    TEXT,
      url           TEXT    NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS model (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  schemaInitialized = true;
  log.info("db: schema ready");
}
