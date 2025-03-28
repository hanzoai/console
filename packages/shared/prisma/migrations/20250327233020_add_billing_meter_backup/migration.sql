/*
  Warnings:

  - You are about to drop the column `created_at` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `current_period_end` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `current_subscription_id` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `current_subscription_plan` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `last_subscription_change_at` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_customer_id` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_id` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_status` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `organizations` table. All the data in the column will be lost.
  - You are about to drop the `StripeCheckoutSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stripe_customers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stripe_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stripe_payment_methods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stripe_subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BlobStorageIntegrationType" AS ENUM ('S3', 'S3_COMPATIBLE', 'AZURE_BLOB_STORAGE');

-- DropForeignKey
ALTER TABLE "StripeCheckoutSession" DROP CONSTRAINT "StripeCheckoutSession_customerId_fkey";

-- DropForeignKey
ALTER TABLE "StripeCheckoutSession" DROP CONSTRAINT "StripeCheckoutSession_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "StripeCheckoutSession" DROP CONSTRAINT "StripeCheckoutSession_stripeSubscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_stripe_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_customers" DROP CONSTRAINT "stripe_customers_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_invoices" DROP CONSTRAINT "stripe_invoices_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_invoices" DROP CONSTRAINT "stripe_invoices_stripe_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_payment_methods" DROP CONSTRAINT "stripe_payment_methods_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_payment_methods" DROP CONSTRAINT "stripe_payment_methods_stripe_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_subscriptions" DROP CONSTRAINT "stripe_subscriptions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "stripe_subscriptions" DROP CONSTRAINT "stripe_subscriptions_stripe_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_organization_id_fkey";

-- DropIndex
DROP INDEX "organizations_stripe_customer_id_key";

-- DropIndex
DROP INDEX "organizations_subscription_id_key";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "created_at",
DROP COLUMN "current_period_end",
DROP COLUMN "current_subscription_id",
DROP COLUMN "current_subscription_plan",
DROP COLUMN "last_subscription_change_at",
DROP COLUMN "stripe_customer_id",
DROP COLUMN "subscription_id",
DROP COLUMN "subscription_status",
DROP COLUMN "updated_at";

-- DropTable
DROP TABLE "StripeCheckoutSession";

-- DropTable
DROP TABLE "stripe_customers";

-- DropTable
DROP TABLE "stripe_invoices";

-- DropTable
DROP TABLE "stripe_payment_methods";

-- DropTable
DROP TABLE "stripe_subscriptions";

-- DropTable
DROP TABLE "subscriptions";

-- CreateTable
CREATE TABLE "blob_storage_integrations" (
    "project_id" TEXT NOT NULL,
    "type" "BlobStorageIntegrationType" NOT NULL,
    "bucket_name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "access_key_id" TEXT NOT NULL,
    "secret_access_key" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "endpoint" TEXT,
    "force_path_style" BOOLEAN NOT NULL,
    "next_sync_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL,
    "export_frequency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blob_storage_integrations_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "sso_configs" (
    "domain" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auth_provider" TEXT NOT NULL,
    "auth_config" JSONB,

    CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("domain")
);

-- AddForeignKey
ALTER TABLE "blob_storage_integrations" ADD CONSTRAINT "blob_storage_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
