-- Rename columns on "videos" table
ALTER TABLE "videos" RENAME COLUMN "channel_title" TO "channelTitle";
ALTER TABLE "videos" RENAME COLUMN "published_at" TO "publishedAt";
ALTER TABLE "videos" RENAME COLUMN "view_count" TO "viewCount";
ALTER TABLE "videos" RENAME COLUMN "like_count" TO "likeCount";
ALTER TABLE "videos" RENAME COLUMN "created_at" TO "createdAt";

-- Rename columns on "feedback" table
ALTER TABLE "feedback" RENAME COLUMN "channel_title" TO "channelTitle";
ALTER TABLE "feedback" RENAME COLUMN "published_at" TO "publishedAt";
ALTER TABLE "feedback" RENAME COLUMN "view_count" TO "viewCount";
ALTER TABLE "feedback" RENAME COLUMN "like_count" TO "likeCount";
ALTER TABLE "feedback" RENAME COLUMN "created_at" TO "createdAt";

-- Rename primary key constraints
ALTER TABLE "videos" RENAME CONSTRAINT "videos_pkey" TO "Video_pkey";
ALTER TABLE "feedback" RENAME CONSTRAINT "feedback_pkey" TO "Feedback_pkey";
ALTER TABLE "model" RENAME CONSTRAINT "model_pkey" TO "KeyValueModel_pkey";

-- Rename tables
ALTER TABLE "videos" RENAME TO "Video";
ALTER TABLE "feedback" RENAME TO "Feedback";
ALTER TABLE "model" RENAME TO "KeyValueModel";
