import { createSignal } from "solid-js";
import { cn } from "~/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Input,
  SettingsSection,
  SettingsGroup,
  SettingsRow,
  SettingsContentRow,
} from "~/components/ui";
import Check from "lucide-solid/icons/check";
import Eye from "lucide-solid/icons/eye";
import EyeOff from "lucide-solid/icons/eye-off";
import Loader from "lucide-solid/icons/loader";
import Plus from "lucide-solid/icons/plus";
import Sparkles from "lucide-solid/icons/sparkles";
import Database from "lucide-solid/icons/database";

export interface FilterSettingsShape {
  maxPagesToSearch: number;
  maxTotalVideosToFetch: number;
  minVideoDurationSeconds: number;
}

export interface ModelStatusShape {
  available: boolean;
  positiveCount: number;
  negativeCount: number;
  trainedAt: string | null;
}

export interface PoolStatusShape {
  count: number;
  updatedAt: string | null;
}

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  youtubeApiKey: string;
  onYoutubeApiKeyChange: (value: string) => void;
  showYoutubeApiKey: boolean;
  onShowYoutubeApiKeyChange: (show: boolean) => void;
  onSaveYoutubeApiKey: () => void;
  onClearYoutubeApiKey: () => void;
  searchLoading: boolean;
  filterSettings: FilterSettingsShape;
  onFilterSettingsChange: (
    key: keyof FilterSettingsShape,
    value: number,
  ) => void;
  favoriteVideoUrl: string;
  onFavoriteVideoUrlChange: (value: string) => void;
  addingFavorite: boolean;
  onAddFavoriteVideo: () => void;
  modelStatus: ModelStatusShape | null;
  onTrainModel: () => void;
  trainingModel: boolean;
  poolStatus: PoolStatusShape | null;
  poolSeedQueries: string;
  onPoolSeedQueriesChange: (value: string) => void;
  seedingPool: boolean;
  poolPagesPerQuery: number;
  onPoolPagesPerQueryChange: (value: number) => void;
  onSeedPool: () => void;
}

const SAVE_CONFIRMATION_MS = 2000;

export default function SettingsDialog(props: SettingsDialogProps) {
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const handleSaveClick = () => {
    props.onSaveYoutubeApiKey();
    clearTimeout(saveTimer);
    setSaveSuccess(true);
    saveTimer = setTimeout(() => setSaveSuccess(false), SAVE_CONFIRMATION_MS);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
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
                  type={props.showYoutubeApiKey ? "text" : "password"}
                  placeholder="Paste key here..."
                  class="h-8 text-sm text-right bg-transparent border-0 shadow-none focus:ring-0 min-w-0"
                  value={props.youtubeApiKey}
                  onInput={(e) =>
                    props.onYoutubeApiKeyChange(e.currentTarget.value)
                  }
                  disabled={props.searchLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 shrink-0"
                  onClick={() =>
                    props.onShowYoutubeApiKeyChange(!props.showYoutubeApiKey)
                  }
                  title={props.showYoutubeApiKey ? "Hide" : "Show"}
                >
                  {props.showYoutubeApiKey ? (
                    <EyeOff class="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Eye class="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </SettingsRow>
            <div class="flex items-center justify-between px-4 py-2.5">
              <p class="text-xs text-muted-foreground">
                <a
                  href="https://console.cloud.google.com/marketplace/product/google/youtube.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Enable the YouTube Data API
                </a>
                , then create a key in{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  Credentials
                </a>
                . Stored encrypted in your browser.
              </p>
              <div class="flex items-center gap-2 shrink-0 ml-3">
                {props.youtubeApiKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={props.onClearYoutubeApiKey}
                    disabled={props.searchLoading}
                    class="text-destructive h-7"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={handleSaveClick}
                  disabled={props.searchLoading || !props.youtubeApiKey.trim()}
                  class="h-7 overflow-hidden"
                >
                  <Check
                    size={14}
                    class={cn(
                      "shrink-0 overflow-hidden transition-all duration-300 ease-out",
                      saveSuccess()
                        ? "w-3.5 mr-1 opacity-100"
                        : "w-0 mr-0 opacity-0",
                    )}
                  />
                  Save
                </Button>
              </div>
            </div>
          </SettingsGroup>

          {/* -- Section: Search & duration -- */}
          <SettingsSection class="pb-1">Search & duration</SettingsSection>
          <SettingsGroup>
            <SettingsRow
              label="Max pages to search"
              description="Used when searching YouTube"
            >
              <Input
                id="max-pages"
                type="number"
                min="1"
                max="95"
                value={props.filterSettings.maxPagesToSearch}
                onInput={(e) => {
                  const v = parseInt(e.currentTarget.value, 10) || 20;
                  props.onFilterSettingsChange(
                    "maxPagesToSearch",
                    Math.max(1, Math.min(v, 95)),
                  );
                }}
                disabled={props.searchLoading}
                class="h-8 w-20 text-sm text-right"
              />
            </SettingsRow>
            <SettingsRow
              label="Max videos to fetch"
              description="Used when searching YouTube"
            >
              <Input
                id="max-total-videos"
                type="number"
                min="50"
                max="4750"
                step="50"
                value={props.filterSettings.maxTotalVideosToFetch}
                onInput={(e) => {
                  const v = parseInt(e.currentTarget.value, 10) || 1000;
                  props.onFilterSettingsChange(
                    "maxTotalVideosToFetch",
                    Math.max(50, Math.min(v, 4750)),
                  );
                }}
                disabled={props.searchLoading}
                class="h-8 w-20 text-sm text-right"
              />
            </SettingsRow>
            <SettingsRow
              label="Min duration (seconds)"
              description="Filters out Shorts"
              border={false}
            >
              <Input
                id="min-duration"
                type="number"
                min="0"
                max="600"
                step="10"
                value={props.filterSettings.minVideoDurationSeconds}
                onInput={(e) => {
                  const v = parseInt(e.currentTarget.value, 10) || 60;
                  props.onFilterSettingsChange(
                    "minVideoDurationSeconds",
                    Math.max(0, Math.min(v, 600)),
                  );
                }}
                disabled={props.searchLoading}
                class="h-8 w-20 text-sm text-right"
              />
            </SettingsRow>
          </SettingsGroup>

          {/* -- Section: Training Data -- */}
          <SettingsSection class="pb-1">Training Data</SettingsSection>
          <SettingsGroup>
            <SettingsContentRow
              label="Add favorite video"
              description="Requires API key. Trains your recommendation model."
            >
              <div class="flex items-center gap-2">
                <Input
                  id="favorite-video-url"
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  class="h-8 text-sm flex-1"
                  value={props.favoriteVideoUrl}
                  onInput={(e) =>
                    props.onFavoriteVideoUrlChange(e.currentTarget.value)
                  }
                  disabled={props.addingFavorite || props.searchLoading}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") props.onAddFavoriteVideo();
                  }}
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={props.onAddFavoriteVideo}
                  disabled={
                    props.addingFavorite ||
                    props.searchLoading ||
                    !props.favoriteVideoUrl.trim() ||
                    !props.youtubeApiKey.trim()
                  }
                  class="h-8 gap-1.5"
                >
                  {props.addingFavorite ? (
                    <Loader class="animate-spin" size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  Add
                </Button>
              </div>
            </SettingsContentRow>
            <SettingsRow
              label="Recommendation model"
              description={
                props.modelStatus
                  ? props.modelStatus.available
                    ? `Trained: ${props.modelStatus.positiveCount} likes, ${props.modelStatus.negativeCount} dislikes`
                    : `${props.modelStatus.positiveCount} likes, ${props.modelStatus.negativeCount} dislikes (need 2 each)`
                  : undefined
              }
              border={false}
            >
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={props.onTrainModel}
                disabled={
                  props.trainingModel ||
                  (props.modelStatus?.positiveCount ?? 0) < 2 ||
                  (props.modelStatus?.negativeCount ?? 0) < 2
                }
                class="h-8 gap-1.5 shrink-0"
              >
                {props.trainingModel ? (
                  <Loader class="animate-spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                Train
              </Button>
            </SettingsRow>
          </SettingsGroup>

          {/* -- Section: Video Pool -- */}
          <SettingsSection class="pb-1">Video Pool</SettingsSection>
          <SettingsGroup>
            {props.poolStatus && (
              <SettingsRow label="Pool size">
                <span class="text-sm text-muted-foreground tabular-nums">
                  {props.poolStatus.count} video
                  {props.poolStatus.count !== 1 ? "s" : ""}
                  {props.poolStatus.updatedAt != null
                    ? ` -- ${new Date(props.poolStatus.updatedAt).toLocaleDateString()}`
                    : ""}
                </span>
              </SettingsRow>
            )}
            <SettingsContentRow label="Search terms (comma-separated)">
              <Input
                id="pool-seed-queries"
                type="text"
                placeholder="documentary, cooking, travel"
                class="h-8 text-sm"
                value={props.poolSeedQueries}
                onInput={(e) =>
                  props.onPoolSeedQueriesChange(e.currentTarget.value)
                }
                disabled={props.seedingPool || props.searchLoading}
              />
            </SettingsContentRow>
            <SettingsRow label="Pages per term" border={false}>
              <div class="flex items-center gap-3">
                <Input
                  id="pool-pages"
                  type="number"
                  min="1"
                  max="5"
                  value={props.poolPagesPerQuery}
                  onInput={(e) =>
                    props.onPoolPagesPerQueryChange(
                      parseInt(e.currentTarget.value, 10) || 2,
                    )
                  }
                  disabled={props.seedingPool || props.searchLoading}
                  class="h-8 w-16 text-sm text-right"
                />
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onClick={props.onSeedPool}
                  disabled={
                    props.seedingPool ||
                    props.searchLoading ||
                    !props.youtubeApiKey.trim()
                  }
                  class="h-8 gap-1.5 shrink-0"
                >
                  {props.seedingPool ? (
                    <Loader class="animate-spin" size={14} />
                  ) : (
                    <Database size={14} />
                  )}
                  Seed pool
                </Button>
              </div>
            </SettingsRow>
          </SettingsGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => props.onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
