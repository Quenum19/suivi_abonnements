-- AlterTable: renouvellement automatique des abonnements
ALTER TABLE "subscriptions" ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: slug d'organisation (URL de connexion personnalisée)
ALTER TABLE "organizations" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
