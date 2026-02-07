import { getDb } from "~/services/db.server";

/**
 * Get a value from the model key-value table.
 */
export function getValue(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM model WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * Set a value in the model key-value table.
 */
export function setValue(key: string, value: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO model (key, value) VALUES (?, ?)")
    .run(key, value);
}

/**
 * Delete a key from the model table.
 */
export function deleteKey(key: string): void {
  getDb().prepare("DELETE FROM model WHERE key = ?").run(key);
}
