-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "current_subscription_id" TEXT,
ADD COLUMN     "current_subscription_plan" TEXT,
ADD COLUMN     "last_subscription_change_at" TIMESTAMP(3),
ADD COLUMN     "credits" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stripe_checkout_sessions" (
    "id" TEXT NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount_total" DOUBLE PRECISION,
    "currency" TEXT,
    "payment_status" TEXT,
    "subscription_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),

    CONSTRAINT "stripe_checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_checkout_sessions_stripe_session_id_key" ON "stripe_checkout_sessions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_organization_id_idx" ON "stripe_checkout_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_customer_id_idx" ON "stripe_checkout_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "stripe_checkout_sessions_subscription_id_idx" ON "stripe_checkout_sessions"("subscription_id");

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_checkout_sessions" ADD CONSTRAINT "stripe_checkout_sessions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "stripe_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE; 