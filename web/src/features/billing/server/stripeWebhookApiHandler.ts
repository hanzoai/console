import { type NextRequest, NextResponse } from "next/server";

/**
 * Billing webhook handler - stub.
 * Billing webhooks are handled by the Hanzo Commerce service directly.
 */
export async function billingWebhookApiHandler(_req: NextRequest) {
  return NextResponse.json(
    { message: "Billing webhooks are handled by Hanzo Commerce service" },
    { status: 501 },
  );
}

/** @deprecated Use billingWebhookApiHandler instead */
export const stripeWebhookApiHandler = billingWebhookApiHandler;
