import { prisma } from "~/services/db.server";

/**
 * Get a value from the model key-value table.
 */
export async function getValue(key: string): Promise<string | null> {
  const row = await prisma.keyValueModel.findUnique({ where: { key } });
  if (!row) return null;
  return row.value;
}

/**
 * Set a value in the model key-value table.
 */
export async function setValue(key: string, value: string): Promise<void> {
  await prisma.keyValueModel.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Delete a key from the model table.
 */
export async function deleteKey(key: string): Promise<void> {
  await prisma.keyValueModel.deleteMany({ where: { key } });
}
