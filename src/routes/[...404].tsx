import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { A } from "@solidjs/router";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from "~/components/ui";
import { Button } from "~/components/ui";

export default function NotFound() {
  return (
    <>
      <Title>Page Not Found - Crazy Refresh Pull</Title>
      <HttpStatusCode code={404} />

      <main class="flex min-h-screen items-center justify-center px-4">
        <Card>
          <CardHeader class="gap-2 text-center">
            <CardTitle>Page Not Found</CardTitle>
            <CardDescription>
              The page you're looking for doesn't exist
            </CardDescription>
          </CardHeader>

          <CardFooter class="justify-center gap-2">
            <A href={window.location.href}>
              <Button variant="outline">Refresh Page</Button>
            </A>
            <A href="/">
              <Button>Go Back Home</Button>
            </A>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
