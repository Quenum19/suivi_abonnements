-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Autres',
    "startDate" DATETIME,
    "expiryDate" DATETIME NOT NULL,
    "amount" REAL,
    "currency" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reminders_sent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "thresholdDays" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminders_sent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "subscriptions_expiryDate_idx" ON "subscriptions"("expiryDate");

-- CreateIndex
CREATE INDEX "subscriptions_category_idx" ON "subscriptions"("category");

-- CreateIndex
CREATE INDEX "reminders_sent_subscriptionId_idx" ON "reminders_sent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_sent_subscriptionId_thresholdDays_channel_key" ON "reminders_sent"("subscriptionId", "thresholdDays", "channel");
