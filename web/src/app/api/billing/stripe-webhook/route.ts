import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

/**
 * Stripe webhook handler - stub for community edition.
 * Billing features are only available in the enterprise/cloud edition.
 */
export const POST = async () => {
  return NextResponse.json(
    { error: "Billing features are not available in community edition" },
    { status: 501 },
  );
};
