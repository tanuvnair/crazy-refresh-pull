import { Component, JSX } from "solid-js";
import { Card, CardContent } from "~/components/ui";
import { ExternalLink } from "lucide-solid";

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
}

const VideoCard: Component<VideoCardProps> = (props) => {
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

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <Card class="overflow-hidden hover:shadow-lg transition-shadow">
      <a
        href={props.video.url}
        target="_blank"
        rel="noopener noreferrer"
        class="block"
      >
        <div class="relative w-full aspect-video bg-muted overflow-hidden">
          <img
            src={props.video.thumbnail}
            alt={props.video.title}
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div class="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <ExternalLink size={12} />
            <span>Watch</span>
          </div>
        </div>

        <CardContent class="p-4">
          <h3 class="font-semibold text-lg mb-2 line-clamp-2 min-h-14">
            {props.video.title}
          </h3>
          <p class="text-sm text-muted-foreground mb-3 line-clamp-2">
            {truncateText(props.video.description, 120)}
          </p>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span>{props.video.channelTitle}</span>
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
    </Card>
  );
};

export default VideoCard;
