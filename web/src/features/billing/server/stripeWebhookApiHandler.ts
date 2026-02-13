import { type NextRequest, NextResponse } from "next/server";

/**
 * Stripe webhook handler — stub.
 * Billing webhooks are handled by the Hanzo Commerce service directly.
 */
export async function stripeWebhookApiHandler(_req: NextRequest) {
  return NextResponse.json(
    { message: "Billing webhooks are handled by Hanzo Commerce service" },
    { status: 501 },
  );
}
