import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, ErrorBoundary } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>Crazy Refresh Pull</Title>
          <div class="min-h-screen bg-background">
            <ErrorBoundary
              fallback={(err) => (
                <div class="flex flex-col items-center justify-center p-8 text-destructive">
                  <p class="font-semibold">Error: {err.message}</p>
                  {err.stack && <pre class="mt-2 max-w-full overflow-auto text-xs">{err.stack}</pre>}
                </div>
              )}
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
