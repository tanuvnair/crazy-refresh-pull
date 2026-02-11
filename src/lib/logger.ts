/**
 * Shared structured logger for server and client.
 * Outputs JSON with timestamp, level, source (server|client), message, and optional meta.
 */

const SOURCE =
  typeof import.meta !== "undefined" && import.meta.env?.SSR
    ? "server"
    : "client";

function timestamp(): string {
  return new Date().toISOString();
}

function serializeMeta(meta: unknown): Record<string, unknown> {
  if (meta === undefined || meta === null) return {};
  if (typeof meta === "object" && !Array.isArray(meta))
    return meta as Record<string, unknown>;
  return { value: meta };
}

function write(level: string, message: string, meta?: unknown): void {
  const payload = {
    timestamp: timestamp(),
    level,
    source: SOURCE,
    message,
    ...serializeMeta(meta),
  };
  const line = JSON.stringify(payload);
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const log = {
  info(message: string, meta?: unknown): void {
    write("info", message, meta);
  },
  warn(message: string, meta?: unknown): void {
    write("warn", message, meta);
  },
  error(message: string, meta?: unknown): void {
    write("error", message, meta);
  },
};
