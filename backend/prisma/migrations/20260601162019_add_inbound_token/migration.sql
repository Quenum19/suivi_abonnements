/*
  Warnings:

  - The required column `inboundToken` was added to the `organizations` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "calendarToken" TEXT NOT NULL,
    "inboundToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_organizations" ("calendarToken", "createdAt", "id", "name", "plan", "updatedAt") SELECT "calendarToken", "createdAt", "id", "name", "plan", "updatedAt" FROM "organizations";
DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE UNIQUE INDEX "organizations_calendarToken_key" ON "organizations"("calendarToken");
CREATE UNIQUE INDEX "organizations_inboundToken_key" ON "organizations"("inboundToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
