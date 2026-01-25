import { env } from "@/src/env.mjs";
import Stripe from "stripe";

export const stripeClient = (() => {
  if (!env.STRIPE_SECRET_KEY) {
    console.warn("Stripe secret key is missing");
    return undefined;
  }

  if (!env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION) {
    console.warn("Hanzo Cloud cloud region is missing");
    return undefined;
  }

  try {
    return new Stripe(env.STRIPE_SECRET_KEY);
  } catch (error) {
    console.error("Failed to initialize Stripe client:", error);
    return undefined;
  }
})();
