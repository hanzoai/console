import { type NextRequest, NextResponse } from "next/server";

/**
 * Billing webhook handler - stub for community edition.
 * Billing webhooks are handled via Hanzo Commerce service.
 */
export async function billingWebhookHandler(_req: NextRequest) {
  return NextResponse.json({ message: "Billing is handled via Hanzo Commerce service" }, { status: 501 });
}

/** @deprecated Use billingWebhookHandler instead */
export const stripeWebhookHandler = billingWebhookHandler;
