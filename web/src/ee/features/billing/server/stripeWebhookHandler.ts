import { type NextRequest, NextResponse } from "next/server";

/**
 * Stripe webhook handler - stub for community edition.
 * Billing webhooks are handled via Hanzo IAM at hanzo.id.
 */
export async function stripeWebhookHandler(_req: NextRequest) {
  return NextResponse.json({ message: "Billing is handled via Hanzo IAM at hanzo.id" }, { status: 501 });
}
