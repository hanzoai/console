import { stripeWebhookApiHandler } from "@/src/ee/features/billing/server/stripeWebhookApiHandler";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text(); // Get the raw body
  const headersList = headers(); // Get the headers
  
  // Convert to NextRequest
  const newReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: body // Pass the raw body
  });

  return stripeWebhookApiHandler(newReq);
}
