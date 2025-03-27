// Placeholder for Stripe webhook handler
import { NextRequest, NextResponse } from "next/server";

export async function stripeWebhookApiHandler(req: NextRequest) {
  return NextResponse.json({ success: true });
}
