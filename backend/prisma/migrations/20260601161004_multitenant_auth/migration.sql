/*
  Warnings:

  - Added the required column `organizationId` to the `reminders_sent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "calendarToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reminders_sent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminders_sent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminders_sent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reminders_sent" ("channel", "id", "sentAt", "subscriptionId", "thresholdDays") SELECT "channel", "id", "sentAt", "subscriptionId", "thresholdDays" FROM "reminders_sent";
DROP TABLE "reminders_sent";
ALTER TABLE "new_reminders_sent" RENAME TO "reminders_sent";
CREATE INDEX "reminders_sent_subscriptionId_idx" ON "reminders_sent"("subscriptionId");
CREATE INDEX "reminders_sent_organizationId_idx" ON "reminders_sent"("organizationId");
CREATE UNIQUE INDEX "reminders_sent_subscriptionId_thresholdDays_channel_key" ON "reminders_sent"("subscriptionId", "thresholdDays", "channel");
CREATE TABLE "new_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Autres',
    "startDate" DATETIME,
    "expiryDate" DATETIME NOT NULL,
    "amount" REAL,
    "currency" TEXT,
    "notes" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'yearly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "responsible" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subscriptions" ("amount", "category", "createdAt", "currency", "expiryDate", "frequency", "id", "name", "notes", "responsible", "startDate", "status", "updatedAt") SELECT "amount", "category", "createdAt", "currency", "expiryDate", "frequency", "id", "name", "notes", "responsible", "startDate", "status", "updatedAt" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
CREATE INDEX "subscriptions_expiryDate_idx" ON "subscriptions"("expiryDate");
CREATE INDEX "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");
CREATE INDEX "subscriptions_category_idx" ON "subscriptions"("category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_calendarToken_key" ON "organizations"("calendarToken");

-- CreateIndex
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");
