import { Title } from "@solidjs/meta";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui";
import { Search } from "lucide-solid";

export default function Home() {
  return (
    <>
      <Title>Crazy Refresh Pull</Title>

      <main class="flex min-h-screen items-center justify-center">
        <div class="mx-auto max-w-4xl w-full flex flex-col gap-12">
          <div class="text-center flex flex-col gap-3">
            <h1 class="text-6xl font-bold tracking-[-0.03em] text-foreground leading-[1.1]">
              Crazy Refresh Pull
            </h1>
            <p class="text-xl font-normal text-muted-foreground leading-[28px] max-w-2xl mx-auto">
              Discover insane YouTube refresh pulls based on what you watch
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Enter your YouTube preferences to find amazing refresh pulls
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div class="flex flex-row gap-4">
                <Input
                  type="text"
                  placeholder="Search for YouTube content..."
                  class="w-full"
                />

                <Button size="lg">
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
