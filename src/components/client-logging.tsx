import { useLocation } from "@solidjs/router";
import { createEffect } from "solid-js";
import { log } from "~/lib/logger";

/**
 * Logs client-side navigation and hydration. Renders nothing.
 * Only runs in the browser (no-op during SSR).
 */
export function ClientLogging() {
  const location = useLocation();

  createEffect(() => {
    if (typeof import.meta.env.SSR === "boolean" && import.meta.env.SSR) return;
    log.info("navigation", {
      path: location.pathname,
      search: location.search || undefined,
    });
  });

  return null;
}
