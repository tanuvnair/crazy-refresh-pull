import { Component, JSX, createSignal, onMount } from "solid-js";
import { Badge, Button, Card, CardContent } from "~/components/ui";
import { ExternalLink, ThumbsUp, ThumbsDown } from "lucide-solid";
import { decodeHtmlEntities } from "~/lib/html-entities";

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  likeCount?: string;
  url: string;
}

export interface VideoCardProps {
  video: Video;
  /** Called after feedback (like/dislike/remove) is successfully updated. Use to refresh model status. */
  onFeedbackChange?: () => void;
}

const VideoCard: Component<VideoCardProps> = (props) => {
  const [feedbackStatus, setFeedbackStatus] = createSignal<"positive" | "negative" | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Load feedback status on mount
  onMount(async () => {
    try {
      const response = await fetch(`/api/feedback?videoId=${props.video.id}`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to load feedback status:", error);
    }
  });

  const handleFeedback = async (action: "like" | "dislike", event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (isSubmitting()) return;

    // If clicking the same button, remove feedback
    const newAction = feedbackStatus() === (action === "like" ? "positive" : "negative")
      ? "remove"
      : action;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: newAction === "remove" ? "remove" : newAction === "like" ? "like" : "dislike",
          videoId: props.video.id,
          metadata: {
            title: props.video.title,
            description: props.video.description,
            channelTitle: props.video.channelTitle,
            publishedAt: props.video.publishedAt,
            viewCount: props.video.viewCount,
            likeCount: props.video.likeCount,
            url: props.video.url,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFeedbackStatus(data.status);
        props.onFeedbackChange?.();
      } else {
        console.error("Failed to update feedback");
      }
    } catch (error) {
      console.error("Error updating feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNumber = (num?: string): string => {
    if (!num) return "N/A";
    const number = parseInt(num, 10);
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(1)}M`;
    }
    if (number >= 1000) {
      return `${(number / 1000).toFixed(1)}K`;
    }
    return number.toString();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };


  return (
    <Card class="overflow-hidden transition-shadow hover:shadow-apple-lg">
      <a
        href={props.video.url}
        target="_blank"
        rel="noopener noreferrer"
        class="block"
      >
        <div class="relative w-full aspect-video bg-muted overflow-hidden">
          <img
            src={props.video.thumbnail}
            alt={decodeHtmlEntities(props.video.title)}
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <Badge variant="default" class="absolute top-2 right-2 gap-1 bg-black/70 text-white">
            <ExternalLink size={12} />
            <span>Watch</span>
          </Badge>
        </div>

        <CardContent class="p-4">
          <h3 class="text-lg font-semibold leading-7 line-clamp-2 min-h-14">
            {decodeHtmlEntities(props.video.title)}
          </h3>
          <div class="flex flex-col gap-2 mt-2">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>{decodeHtmlEntities(props.video.channelTitle)}</span>
              <span>{formatDate(props.video.publishedAt)}</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{formatNumber(props.video.viewCount)} views</span>
              {props.video.likeCount && (
                <span>{formatNumber(props.video.likeCount)} likes</span>
              )}
            </div>
          </div>
        </CardContent>
      </a>

      <div class="flex items-center gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant={feedbackStatus() === "positive" ? "default" : "outline"}
          size="sm"
          onClick={(e) => handleFeedback("like", e)}
          disabled={isSubmitting()}
          class="flex-1 gap-1.5"
        >
          <ThumbsUp size={16} class={feedbackStatus() === "positive" ? "fill-current" : ""} />
          Like
        </Button>
        <Button
          type="button"
          variant={feedbackStatus() === "negative" ? "destructive" : "outline"}
          size="sm"
          onClick={(e) => handleFeedback("dislike", e)}
          disabled={isSubmitting()}
          class="flex-1 gap-1.5"
        >
          <ThumbsDown size={16} class={feedbackStatus() === "negative" ? "fill-current" : ""} />
          Dislike
        </Button>
      </div>
    </Card>
  );
};

export default VideoCard;
