import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";
import { Alert, Button, EmptyState, Input, Text } from "~/components/ui";
import Search from "lucide-solid/icons/search";
import Settings from "lucide-solid/icons/settings";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import Loader from "lucide-solid/icons/loader";
import VideoCard, { type Video } from "~/components/video-card";
import SettingsDialog from "~/components/settings-dialog";
import { encryptApiKey, decryptApiKey } from "~/lib/encryption";
import { getYouTubeApiKeyFromCookie, saveYouTubeApiKeyToCookie } from "~/lib/cookie";
import { log } from "~/lib/logger";

const YOUTUBE_API_KEY_STORAGE_KEY = "youtube_api_key_encrypted";
const FILTER_SETTINGS_KEY = "filter_settings";

interface FilterSettings {
  maxPagesToSearch: number;
  maxTotalVideosToFetch: number;
  minVideoDurationSeconds: number;
}

// Module-level flag to track if component has been mounted before (for HMR)
let hasMountedBefore = false;

export default function Home() {
  const [youtubeApiKey, setYoutubeApiKey] = createSignal("");
  const [showYoutubeApiKey, setShowYoutubeApiKey] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [feedVideos, setFeedVideos] = createSignal<Video[]>([]);
  const [searchVideos, setSearchVideos] = createSignal<Video[]>([]);
  const [viewMode, setViewMode] = createSignal<"feed" | "search">("feed");
  const [feedLoading, setFeedLoading] = createSignal(true);
  const [searchLoading, setLoading] = createSignal(false);
  const [poolOnly, setPoolOnly] = createSignal(false);
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
    maxPagesToSearch: 20,
    maxTotalVideosToFetch: 1000,
    minVideoDurationSeconds: 60,
  });

  // Load API keys and settings from storage on mount
  onMount(async () => {
    if (!hasMountedBefore) {
      setError(null);
      setFeedVideos([]);
      setSearchVideos([]);
      hasMountedBefore = true;
    }

    try {
      // Load YouTube API key
      let encrypted: string | null = getYouTubeApiKeyFromCookie();
      if (!encrypted) {
        encrypted = sessionStorage.getItem(YOUTUBE_API_KEY_STORAGE_KEY);
      }
      if (encrypted) {
        try {
          const decrypted = decryptApiKey(encrypted);
          if (decrypted) {
            setYoutubeApiKey(decrypted);
          }
        } catch (decErr) {
          throw decErr;
        }
      }

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
          const settings = JSON.parse(settingsJson) as Partial<FilterSettings>;
          const clampedSettings: FilterSettings = {
            maxPagesToSearch: Math.min(Math.max(1, settings.maxPagesToSearch ?? 20), 95),
            maxTotalVideosToFetch: Math.min(Math.max(50, settings.maxTotalVideosToFetch ?? 1000), 4750),
            minVideoDurationSeconds: Math.min(Math.max(0, settings.minVideoDurationSeconds ?? 60), 600),
          };
          setFilterSettings(clampedSettings);
          sessionStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(clampedSettings));
        } catch (err) {
          log.error("index: failed to parse filter settings", {
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      log.error("index: failed to load API keys from storage", {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    loadFeed();
  });

  const buildFeedParams = () => {
    const params = new URLSearchParams({ limit: "20" });
    const key = youtubeApiKey().trim();
    if (key) params.set("apiKey", key);
    return params;
  };

  const loadFeed = async () => {
    setFeedLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed?${buildFeedParams().toString()}`);
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json();
      setFeedVideos(data.videos ?? []);
      setPoolOnly(Boolean(data.poolOnly));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
      setFeedVideos([]);
    } finally {
      setFeedLoading(false);
    }
  };

  const handleRefreshFeed = () => {
    setViewMode("feed");
    loadFeed();
  };

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
      log.error("index: failed to save YouTube API key to storage", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Update filter settings
  const handleFilterSettingsChange = (key: keyof FilterSettings, value: number) => {
    const newSettings = { ...filterSettings(), [key]: value };
    setFilterSettings(newSettings);
    try {
      sessionStorage.setItem(FILTER_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (err) {
      log.error("index: failed to save filter settings", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Clear YouTube API key
  const handleClearYoutubeApiKey = () => {
    setYoutubeApiKey("");
    try {
      sessionStorage.removeItem(YOUTUBE_API_KEY_STORAGE_KEY);
      saveYouTubeApiKeyToCookie("");
    } catch (err) {
      log.error("index: failed to clear YouTube API key", {
        message: err instanceof Error ? err.message : String(err),
      });
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
    const inputElement = document.getElementById("search-query") as HTMLInputElement;
    const query = inputElement ? inputElement.value.trim() : searchQuery().trim();
    const youtubeKey = youtubeApiKey().trim();

    if (inputElement && inputElement.value !== searchQuery()) {
      setSearchQuery(inputElement.value);
    }

    if (!query) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);
    setSearchVideos([]);
    setViewMode("search");

    try {
      const params = new URLSearchParams({
        q: query,
        maxResults: "50",
      });
      if (youtubeKey) params.set("apiKey", youtubeKey);
      const settings = filterSettings();
      params.set("maxPagesToSearch", settings.maxPagesToSearch.toString());
      params.set("maxTotalVideosToFetch", settings.maxTotalVideosToFetch.toString());
      params.set("minVideoDurationSeconds", settings.minVideoDurationSeconds.toString());
      params.set("usePoolFirst", "true");

      const response = await fetch(`/api/youtube?${params.toString()}`);

      if (!response.ok) {
        let errorMessage = "Failed to fetch videos";
        try {
          const text = await response.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSearchVideos(data.videos || []);
      setPoolOnly(Boolean(data.poolOnly));
      refreshPoolStatus();
      if (data.videos && data.videos.length === 0) {
        setError("No videos found. Try a different search term or seed the pool in Settings.");
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

  const displayVideos = () => (viewMode() === "feed" ? feedVideos() : searchVideos());
  const isLoading = () => (viewMode() === "feed" ? feedLoading() : searchLoading());

  return (
    <>
      <Title>Crazy Refresh Pull</Title>

      <main class="flex min-h-screen flex-col">
        <nav class="sticky top-0 z-40 border-b border-border bg-card shadow-(--shadow-apple-sm)">
          <div class="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-6 px-6 py-5 flex-nowrap min-w-0 sm:px-8">
            <h1 class="text-lg font-semibold tracking-tight text-foreground shrink-0 sm:text-xl">
              Crazy Refresh Pull
            </h1>

            <div class="flex items-center gap-4 flex-nowrap min-w-0 shrink">
              <Input
                id="search-query"
                type="text"
                placeholder="Search (pool or YouTube)..."
                class="h-10 w-56 min-w-0 shrink rounded-md border-input bg-background sm:w-80"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                disabled={searchLoading()}
              />
              <Button
                type="button"
                size="default"
                onClick={handleSearch}
                disabled={searchLoading()}
                class="h-10 shrink-0 gap-2 px-4"
              >
                {searchLoading() ? <Loader class="animate-spin" size={16} /> : <Search size={16} />}
                <span class="hidden sm:inline">Search</span>
              </Button>

              <Button
                type="button"
                variant="link"
                size="default"
                onClick={() => setShowSettings(true)}
                class="h-10 shrink-0 gap-2 px-3"
                title="Settings"
              >
                <Settings size={16} />
                <span class="hidden sm:inline">Settings</span>
              </Button>
            </div>
          </div>
        </nav>

        <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
          {poolOnly() && (
            <Alert variant="warning">
              Showing pooled videos only. Add a YouTube API key in Settings to search YouTube and seed more videos.
            </Alert>
          )}

          {error() && (
            <Alert variant="destructive">
              {error()}
            </Alert>
          )}

          {viewMode() === "search" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setViewMode("feed"); setError(null); }}
              class="self-start gap-2"
            >
              <ArrowLeft size={16} />
              Back to feed
            </Button>
          )}

          {isLoading() && displayVideos().length === 0 ? (
            <div class="flex items-center justify-center py-16">
              <Loader class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayVideos().length > 0 ? (
            <div class="flex flex-col gap-4">
              <Text variant="headline">
                {viewMode() === "feed" ? "Recommendations" : `Search: ${searchQuery() || "..."}`}
              </Text>
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayVideos().map((video) => (
                  <VideoCard video={video} onFeedbackChange={refreshModelStatus} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No recommendations yet."
              description="Seed the pool in Settings (add an API key to fetch from YouTube)."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  class="gap-2"
                >
                  <Settings size={16} />
                  Open Settings
                </Button>
              }
            />
          )}

          <SettingsDialog
            open={showSettings()}
            onOpenChange={setShowSettings}
            youtubeApiKey={youtubeApiKey()}
            onYoutubeApiKeyChange={handleYoutubeApiKeyChange}
            showYoutubeApiKey={showYoutubeApiKey()}
            onShowYoutubeApiKeyChange={setShowYoutubeApiKey}
            onSaveYoutubeApiKey={handleSaveYoutubeApiKey}
            onClearYoutubeApiKey={handleClearYoutubeApiKey}
            searchLoading={searchLoading()}
            filterSettings={filterSettings()}
            onFilterSettingsChange={handleFilterSettingsChange}
            favoriteVideoUrl={favoriteVideoUrl()}
            onFavoriteVideoUrlChange={setFavoriteVideoUrl}
            addingFavorite={addingFavorite()}
            onAddFavoriteVideo={handleAddFavoriteVideo}
            modelStatus={modelStatus()}
            onTrainModel={handleTrainModel}
            trainingModel={trainingModel()}
            poolStatus={poolStatus()}
            poolSeedQueries={poolSeedQueries()}
            onPoolSeedQueriesChange={setPoolSeedQueries}
            seedingPool={seedingPool()}
            poolPagesPerQuery={poolPagesPerQuery()}
            onPoolPagesPerQueryChange={setPoolPagesPerQuery}
            onSeedPool={handleSeedPool}
          />
        </div>
      </main >
    </>
  );
}
