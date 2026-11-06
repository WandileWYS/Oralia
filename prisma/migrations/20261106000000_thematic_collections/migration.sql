PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "regionTag" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "originalAudioUrl" TEXT,
    "voiceType" TEXT NOT NULL DEFAULT 'STUDIO_AI',
    "duration" REAL NOT NULL,
    "authorId" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "culturalNote" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("id","title","description","collection","regionTag","audioUrl","originalAudioUrl","voiceType","duration","authorId","sourceTitle","sourceUrl","culturalNote","featured","publishedAt") SELECT "id","title","description",CASE WHEN "id" IN ('two-messengers','sultan-majnuns-date-palm') THEN 'EPIC_AND_CHRONICLE' WHEN "id" IN ('anansi-wisdom','tink-tinkje','anansi-spider-tales','monkey-and-shark','washermans-donkey','goso-the-teacher') THEN 'FOLK_AND_FABLE' WHEN "ageTier" IN ('5-9','10-13') THEN 'FOLK_AND_FABLE' ELSE 'EPIC_AND_CHRONICLE' END,"regionTag","audioUrl","originalAudioUrl","voiceType","duration","authorId","sourceTitle","sourceUrl","culturalNote","featured","publishedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_collection_publishedAt_idx" ON "Story"("collection","publishedAt");
CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");
COMMIT;
PRAGMA foreign_keys=ON;
