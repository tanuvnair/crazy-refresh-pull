import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Label } from "~/components/ui";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui";
import { Search, Loader2, Key, Eye, EyeOff, X, Loader } from "lucide-solid";
import VideoCard, { type Video } from "~/components/video-card";
import { encryptApiKey, decryptApiKey } from "~/lib/encryption";
import { getApiKeyFromCookie, saveApiKeyToCookie } from "~/lib/cookie";

const API_KEY_STORAGE_KEY = "youtube_api_key_encrypted";

export default function Home() {
  const [apiKey, setApiKey] = createSignal("");
  const [showApiKey, setShowApiKey] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [videos, setVideos] = createSignal<Video[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load API key from cookie first, then sessionStorage on mount
  onMount(() => {
    try {
      // Try cookie first
      let encrypted = getApiKeyFromCookie();

      // Fallback to sessionStorage if cookie doesn't exist
      if (!encrypted) {
        encrypted = sessionStorage.getItem(API_KEY_STORAGE_KEY);
      }

      if (encrypted) {
        const decrypted = decryptApiKey(encrypted);
        if (decrypted) {
          setApiKey(decrypted);
        }
      }
    } catch (err) {
      console.error("Failed to load API key from storage:", err);
    }
  });

  // Save API key to both cookie and sessionStorage when it changes (encrypted)
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    try {
      if (value.trim()) {
        const encrypted = encryptApiKey(value);
        sessionStorage.setItem(API_KEY_STORAGE_KEY, encrypted);
        saveApiKeyToCookie(encrypted);
      } else {
        sessionStorage.removeItem(API_KEY_STORAGE_KEY);
        saveApiKeyToCookie("");
      }
    } catch (err) {
      console.error("Failed to save API key to storage:", err);
    }
  };

  // Clear API key
  const handleClearApiKey = () => {
    setApiKey("");
    try {
      sessionStorage.removeItem(API_KEY_STORAGE_KEY);
      saveApiKeyToCookie("");
    } catch (err) {
      console.error("Failed to clear API key:", err);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    const key = apiKey().trim();

    if (!key) {
      setError("Please enter your YouTube API key");
      return;
    }

    if (!query) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);
    setVideos([]);

    try {
      const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}&maxResults=50&apiKey=${encodeURIComponent(key)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      setVideos(data.videos || []);
      if (data.videos && data.videos.length === 0) {
        setError("No authentic videos found. Try a different search term.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while searching");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <>
      <Title>Crazy Refresh Pull</Title>

      <main class="flex min-h-screen items-start justify-center py-8 px-4">
        <div class="mx-auto max-w-7xl w-full flex flex-col gap-12">
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Enter your YouTube API key and search preferences to find amazing refresh pulls
              </CardDescription>
            </CardHeader>

            <CardContent class="flex flex-col gap-8">
              <div class="flex flex-col gap-4">
                <Label
                  for="api-key"
                >
                  <Key class="h-4 w-4 text-primary" />
                  YouTube API Key
                </Label>

                <div class="flex flex-row gap-2">
                  <div class="relative flex-1">
                    <Input
                      type={showApiKey() ? "text" : "password"}
                      placeholder="Enter your YouTube Data API v3 key"
                      class="w-full pr-20"
                      value={apiKey()}
                      onInput={(e) => handleApiKeyChange(e.currentTarget.value)}
                      disabled={loading()}
                    />
                    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowApiKey(!showApiKey())}
                        title={showApiKey() ? "Hide API key" : "Show API key"}
                        disabled={loading()}
                      >
                        {showApiKey() ? (
                          <EyeOff class="text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Eye class="text-muted-foreground hover:text-foreground" />
                        )}
                      </Button>

                      {apiKey() && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleClearApiKey}
                          title="Clear API key"
                          disabled={loading()}
                        >
                          <X class="text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <p class="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline"
                  >
                    Google Cloud Console
                  </a>

                  <span class="text-xs text-muted-foreground">
                    .{" "}We do not store your API key. It is encrypted and stored in your browser locally.
                  </span>
                </p>
              </div>

              <div class="flex flex-col gap-4">
                <Label
                  for="search-query"
                >
                  <Search class="h-4 w-4 text-primary" />
                  Enter keyword or topic to search for
                </Label>

                <div class="flex flex-row gap-4">
                  <Input
                    type="text"
                    placeholder="Search for YouTube content..."
                    class="w-full"
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading() || !apiKey().trim()}
                  />

                  <Button
                    size="lg"
                    onClick={handleSearch}
                    disabled={loading() || !apiKey().trim()}
                  >
                    {loading() ? (
                      <>
                        <Loader class="animate-spin" />
                      </>
                    ) : (
                      <>
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {error() && (
                  <div class="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {error()}
                  </div>
                )}
              </div>


            </CardContent>
          </Card>

          {videos().length > 0 && (
            <div class="flex flex-col gap-6">
              <h2 class="text-2xl font-semibold">
                Found {videos().length} {videos().length === 1 ? "video" : "videos"}
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos().map((video) => (
                  <VideoCard video={video} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
