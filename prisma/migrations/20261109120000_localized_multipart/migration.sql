CREATE INDEX "Story_language_publishedAt_idx" ON "Story"("language", "publishedAt");
CREATE INDEX "Story_language_collection_publishedAt_idx" ON "Story"("language", "collection", "publishedAt");
CREATE TABLE "ExportPart" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "exportId" TEXT NOT NULL,
 "partNumber" INTEGER NOT NULL,
 "filename" TEXT NOT NULL,
 "publicId" TEXT NOT NULL,
 "entriesJson" TEXT NOT NULL,
 "bytes" INTEGER,
 "checksum" TEXT,
 "status" TEXT NOT NULL DEFAULT 'PLANNED',
 CONSTRAINT "ExportPart_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "StoryExport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExportPart_publicId_key" ON "ExportPart"("publicId");
CREATE UNIQUE INDEX "ExportPart_exportId_partNumber_key" ON "ExportPart"("exportId", "partNumber");
