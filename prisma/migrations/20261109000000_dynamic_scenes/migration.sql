ALTER TABLE "CreationJob" ADD COLUMN "totalScenes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreationJob" ADD COLUMN "processedScenes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreationJob" ADD COLUMN "notificationStatus" TEXT NOT NULL DEFAULT 'PENDING';
UPDATE "CreationJob" SET "status"='PROCESSING_MEDIA' WHERE "status"='RUNNING';
UPDATE "CreationJob" SET "status"='COMPLETED', "notificationStatus"='SENT' WHERE "status"='REVIEW_READY';
UPDATE "CreationJob" SET "totalScenes"=json_array_length("planJson", '$.scenes') WHERE "planJson" IS NOT NULL;
UPDATE "CreationJob" SET "processedScenes"="totalScenes" WHERE "status"='COMPLETED';
