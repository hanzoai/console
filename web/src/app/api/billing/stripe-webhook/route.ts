import { stripeWebhookHandler } from "@/src/ee/features/billing/server/stripeWebhookHandler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export const POST = stripeWebhookHandler;
