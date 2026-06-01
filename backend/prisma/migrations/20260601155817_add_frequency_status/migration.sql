-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Autres',
    "startDate" DATETIME,
    "expiryDate" DATETIME NOT NULL,
    "amount" REAL,
    "currency" TEXT,
    "notes" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'yearly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_subscriptions" ("amount", "category", "createdAt", "currency", "expiryDate", "id", "name", "notes", "startDate", "updatedAt") SELECT "amount", "category", "createdAt", "currency", "expiryDate", "id", "name", "notes", "startDate", "updatedAt" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
CREATE INDEX "subscriptions_expiryDate_idx" ON "subscriptions"("expiryDate");
CREATE INDEX "subscriptions_category_idx" ON "subscriptions"("category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
