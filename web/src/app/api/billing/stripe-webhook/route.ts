import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

/**
 * Billing webhook handler - stub for community edition.
 * Billing webhooks are handled by the Hanzo Commerce service directly.
 */
export const POST = async () => {
  return NextResponse.json({ error: "Billing features are not available in community edition" }, { status: 501 });
};
