import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Label, Checkbox } from "~/components/ui";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui";
import { Search, Loader2, Key, Eye, EyeOff, X, Loader, Brain, Save, Heart, Plus, Settings, Sparkles, Database } from "lucide-solid";
import VideoCard, { type Video } from "~/components/video-card";
import { encryptApiKey, decryptApiKey } from "~/lib/encryption";
import { getYouTubeApiKeyFromCookie, saveYouTubeApiKeyToCookie } from "~/lib/cookie";

const YOUTUBE_API_KEY_STORAGE_KEY = "youtube_api_key_encrypted";
const USE_CUSTOM_FILTERING_KEY = "use_custom_filtering";
const FILTER_SETTINGS_KEY = "filter_settings";

interface FilterSettings {
  authenticityThreshold: number; // 0-1, default 0.4
  maxPagesToSearch: number; // default 20
  maxTotalVideosToFetch: number; // default 1000
  minVideoDurationSeconds: number; // default 60
}

// Module-level flag to track if component has been mounted before (for HMR)
let hasMountedBefore = false;

export default function Home() {
  const [youtubeApiKey, setYoutubeApiKey] = createSignal("");
  const [showYoutubeApiKey, setShowYoutubeApiKey] = createSignal(false);
  const [useCustomFiltering, setUseCustomFiltering] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [videos, setVideos] = createSignal<Video[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [favoriteVideoUrl, setFavoriteVideoUrl] = createSignal("");
  const [addingFavorite, setAddingFavorite] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [modelStatus, setModelStatus] = createSignal<{
    available: boolean;
    positiveCount: number;
    negativeCount: number;
    trainedAt: string | null;
  } | null>(null);
  const [trainingModel, setTrainingModel] = createSignal(false);
  const [poolStatus, setPoolStatus] = createSignal<{ count: number; updatedAt: string | null } | null>(null);
  const [seedingPool, setSeedingPool] = createSignal(false);
  const [poolSeedQueries, setPoolSeedQueries] = createSignal("documentary, cooking, travel");
  const [poolPagesPerQuery, setPoolPagesPerQuery] = createSignal(2);
  // YouTube API quota limits:
  // - Default daily quota: 10,000 units
  // - search.list: 100 units per request
  // - videos.list: 1 unit per request (up to 50 videos)
  // - Each page: ~101 units (1 search + 1 videos.list)
  // - Max pages per day: ~99 pages (10,000 / 101)
  // - Max videos per day: ~4,950 videos (99 pages * 50)
  // Defaults are conservative to allow multiple searches per day
  const [filterSettings, setFilterSettings] = createSignal<FilterSettings>({
    authenticityThreshold: 0.4,
    maxPagesToSearch: 20, // ~2,020 units per search (allows ~4-5 searches per day)
    maxTotalVideosToFetch: 1000, // Conservative limit per search
    minVideoDurationSeconds: 60,
  });

  // Load API keys and settings from storage on mount
  onMount(async () => {
    // Only clear error and videos on actual page load, not on hot reload
    // This prevents search results from disappearing during HMR
    if (!hasMountedBefore) {
      setError(null);
      setVideos([]);
      hasMountedBefore = true;
    }

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

      // Load custom filtering preference
      const useCustom = sessionStorage.getItem(USE_CUSTOM_FILTERING_KEY);
      if (useCustom !== null) {
        setUseCustomFiltering(useCustom === "true");
      }

      // Load filter settings
      // Load recommendation model status
      try {
        const statusRes = await fetch("/api/train-model");
        if (statusRes.ok) {
          const data = await statusRes.json();
          setModelStatus({
            available: data.available ?? false,
            positiveCount: data.positiveCount ?? 0,
            negativeCount: data.negativeCount ?? 0,
            trainedAt: data.trainedAt ?? null,
          });
        }
      } catch {
        // Ignore
      }

      try {
        const poolRes = await fetch("/api/pool");
        if (poolRes.ok) {
          const data = await poolRes.json();
          setPoolStatus({ count: data.count ?? 0, updatedAt: data.updatedAt ?? null });
        }
      } catch {
        // Ignore
      }

      const settingsJson = sessionStorage.getItem(FILTER_SETTINGS_KEY);
      if (settingsJson) {
        try {
          const settings = JSON.parse(settingsJson) as FilterSettings;
          // Clamp values to respect YouTube API quota limits
          const clampedSettings: FilterSettings = {
            ...settings,
            maxPagesToSearch: Math.min(Math.max(1, settings.maxPagesToSearch || 20), 95),
            maxTotalVideosToFetch: Math.min(Math.max(50, settings.maxTotalVideosToFetch || 1000), 4750),
            minVideoDurationSeconds: Math.min(Math.max(0, settings.minVideoDurationSeconds || 60), 600),
            authenticityThreshold: Math.min(Math.max(0, settings.authenticityThreshold || 0.4), 1),
          };
          setFilterSettings(clampedSettings);
          // Save clamped values back to storage
          sessionStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(clampedSettings));
        } catch (err) {
          console.error("Failed to parse filter settings:", err);
        }
      }
    } catch (err) {
      console.error("Failed to load API keys from storage:", err);
    }
  });

  // Update YouTube API key state (without saving)
  const handleYoutubeApiKeyChange = (value: string) => {
    setYoutubeApiKey(value);
  };

  // Save YouTube API key to both cookie and sessionStorage (encrypted)
  const handleSaveYoutubeApiKey = () => {
    const value = youtubeApiKey().trim();
    try {
      if (value) {
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

  // Toggle custom filtering
  const handleCustomFilteringToggle = (enabled: boolean) => {
    setUseCustomFiltering(enabled);
    sessionStorage.setItem(USE_CUSTOM_FILTERING_KEY, enabled.toString());
  };

  // Update filter settings
  const handleFilterSettingsChange = (key: keyof FilterSettings, value: number) => {
    const newSettings = { ...filterSettings(), [key]: value };
    setFilterSettings(newSettings);
    try {
      sessionStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (err) {
      console.error("Failed to save filter settings:", err);
    }
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

  const handleTrainModel = async () => {
    setTrainingModel(true);
    setError(null);
    try {
      const response = await fetch("/api/train-model", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to train model");
      }
      setModelStatus({
        available: data.success ? true : modelStatus()?.available ?? false,
        positiveCount: data.positiveCount ?? modelStatus()?.positiveCount ?? 0,
        negativeCount: data.negativeCount ?? modelStatus()?.negativeCount ?? 0,
        trainedAt: data.success ? new Date().toISOString() : (modelStatus()?.trainedAt ?? null),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to train model");
    } finally {
      setTrainingModel(false);
    }
  };

  const refreshModelStatus = async () => {
    try {
      const statusRes = await fetch("/api/train-model");
      if (statusRes.ok) {
        const data = await statusRes.json();
        setModelStatus({
          available: data.available ?? false,
          positiveCount: data.positiveCount ?? 0,
          negativeCount: data.negativeCount ?? 0,
          trainedAt: data.trainedAt ?? null,
        });
      }
    } catch {
      // Ignore
    }
  };

  const refreshPoolStatus = async () => {
    try {
      const res = await fetch("/api/pool");
      if (res.ok) {
        const data = await res.json();
        setPoolStatus({ count: data.count ?? 0, updatedAt: data.updatedAt ?? null });
      }
    } catch {
      // Ignore
    }
  };

  const handleSeedPool = async () => {
    const youtubeKey = youtubeApiKey().trim();
    const queriesRaw = poolSeedQueries().trim();
    if (!youtubeKey) {
      setError("Enter your YouTube API key first");
      return;
    }
    if (!queriesRaw) {
      setError("Enter at least one search term (comma-separated)");
      return;
    }
    const queries = queriesRaw.split(",").map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) {
      setError("Enter at least one search term");
      return;
    }
    setSeedingPool(true);
    setError(null);
    try {
      const response = await fetch("/api/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: youtubeKey,
          queries,
          maxPagesPerQuery: poolPagesPerQuery(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to seed pool");
      }
      await refreshPoolStatus();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed pool");
    } finally {
      setSeedingPool(false);
    }
  };

  // Add favorite video by URL
  const handleAddFavoriteVideo = async () => {
    const url = favoriteVideoUrl().trim();
    const youtubeKey = youtubeApiKey().trim();

    if (!url) {
      setError("Please enter a YouTube URL or video ID");
      return;
    }

    if (!youtubeKey) {
      setError("Please enter your YouTube API key first");
      return;
    }

    setAddingFavorite(true);
    setError(null);

    try {
      const response = await fetch("/api/add-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          apiKey: youtubeKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to add video");
      }

      const data = await response.json();
      setFavoriteVideoUrl("");
      setError(null);
      refreshModelStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add video to favorites");
    } finally {
      setAddingFavorite(false);
    }
  };


  const handleSearch = async () => {
    // Get the actual value from the input element to handle SSR hydration issues
    const inputElement = document.getElementById("search-query") as HTMLInputElement;
    const query = inputElement ? inputElement.value.trim() : searchQuery().trim();
    const youtubeKey = youtubeApiKey().trim();
    const useCustom = useCustomFiltering();

    // Sync the input value back to the signal if there's a mismatch
    if (inputElement && inputElement.value !== searchQuery()) {
      setSearchQuery(inputElement.value);
    }

    if (!youtubeKey) {
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
      const params = new URLSearchParams({
        q: query,
        maxResults: "50",
        apiKey: youtubeKey,
      });

      if (useCustom) {
        params.set("useCustomFiltering", "true");
      } else {
        params.set("useCustomFiltering", "false");
      }

      // Add filter settings to request
      const settings = filterSettings();
      params.set("authenticityThreshold", settings.authenticityThreshold.toString());
      params.set("maxPagesToSearch", settings.maxPagesToSearch.toString());
      params.set("maxTotalVideosToFetch", settings.maxTotalVideosToFetch.toString());
      params.set("minVideoDurationSeconds", settings.minVideoDurationSeconds.toString());
      params.set("usePoolFirst", "true");

      const response = await fetch(`/api/youtube?${params.toString()}`);

      if (!response.ok) {
        let errorMessage = "Failed to fetch videos";
        try {
          // Read as text first, then try to parse as JSON
          const text = await response.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If not JSON, use the text as error message
            errorMessage = text || errorMessage;
          }
        } catch {
          // If we can't read the response, use default message
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Response is not JSON");
        }
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      setVideos(data.videos || []);
      refreshPoolStatus();
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
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleSaveYoutubeApiKey}
                    disabled={loading() || !youtubeApiKey().trim()}
                    class="flex items-center gap-2"
                  >
                    <Save size={16} />
                    <span>Save</span>
                  </Button>
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

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Checkbox
                      id="use-custom-filtering"
                      checked={useCustomFiltering()}
                      onChange={(e) => handleCustomFilteringToggle(e.currentTarget.checked)}
                      disabled={loading()}
                    />

                    <Label
                      for="use-custom-filtering"
                      class="text-sm font-normal cursor-pointer"
                      selectable={false}
                    >
                      <Brain class="h-4 w-4 text-primary inline" />
                      Use AI-powered content filtering
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setShowSettings(!showSettings())}
                    disabled={loading()}
                    class="flex items-center gap-2"
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </Button>
                </div>

                <p class="text-xs text-muted-foreground">
                  Our custom AI filter analyzes video titles, descriptions, and engagement metrics to identify authentic, high-quality content versus "slop" or manufactured content. The filter learns from your feedback to improve over time.
                </p>

                {showSettings() && (
                  <div class="p-4 border border-border rounded-lg bg-muted/50 flex flex-col gap-4">
                    <Label>
                      <Settings class="h-4 w-4 text-primary inline mr-1" />
                      Filter Settings
                    </Label>

                    <div class="flex flex-col gap-3">
                      <div class="flex flex-col gap-2">
                        <Label for="authenticity-threshold" class="text-sm">
                          Authenticity Threshold: {filterSettings().authenticityThreshold.toFixed(2)}
                        </Label>
                        <div class="relative w-full">
                          <Input
                            id="authenticity-threshold"
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={filterSettings().authenticityThreshold}
                            onInput={(e) => {
                              const value = parseFloat(e.currentTarget.value);
                              handleFilterSettingsChange("authenticityThreshold", value);
                              // Update the fill percentage
                              const percentage = (value / 1) * 100;
                              e.currentTarget.style.setProperty("--fill-percentage", `${percentage}%`);
                            }}
                            disabled={loading()}
                            class="slider-with-fill"
                            style={`--fill-percentage: ${(filterSettings().authenticityThreshold / 1) * 100}%`}
                          />
                        </div>
                        <p class="text-xs text-muted-foreground">
                          Lower = more lenient (0.0-1.0). Videos below this score are filtered out.
                        </p>
                      </div>

                      <div class="flex flex-col gap-2">
                        <Label for="max-pages" class="text-sm">
                          Max Pages to Search: {filterSettings().maxPagesToSearch}
                        </Label>
                        <Input
                          id="max-pages"
                          type="number"
                          min="1"
                          max="95"
                          value={filterSettings().maxPagesToSearch}
                          onInput={(e) => {
                            const value = parseInt(e.currentTarget.value) || 20;
                            const maxAllowed = 95; // YouTube API quota limit
                            const clampedValue = Math.max(1, Math.min(value, maxAllowed));
                            if (clampedValue !== filterSettings().maxPagesToSearch) {
                              handleFilterSettingsChange("maxPagesToSearch", clampedValue);
                            }
                          }}
                          disabled={loading()}
                        />
                        <p class="text-xs text-muted-foreground">
                          Maximum number of pages to search (each page costs ~101 API units). Max 95 pages to respect YouTube API daily quota (10,000 units).
                        </p>
                      </div>

                      <div class="flex flex-col gap-2">
                        <Label for="max-total-videos" class="text-sm">
                          Max Total Videos to Fetch: {filterSettings().maxTotalVideosToFetch}
                        </Label>
                        <Input
                          id="max-total-videos"
                          type="number"
                          min="50"
                          max="4750"
                          step="50"
                          value={filterSettings().maxTotalVideosToFetch}
                          onInput={(e) => {
                            const value = parseInt(e.currentTarget.value) || 1000;
                            const maxAllowed = 4750; // YouTube API quota limit (95 pages * 50 videos)
                            const clampedValue = Math.max(50, Math.min(value, maxAllowed));
                            if (clampedValue !== filterSettings().maxTotalVideosToFetch) {
                              handleFilterSettingsChange("maxTotalVideosToFetch", clampedValue);
                            }
                          }}
                          disabled={loading()}
                        />
                        <p class="text-xs text-muted-foreground">
                          Maximum total videos to fetch (max 4,750 to respect YouTube API daily quota of 10,000 units).
                        </p>
                      </div>

                      <div class="flex flex-col gap-2">
                        <Label for="min-duration" class="text-sm">
                          Minimum Video Duration (seconds): {filterSettings().minVideoDurationSeconds}
                        </Label>
                        <Input
                          id="min-duration"
                          type="number"
                          min="0"
                          max="600"
                          step="10"
                          value={filterSettings().minVideoDurationSeconds}
                          onInput={(e) => {
                            const value = parseInt(e.currentTarget.value) || 60;
                            const clampedValue = Math.max(0, Math.min(value, 600));
                            if (clampedValue !== filterSettings().minVideoDurationSeconds) {
                              handleFilterSettingsChange("minVideoDurationSeconds", clampedValue);
                            }
                          }}
                          disabled={loading()}
                        />
                        <p class="text-xs text-muted-foreground">
                          Videos shorter than this duration (e.g., Shorts) are automatically filtered out.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div class="flex flex-col gap-4">
                <Label for="favorite-video-url">
                  <Heart class="h-4 w-4 text-primary" />
                  Add Favorite Video
                </Label>
                <p class="text-xs text-muted-foreground">
                  Paste a YouTube URL or video ID to add it to your favorites (positive) or use thumbs down on search results for negative feedback. This data trains your recommendation model.
                </p>
                <div class="flex flex-row gap-2">
                  <Input
                    id="favorite-video-url"
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    class="flex-1"
                    value={favoriteVideoUrl()}
                    onInput={(e) => setFavoriteVideoUrl(e.currentTarget.value)}
                    disabled={addingFavorite() || loading()}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddFavoriteVideo();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    onClick={handleAddFavoriteVideo}
                    disabled={addingFavorite() || loading() || !favoriteVideoUrl().trim() || !youtubeApiKey().trim()}
                    class="flex items-center gap-2"
                  >
                    {addingFavorite() ? (
                      <Loader class="animate-spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>Add</span>
                  </Button>
                </div>
              </div>

              <div class="flex flex-col gap-4">
                <Label>
                  <Database class="h-4 w-4 text-primary" />
                  Video pool (fewer API calls)
                </Label>
                <p class="text-xs text-muted-foreground">
                  Seed a local cache with videos from YouTube once. Searches then use the pool first and only call the API when needed. Saves quota for testing filtering and recommendations.
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  {poolStatus() && (() => {
                    const ps = poolStatus()!;
                    return (
                      <span class="text-sm text-muted-foreground">
                        Pool: {ps.count} video(s)
                        {ps.updatedAt != null ? `, updated ${new Date(ps.updatedAt).toLocaleString()}` : ""}
                      </span>
                    );
                  })()}
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="pool-seed-queries" class="text-sm">
                    Seed with search terms (comma-separated)
                  </Label>
                  <Input
                    id="pool-seed-queries"
                    type="text"
                    placeholder="documentary, cooking, travel"
                    value={poolSeedQueries()}
                    onInput={(e) => setPoolSeedQueries(e.currentTarget.value)}
                    disabled={seedingPool() || loading()}
                  />
                  <div class="flex items-center gap-2">
                    <Label for="pool-pages" class="text-sm">
                      Pages per term:
                    </Label>
                    <Input
                      id="pool-pages"
                      type="number"
                      min="1"
                      max="5"
                      value={poolPagesPerQuery()}
                      onInput={(e) => setPoolPagesPerQuery(parseInt(e.currentTarget.value, 10) || 2)}
                      disabled={seedingPool() || loading()}
                      class="w-20"
                    />
                    <span class="text-xs text-muted-foreground">
                      (~101 API units per page)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleSeedPool}
                    disabled={seedingPool() || loading() || !youtubeApiKey().trim()}
                    class="flex items-center gap-2 self-start"
                  >
                    {seedingPool() ? (
                      <Loader class="animate-spin" size={16} />
                    ) : (
                      <Database size={16} />
                    )}
                    <span>Seed pool</span>
                  </Button>
                </div>
              </div>

              <div class="flex flex-col gap-4">
                <Label>
                  <Sparkles class="h-4 w-4 text-primary" />
                  Recommendation model (watch while eating)
                </Label>
                <p class="text-xs text-muted-foreground">
                  Train a model on your likes and dislikes. Once trained, search results are re-ranked so videos that match your taste appear first.
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleTrainModel}
                    disabled={
                      trainingModel() ||
                      (modelStatus()?.positiveCount ?? 0) < 2 ||
                      (modelStatus()?.negativeCount ?? 0) < 2
                    }
                    class="flex items-center gap-2"
                  >
                    {trainingModel() ? (
                      <Loader class="animate-spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    <span>Train model</span>
                  </Button>
                  {modelStatus() && (
                    <span class="text-sm text-muted-foreground">
                      {modelStatus()!.available
                        ? `Trained on ${modelStatus()!.positiveCount} likes, ${modelStatus()!.negativeCount} dislikes. Results are ranked by your preferences.`
                        : `Add at least 2 likes and 2 dislikes to train (you have ${modelStatus()!.positiveCount} likes, ${modelStatus()!.negativeCount} dislikes).`}
                    </span>
                  )}
                </div>
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
                  <VideoCard video={video} onFeedbackChange={refreshModelStatus} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
