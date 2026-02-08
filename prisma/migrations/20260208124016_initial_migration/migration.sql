-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "channel_title" TEXT,
    "published_at" TEXT,
    "view_count" TEXT,
    "like_count" TEXT,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "channel_title" TEXT,
    "published_at" TEXT,
    "view_count" TEXT,
    "like_count" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "model_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idx_feedback_sentiment" ON "feedback"("sentiment");
