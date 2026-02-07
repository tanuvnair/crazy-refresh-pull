import { Title } from "@solidjs/meta";
import { createSignal, onMount } from "solid-js";
import { Alert, Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription, EmptyState, Input, SettingsSection, SettingsGroup, SettingsRow, SettingsContentRow, Text } from "~/components/ui";
import { Search, Eye, EyeOff, Loader, Plus, Settings, Sparkles, Database, RefreshCw, ArrowLeft } from "lucide-solid";
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
  const [feedVideos, setFeedVideos] = createSignal<Video[]>([]);
  const [searchVideos, setSearchVideos] = createSignal<Video[]>([]);
  const [viewMode, setViewMode] = createSignal<"feed" | "search">("feed");
  const [feedLoading, setFeedLoading] = createSignal(false);
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
    authenticityThreshold: 0.4,
    maxPagesToSearch: 20, // ~2,020 units per search (allows ~4-5 searches per day)
    maxTotalVideosToFetch: 1000, // Conservative limit per search
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

    loadFeed();
  });

  const buildFeedParams = () => {
    const params = new URLSearchParams({ limit: "20" });
    const key = youtubeApiKey().trim();
    if (key) params.set("apiKey", key);
    params.set("useCustomFiltering", useCustomFiltering() ? "true" : "false");
    params.set("authenticityThreshold", filterSettings().authenticityThreshold.toString());
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
    const inputElement = document.getElementById("search-query") as HTMLInputElement;
    const query = inputElement ? inputElement.value.trim() : searchQuery().trim();
    const youtubeKey = youtubeApiKey().trim();
    const useCustom = useCustomFiltering();

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
      params.set("useCustomFiltering", useCustom ? "true" : "false");
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
        <nav class="sticky top-0 z-40 border-b border-border bg-card shadow-[var(--shadow-apple-sm)]">
          <div class="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-6 py-5 flex-nowrap min-w-0 sm:px-8">
            <h1 class="text-lg font-semibold tracking-tight text-foreground shrink-0 sm:text-xl">
              Crazy Refresh Pull
            </h1>
            <div class="flex items-center gap-5 flex-nowrap min-w-0 shrink">
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
                variant="secondary"
                size="default"
                onClick={handleRefreshFeed}
                disabled={feedLoading()}
                class="h-10 shrink-0 gap-2 px-3"
                title="Load new random recommendations"
              >
                <RefreshCw size={16} class={feedLoading() ? "animate-spin" : ""} />
                <span class="hidden sm:inline">Refresh</span>
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

          <Dialog open={showSettings()} onOpenChange={setShowSettings}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Configure your API key, content filters, and recommendations.
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
                {/* -- Section: YouTube API Key -- */}
                <SettingsSection class="pt-0 pb-1">YouTube API Key</SettingsSection>
                <SettingsGroup>
                  <SettingsRow label="API Key">
                    <div class="flex items-center gap-2 min-w-0">
                      <Input
                        id="youtube-api-key"
                        type={showYoutubeApiKey() ? "text" : "password"}
                        placeholder="Paste key here..."
                        class="h-8 text-sm text-right bg-transparent border-0 shadow-none focus:ring-0 min-w-0"
                        value={youtubeApiKey()}
                        onInput={(e) => handleYoutubeApiKeyChange(e.currentTarget.value)}
                        disabled={searchLoading()}
                      />
                      <Button type="button" variant="ghost" size="icon" class="h-7 w-7 shrink-0" onClick={() => setShowYoutubeApiKey(!showYoutubeApiKey())} title={showYoutubeApiKey() ? "Hide" : "Show"}>
                        {showYoutubeApiKey() ? <EyeOff class="h-3.5 w-3.5 text-muted-foreground" /> : <Eye class="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </SettingsRow>
                  <div class="flex items-center justify-between px-4 py-2.5">
                    <p class="text-xs text-muted-foreground">
                      <a href="https://console.cloud.google.com/marketplace/product/google/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Enable the YouTube Data API</a>, then create a key in{" "}
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Credentials</a>. Stored encrypted in your browser.
                    </p>
                    <div class="flex items-center gap-2 shrink-0 ml-3">
                      {youtubeApiKey() && (
                        <Button type="button" variant="ghost" size="xs" onClick={handleClearYoutubeApiKey} disabled={searchLoading()} class="text-destructive h-7">Clear</Button>
                      )}
                      <Button type="button" variant="default" size="xs" onClick={handleSaveYoutubeApiKey} disabled={searchLoading() || !youtubeApiKey().trim()} class="h-7">Save</Button>
                    </div>
                  </div>
                </SettingsGroup>

                {/* -- Section: Content Filtering -- */}
                <SettingsSection class="pb-1">Content Filtering</SettingsSection>
                <SettingsGroup>
                  <SettingsRow label="AI-powered filtering" description="Analyzes titles and engagement for authentic content">
                    <Checkbox
                      id="use-custom-filtering"
                      checked={useCustomFiltering()}
                      onChange={(e) => handleCustomFilteringToggle(e.currentTarget.checked)}
                      disabled={searchLoading()}
                    />
                  </SettingsRow>
                  <SettingsRow label="Authenticity threshold">
                    <div class="flex items-center gap-3 w-40">
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
                          e.currentTarget.style.setProperty("--fill-percentage", `${value * 100}%`);
                        }}
                        disabled={searchLoading()}
                        class="slider-with-fill flex-1"
                        style={`--fill-percentage: ${filterSettings().authenticityThreshold * 100}%`}
                      />
                      <span class="text-xs tabular-nums text-muted-foreground w-8 text-right">{filterSettings().authenticityThreshold.toFixed(2)}</span>
                    </div>
                  </SettingsRow>
                  <SettingsRow label="Max pages to search" description="Used when searching YouTube">
                    <Input id="max-pages" type="number" min="1" max="95" value={filterSettings().maxPagesToSearch} onInput={(e) => { const v = parseInt(e.currentTarget.value, 10) || 20; handleFilterSettingsChange("maxPagesToSearch", Math.max(1, Math.min(v, 95))); }} disabled={searchLoading()} class="h-8 w-20 text-sm text-right" />
                  </SettingsRow>
                  <SettingsRow label="Max videos to fetch" description="Used when searching YouTube">
                    <Input id="max-total-videos" type="number" min="50" max="4750" step="50" value={filterSettings().maxTotalVideosToFetch} onInput={(e) => { const v = parseInt(e.currentTarget.value, 10) || 1000; handleFilterSettingsChange("maxTotalVideosToFetch", Math.max(50, Math.min(v, 4750))); }} disabled={searchLoading()} class="h-8 w-20 text-sm text-right" />
                  </SettingsRow>
                  <SettingsRow label="Min duration (seconds)" description="Filters out Shorts" border={false}>
                    <Input id="min-duration" type="number" min="0" max="600" step="10" value={filterSettings().minVideoDurationSeconds} onInput={(e) => { const v = parseInt(e.currentTarget.value, 10) || 60; handleFilterSettingsChange("minVideoDurationSeconds", Math.max(0, Math.min(v, 600))); }} disabled={searchLoading()} class="h-8 w-20 text-sm text-right" />
                  </SettingsRow>
                </SettingsGroup>

                {/* -- Section: Training Data -- */}
                <SettingsSection class="pb-1">Training Data</SettingsSection>
                <SettingsGroup>
                  <SettingsContentRow label="Add favorite video" description="Requires API key. Trains your recommendation model.">
                    <div class="flex items-center gap-2">
                      <Input
                        id="favorite-video-url"
                        type="text"
                        placeholder="https://youtube.com/watch?v=..."
                        class="h-8 text-sm flex-1"
                        value={favoriteVideoUrl()}
                        onInput={(e) => setFavoriteVideoUrl(e.currentTarget.value)}
                        disabled={addingFavorite() || searchLoading()}
                        onKeyPress={(e) => { if (e.key === "Enter") handleAddFavoriteVideo(); }}
                      />
                      <Button type="button" size="xs" onClick={handleAddFavoriteVideo} disabled={addingFavorite() || searchLoading() || !favoriteVideoUrl().trim() || !youtubeApiKey().trim()} class="h-8 gap-1.5">
                        {addingFavorite() ? <Loader class="animate-spin" size={14} /> : <Plus size={14} />}
                        Add
                      </Button>
                    </div>
                  </SettingsContentRow>
                  <SettingsRow
                    label="Recommendation model"
                    description={modelStatus()
                      ? modelStatus()!.available
                        ? `Trained: ${modelStatus()!.positiveCount} likes, ${modelStatus()!.negativeCount} dislikes`
                        : `${modelStatus()!.positiveCount} likes, ${modelStatus()!.negativeCount} dislikes (need 2 each)`
                      : undefined}
                    border={false}
                  >
                    <Button type="button" variant="outline" size="xs" onClick={handleTrainModel} disabled={trainingModel() || (modelStatus()?.positiveCount ?? 0) < 2 || (modelStatus()?.negativeCount ?? 0) < 2} class="h-8 gap-1.5 shrink-0">
                      {trainingModel() ? <Loader class="animate-spin" size={14} /> : <Sparkles size={14} />}
                      Train
                    </Button>
                  </SettingsRow>
                </SettingsGroup>

                {/* -- Section: Video Pool -- */}
                <SettingsSection class="pb-1">Video Pool</SettingsSection>
                <SettingsGroup>
                  {poolStatus() && (
                    <SettingsRow label="Pool size">
                      <span class="text-sm text-muted-foreground tabular-nums">
                        {poolStatus()!.count} video{poolStatus()!.count !== 1 ? "s" : ""}
                        {poolStatus()!.updatedAt != null ? ` -- ${new Date(poolStatus()!.updatedAt!).toLocaleDateString()}` : ""}
                      </span>
                    </SettingsRow>
                  )}
                  <SettingsContentRow label="Search terms (comma-separated)">
                    <Input
                      id="pool-seed-queries"
                      type="text"
                      placeholder="documentary, cooking, travel"
                      class="h-8 text-sm"
                      value={poolSeedQueries()}
                      onInput={(e) => setPoolSeedQueries(e.currentTarget.value)}
                      disabled={seedingPool() || searchLoading()}
                    />
                  </SettingsContentRow>
                  <SettingsRow label="Pages per term" border={false}>
                    <div class="flex items-center gap-3">
                      <Input id="pool-pages" type="number" min="1" max="5" value={poolPagesPerQuery()} onInput={(e) => setPoolPagesPerQuery(parseInt(e.currentTarget.value, 10) || 2)} disabled={seedingPool() || searchLoading()} class="h-8 w-16 text-sm text-right" />
                      <Button type="button" variant="default" size="xs" onClick={handleSeedPool} disabled={seedingPool() || searchLoading() || !youtubeApiKey().trim()} class="h-8 gap-1.5 shrink-0">
                        {seedingPool() ? <Loader class="animate-spin" size={14} /> : <Database size={14} />}
                        Seed pool
                      </Button>
                    </div>
                  </SettingsRow>
                </SettingsGroup>

              </DialogBody>

              <DialogFooter>
                <Button type="button" variant="default" size="default" onClick={() => setShowSettings(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main >
    </>
  );
}
