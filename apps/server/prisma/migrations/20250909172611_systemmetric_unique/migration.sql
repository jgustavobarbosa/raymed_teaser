/*
  Warnings:

  - You are about to drop the column `timestamp` on the `system_metrics` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_system_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "tags" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_system_metrics" ("id", "name", "tags", "value") SELECT "id", "name", "tags", "value" FROM "system_metrics";
DROP TABLE "system_metrics";
ALTER TABLE "new_system_metrics" RENAME TO "system_metrics";
CREATE UNIQUE INDEX "system_metrics_name_key" ON "system_metrics"("name");
CREATE INDEX "system_metrics_name_updatedAt_idx" ON "system_metrics"("name", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
