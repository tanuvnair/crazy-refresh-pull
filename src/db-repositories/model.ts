import { sql, ensureSchema } from "~/services/db.server";

/**
 * Get a value from the model key-value table.
 */
export async function getValue(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = await sql`SELECT value FROM model WHERE key = ${key}`;
  if (rows.length === 0) return null;
  return rows[0].value as string;
}

/**
 * Set a value in the model key-value table.
 */
export async function setValue(key: string, value: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO model (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

/**
 * Delete a key from the model table.
 */
export async function deleteKey(key: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM model WHERE key = ${key}`;
}
