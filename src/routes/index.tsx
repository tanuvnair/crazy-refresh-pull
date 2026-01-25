import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Label, Checkbox } from "~/components/ui";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui";
import { Search, Loader2, Key, Eye, EyeOff, X, Loader, Sparkles } from "lucide-solid";
import VideoCard, { type Video } from "~/components/video-card";
import { encryptApiKey, decryptApiKey } from "~/lib/encryption";
import { getYouTubeApiKeyFromCookie, saveYouTubeApiKeyToCookie, getGeminiApiKeyFromCookie, saveGeminiApiKeyToCookie } from "~/lib/cookie";

const YOUTUBE_API_KEY_STORAGE_KEY = "youtube_api_key_encrypted";
const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key_encrypted";
const USE_GEMINI_FILTERING_KEY = "use_gemini_filtering";

export default function Home() {
  const [youtubeApiKey, setYoutubeApiKey] = createSignal("");
  const [geminiApiKey, setGeminiApiKey] = createSignal("");
  const [showYoutubeApiKey, setShowYoutubeApiKey] = createSignal(false);
  const [showGeminiApiKey, setShowGeminiApiKey] = createSignal(false);
  const [useGeminiFiltering, setUseGeminiFiltering] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [videos, setVideos] = createSignal<Video[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load API keys and settings from storage on mount
  onMount(() => {
    try {
      // Load YouTube API key
      let encrypted = getYouTubeApiKeyFromCookie();
      if (!encrypted) {
        encrypted = sessionStorage.getItem(YOUTUBE_API_KEY_STORAGE_KEY);
      }
      if (encrypted) {
        const decrypted = decryptApiKey(encrypted);
        if (decrypted) {
          setYoutubeApiKey(decrypted);
        }
      }

      // Load Gemini API key
      let geminiEncrypted = getGeminiApiKeyFromCookie();
      if (!geminiEncrypted) {
        geminiEncrypted = sessionStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
      }
      if (geminiEncrypted) {
        const decrypted = decryptApiKey(geminiEncrypted);
        if (decrypted) {
          setGeminiApiKey(decrypted);
        }
      }

      // Load Gemini filtering preference
      const useGemini = sessionStorage.getItem(USE_GEMINI_FILTERING_KEY);
      if (useGemini === "true") {
        setUseGeminiFiltering(true);
      }
    } catch (err) {
      console.error("Failed to load API keys from storage:", err);
    }
  });

  // Save YouTube API key to both cookie and sessionStorage when it changes (encrypted)
  const handleYoutubeApiKeyChange = (value: string) => {
    setYoutubeApiKey(value);
    try {
      if (value.trim()) {
        const encrypted = encryptApiKey(value);
        sessionStorage.setItem(YOUTUBE_API_KEY_STORAGE_KEY, encrypted);
        saveYouTubeApiKeyToCookie(encrypted);
      } else {
        sessionStorage.removeItem(YOUTUBE_API_KEY_STORAGE_KEY);
        saveYouTubeApiKeyToCookie("");
      }
    } catch (err) {
      console.error("Failed to save YouTube API key to storage:", err);
    }
  };

  // Save Gemini API key to both cookie and sessionStorage when it changes (encrypted)
  const handleGeminiApiKeyChange = (value: string) => {
    setGeminiApiKey(value);
    try {
      if (value.trim()) {
        const encrypted = encryptApiKey(value);
        sessionStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, encrypted);
        saveGeminiApiKeyToCookie(encrypted);
      } else {
        sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
        saveGeminiApiKeyToCookie("");
      }
    } catch (err) {
      console.error("Failed to save Gemini API key to storage:", err);
    }
  };

  // Toggle Gemini filtering
  const handleGeminiFilteringToggle = (enabled: boolean) => {
    setUseGeminiFiltering(enabled);
    sessionStorage.setItem(USE_GEMINI_FILTERING_KEY, enabled.toString());
  };

  // Clear YouTube API key
  const handleClearYoutubeApiKey = () => {
    setYoutubeApiKey("");
    try {
      sessionStorage.removeItem(YOUTUBE_API_KEY_STORAGE_KEY);
      saveYouTubeApiKeyToCookie("");
    } catch (err) {
      console.error("Failed to clear YouTube API key:", err);
    }
  };

  // Clear Gemini API key
  const handleClearGeminiApiKey = () => {
    setGeminiApiKey("");
    try {
      sessionStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      saveGeminiApiKeyToCookie("");
    } catch (err) {
      console.error("Failed to clear Gemini API key:", err);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    const youtubeKey = youtubeApiKey().trim();
    const geminiKey = geminiApiKey().trim();
    const useGemini = useGeminiFiltering();

    if (!youtubeKey) {
      setError("Please enter your YouTube API key");
      return;
    }

    if (useGemini && !geminiKey) {
      setError("Please enter your Gemini API key to use AI filtering");
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
      const params = new URLSearchParams({
        q: query,
        maxResults: "50",
        apiKey: youtubeKey,
      });

      if (useGemini && geminiKey) {
        params.set("geminiApiKey", geminiKey);
        params.set("useGeminiFiltering", "true");
      }

      const response = await fetch(`/api/youtube?${params.toString()}`);
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
                  for="youtube-api-key"
                >
                  <Key class="h-4 w-4 text-primary" />
                  YouTube API Key
                </Label>

                <div class="flex flex-row gap-2">
                  <div class="relative flex-1">
                    <Input
                      id="youtube-api-key"
                      type={showYoutubeApiKey() ? "text" : "password"}
                      placeholder="Enter your YouTube Data API v3 key"
                      class="w-full pr-20"
                      value={youtubeApiKey()}
                      onInput={(e) => handleYoutubeApiKeyChange(e.currentTarget.value)}
                      disabled={loading()}
                    />
                    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowYoutubeApiKey(!showYoutubeApiKey())}
                        title={showYoutubeApiKey() ? "Hide API key" : "Show API key"}
                        disabled={loading()}
                      >
                        {showYoutubeApiKey() ? (
                          <EyeOff class="text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Eye class="text-muted-foreground hover:text-foreground" />
                        )}
                      </Button>

                      {youtubeApiKey() && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleClearYoutubeApiKey}
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
                  for="gemini-api-key"
                >
                  <Sparkles class="h-4 w-4 text-primary" />
                  Gemini API Key
                </Label>

                <div class="flex flex-row gap-2">
                  <div class="relative flex-1">
                    <Input
                      id="gemini-api-key"
                      type={showGeminiApiKey() ? "text" : "password"}
                      placeholder="Enter your Google Gemini API key"
                      class="w-full pr-20"
                      value={geminiApiKey()}
                      onInput={(e) => handleGeminiApiKeyChange(e.currentTarget.value)}
                      disabled={loading()}
                    />
                    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowGeminiApiKey(!showGeminiApiKey())}
                        title={showGeminiApiKey() ? "Hide API key" : "Show API key"}
                        disabled={loading()}
                      >
                        {showGeminiApiKey() ? (
                          <EyeOff class="text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Eye class="text-muted-foreground hover:text-foreground" />
                        )}
                      </Button>

                      {geminiApiKey() && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleClearGeminiApiKey}
                          title="Clear API key"
                          disabled={loading()}
                        >
                          <X class="text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <Checkbox
                    id="use-gemini-filtering"
                    checked={useGeminiFiltering()}
                    onChange={(e) => handleGeminiFilteringToggle(e.currentTarget.checked)}
                    disabled={loading() || !geminiApiKey().trim()}
                  />

                  <Label
                    for="use-gemini-filtering"
                    class="text-sm font-normal cursor-pointer"
                    selectable={false}
                  >
                    Use AI-powered content filtering (requires Gemini API key)
                  </Label>
                </div>

                <p class="text-xs text-muted-foreground">
                  Get your Gemini API key from{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                  <span class="text-xs text-muted-foreground">
                    .{" "}Gemini analyzes video content to identify authentic vs. manufactured content.
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
                    id="search-query"
                    type="text"
                    placeholder="Search for YouTube content..."
                    class="w-full"
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading() || !youtubeApiKey().trim()}
                  />

                  <Button
                    size="lg"
                    onClick={handleSearch}
                    disabled={loading() || !youtubeApiKey().trim()}
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
