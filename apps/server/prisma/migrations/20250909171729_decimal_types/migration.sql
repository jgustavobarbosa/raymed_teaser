/*
  Warnings:

  - You are about to alter the column `value` on the `prices` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `targetPrice` on the `subscriptions` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.
  - You are about to alter the column `value` on the `system_metrics` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Decimal`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicationId" TEXT NOT NULL,
    "labId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'RayAPI',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "value" DECIMAL NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT,
    CONSTRAINT "prices_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prices_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_prices" ("capturedAt", "currency", "id", "labId", "medicationId", "meta", "receivedAt", "source", "value") SELECT "capturedAt", "currency", "id", "labId", "medicationId", "meta", "receivedAt", "source", "value" FROM "prices";
DROP TABLE "prices";
ALTER TABLE "new_prices" RENAME TO "prices";
CREATE INDEX "prices_medicationId_capturedAt_idx" ON "prices"("medicationId", "capturedAt");
CREATE INDEX "prices_labId_capturedAt_idx" ON "prices"("labId", "capturedAt");
CREATE INDEX "prices_capturedAt_idx" ON "prices"("capturedAt");
CREATE INDEX "prices_medicationId_labId_capturedAt_idx" ON "prices"("medicationId", "labId", "capturedAt");
CREATE TABLE "new_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "labId" TEXT,
    "minDropPct" REAL,
    "targetPrice" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_subscriptions" ("createdAt", "id", "isActive", "labId", "medicationId", "minDropPct", "targetPrice", "userId") SELECT "createdAt", "id", "isActive", "labId", "medicationId", "minDropPct", "targetPrice", "userId" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_medicationId_idx" ON "subscriptions"("medicationId");
CREATE INDEX "subscriptions_isActive_idx" ON "subscriptions"("isActive");
CREATE UNIQUE INDEX "subscriptions_userId_medicationId_labId_key" ON "subscriptions"("userId", "medicationId", "labId");
CREATE TABLE "new_system_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "tags" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_system_metrics" ("id", "name", "tags", "timestamp", "value") SELECT "id", "name", "tags", "timestamp", "value" FROM "system_metrics";
DROP TABLE "system_metrics";
ALTER TABLE "new_system_metrics" RENAME TO "system_metrics";
CREATE INDEX "system_metrics_name_timestamp_idx" ON "system_metrics"("name", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
