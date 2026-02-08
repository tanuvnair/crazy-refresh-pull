import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, ErrorBoundary, onMount } from "solid-js";
import { ClientLogging } from "~/components/client-logging";
import { log } from "~/lib/logger";
import "./app.css";

export default function App() {
  onMount(() => {
    if (typeof import.meta.env.SSR === "boolean" && !import.meta.env.SSR) {
      log.info("client:hydrated");
    }
  });

  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>Crazy Refresh Pull</Title>
          <ClientLogging />
          <div class="min-h-screen bg-background">
            <ErrorBoundary
              fallback={(err) => {
                if (typeof import.meta.env.SSR === "boolean" && !import.meta.env.SSR) {
                  log.error("ErrorBoundary", { message: err.message, stack: err?.stack });
                }
                return (
                  <div class="flex flex-col items-center justify-center p-8 text-destructive">
                    <p class="font-semibold">Error: {err.message}</p>
                    {err.stack && <pre class="mt-2 max-w-full overflow-auto text-xs">{err.stack}</pre>}
                  </div>
                );
              }}
            >
              <Suspense>{props.children}</Suspense>
            </ErrorBoundary>
          </div>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
