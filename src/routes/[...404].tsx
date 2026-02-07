import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { A } from "@solidjs/router";
import { Button, Card, CardHeader, CardTitle, CardFooter, Text } from "~/components/ui";

export default function NotFound() {
  return (
    <>
      <Title>Page Not Found - Crazy Refresh Pull</Title>
      <HttpStatusCode code={404} />

      <main class="flex min-h-screen items-center justify-center px-4">
        <Card class="max-w-sm w-full">
          <CardHeader class="gap-2 text-center">
            <CardTitle>Page Not Found</CardTitle>
            <Text variant="subheadline" muted>
              The page you're looking for doesn't exist.
            </Text>
          </CardHeader>

          <CardFooter class="justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <A href="/">
              <Button>Go Back Home</Button>
            </A>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
