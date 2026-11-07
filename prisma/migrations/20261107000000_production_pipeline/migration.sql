-- Production cutover revokes only previously simulated credentials.
DELETE FROM "Session";
DELETE FROM "OtpChallenge";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestKey" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "transcript" TEXT,
    "planJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "errorCode" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "workflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "slot" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "assetId" TEXT,
    "resourceType" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
    "format" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "duration" REAL,
    "sampleCount" INTEGER,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreationJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "StoryVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "assetPublicId" TEXT,
    "notificationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "recipient" TEXT,
    "errorCode" TEXT,
    "workflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
CREATE TABLE "new_OtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OtpChallenge" ("email", "expiresAt", "id", "used") SELECT "email", "expiresAt", "id", "used" FROM "OtpChallenge";
DROP TABLE "OtpChallenge";
ALTER TABLE "new_OtpChallenge" RENAME TO "OtpChallenge";
CREATE INDEX "OtpChallenge_email_createdAt_idx" ON "OtpChallenge"("email", "createdAt");
ALTER TABLE "Session" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Story" ADD COLUMN "versionId" TEXT;
ALTER TABLE "Story" ADD COLUMN "provenance" TEXT NOT NULL DEFAULT 'LEGACY_EDITORIAL';
ALTER TABLE "Story" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
CREATE UNIQUE INDEX "Story_versionId_key" ON "Story"("versionId");
-- CreateIndex
CREATE INDEX "CreationJob_userId_createdAt_idx" ON "CreationJob"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreationJob_userId_requestKey_key" ON "CreationJob"("userId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreationJob_storyId_version_key" ON "CreationJob"("storyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_publicId_key" ON "MediaAsset"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_jobId_slot_key" ON "MediaAsset"("jobId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "StoryVersion_jobId_key" ON "StoryVersion"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryVersion_storyId_number_key" ON "StoryVersion"("storyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StoryExport_assetPublicId_key" ON "StoryExport"("assetPublicId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryExport_userId_versionId_key" ON "StoryExport"("userId", "versionId");
