import { stripeWebhookApiHandler } from "@/src/features/billing/server/stripeWebhookApiHandler";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// This is important for Stripe webhook handling
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  try {
    // Get all headers first
    const headersList = headers();
    const stripeSignature = headersList.get("stripe-signature");
    const contentLength = headersList.get("content-length");

    if (!stripeSignature) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400 }
      );
    }

    // Read the raw body as a buffer
    const chunks = [];
    const reader = req.body?.getReader();
    if (!reader) {
      console.error("[Stripe Webhook] No request body reader available");
      return new Response(
        JSON.stringify({ error: "No request body reader available" }),
        { status: 400 }
      );
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const bodyBuffer = Buffer.concat(chunks);
    const rawBody = bodyBuffer.toString('utf8');

    console.log("[Stripe Webhook] Received webhook request", {
      contentLength,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 100) // Log first 100 chars for debugging
    });

    if (!rawBody) {
      console.error("[Stripe Webhook] Empty request body");
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { status: 400 }
      );
    }

    // Create a new request with the raw body
    const newReq = new NextRequest(req.url, {
      method: req.method,
      headers: headersList,
      body: rawBody
    });

    return stripeWebhookApiHandler(newReq);
  } catch (error) {
    console.error("[Stripe Webhook] Error in webhook handler:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500 }
    );
  }
}
