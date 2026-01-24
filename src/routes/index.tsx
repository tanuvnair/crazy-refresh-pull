import { Title } from "@solidjs/meta";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui";

export default function Home() {
  return (
    <>
      <Title>Crazy Refresh Pull</Title>

      <main class="py-16">
        <div class="mx-auto max-w-4xl">
          <div class="mb-20 text-center">
            <h1 class="mb-6 text-6xl font-bold tracking-[-0.03em] text-foreground leading-[1.1]">
              Crazy Refresh Pull
            </h1>
            <p class="text-[21px] font-normal text-muted-foreground leading-[28px] max-w-2xl mx-auto">
              Discover insane YouTube refresh pulls based on what you watch
            </p>
          </div>

          <div class="mb-12">
            <Card>
              <CardHeader>
                <CardTitle>Get Started</CardTitle>
                <CardDescription>
                  Enter your YouTube preferences to find amazing refresh pulls
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div class="flex flex-col gap-6">
                  <Input
                    type="text"
                    placeholder="Search for YouTube content..."
                    class="w-full"
                  />
                  <div class="flex justify-end">
                    <Button size="lg">Search</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
