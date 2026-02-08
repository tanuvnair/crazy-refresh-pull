import { createMiddleware } from "@solidjs/start/middleware";
import type { FetchEvent } from "@solidjs/start/server";
import { log } from "~/lib/logger";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-api-key",
  "proxy-authorization",
]);

function safeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = value;
    }
  });
  return out;
}

export default createMiddleware({
  onRequest(event: FetchEvent): void {
    const startTime = Date.now();
    (event.locals as { startTime?: number }).startTime = startTime;

    const url = new URL(event.request.url);
    log.info("request", {
      phase: "request",
      method: event.request.method,
      path: url.pathname,
      search: url.search || undefined,
      clientAddress: event.clientAddress ?? undefined,
      userAgent: event.request.headers.get("user-agent") ?? undefined,
      referer: event.request.headers.get("referer") ?? undefined,
      headers: safeHeaders(event.request.headers),
    });
  },

  onBeforeResponse(
    event: FetchEvent,
    _responseParam: { body?: unknown }
  ): void {
    const startTime = (event.locals as { startTime?: number }).startTime;
    const durationMs =
      typeof startTime === "number" ? Date.now() - startTime : undefined;

    const url = new URL(event.request.url);
    log.info("response", {
      phase: "response",
      method: event.request.method,
      path: url.pathname,
      search: url.search || undefined,
      status: event.response.status,
      statusText: event.response.statusText,
      durationMs,
      clientAddress: event.clientAddress ?? undefined,
      responseHeaders: safeHeaders(event.response.headers),
    });
  },
});
