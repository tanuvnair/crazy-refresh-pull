import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "app.db");

/** Maximum number of videos kept in the pool. Oldest are evicted when exceeded. */
export const MAX_POOL_SIZE = 3000;

let db: Database.Database | null = null;

/**
 * Get (or create) the singleton database connection and ensure all tables exist.
 */
export function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  createSchema(db);
  migrateOldFiles(db);

  return db;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id           TEXT    PRIMARY KEY,
      sentiment    TEXT    NOT NULL CHECK(sentiment IN ('positive', 'negative')),
      title        TEXT,
      description  TEXT,
      channel_title TEXT,
      published_at TEXT,
      view_count   TEXT,
      like_count   TEXT,
      url          TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);

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
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS model (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ---------- One-time migration from old flat files ----------

const MIGRATION_KEY = "flat_files_migrated";

function migrateOldFiles(db: Database.Database): void {
  // Check if already migrated
  const row = db.prepare("SELECT value FROM model WHERE key = ?").get(MIGRATION_KEY) as
    | { value: string }
    | undefined;
  if (row) return;

  const tx = db.transaction(() => {
    migrateFeedbackFile(db, join(DATA_DIR, "positive-feedback.txt"), "positive");
    migrateFeedbackFile(db, join(DATA_DIR, "negative-feedback.txt"), "negative");
    migrateVideoPool(db, join(DATA_DIR, "video-pool.json"));
    migrateModelJson(db, join(DATA_DIR, "recommendation-model.json"));

    db.prepare("INSERT OR REPLACE INTO model (key, value) VALUES (?, ?)").run(
      MIGRATION_KEY,
      new Date().toISOString()
    );
  });
  tx();

  console.log("Migrated old flat files into SQLite database.");
}

function migrateFeedbackFile(db: Database.Database, filePath: string, sentiment: string): void {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO feedback (id, sentiment, title, description, channel_title, published_at, view_count, like_count, url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const line of lines) {
      try {
        const m = JSON.parse(line);
        if (m.id) {
          stmt.run(
            m.id,
            sentiment,
            m.title ?? null,
            m.description ?? null,
            m.channelTitle ?? null,
            m.publishedAt ?? null,
            m.viewCount ?? null,
            m.likeCount ?? null,
            m.url ?? null
          );
        }
      } catch {
        if (line.length > 0) {
          stmt.run(line, sentiment, null, null, null, null, null, null, null);
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to migrate ${filePath}:`, err);
  }
}

function migrateVideoPool(db: Database.Database, filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    if (!Array.isArray(data.videos)) return;
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO videos (id, title, description, thumbnail, channel_title, published_at, view_count, like_count, url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of data.videos) {
      if (!v.id) continue;
      stmt.run(
        v.id,
        v.title ?? "",
        v.description ?? null,
        v.thumbnail ?? null,
        v.channelTitle ?? null,
        v.publishedAt ?? null,
        v.viewCount ?? null,
        v.likeCount ?? null,
        v.url ?? ""
      );
    }
  } catch (err) {
    console.warn(`Failed to migrate ${filePath}:`, err);
  }
}

function migrateModelJson(db: Database.Database, filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    const content = readFileSync(filePath, "utf-8");
    // Store the entire JSON blob under a single key
    db.prepare("INSERT OR REPLACE INTO model (key, value) VALUES (?, ?)").run(
      "recommendation_model",
      content
    );
  } catch (err) {
    console.warn(`Failed to migrate ${filePath}:`, err);
  }
}
