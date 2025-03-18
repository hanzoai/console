import { env } from "@/src/env.mjs";
// import { type Plan } from "@langfuse/shared";

export interface StripeProduct {
  id: string; // Unique identifier
  stripeProductId: string;
  name: string;
  description?: string;
  checkout: boolean;
  title?: string; // Add optional title for backwards compatibility
}

// map of planid to plan name
export const stripeProducts: StripeProduct[] = [
  {
    id: 'credits-plan',
    stripeProductId:
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "STAGING"
        ? "prod_Ru16ryEtJtEmRh" // test
        : "prod_Ru0gok2x52s57Y", // live
    name: "Credits",
    title: "Credits",
    description: "For serious projects. Includes access to full history, higher usage and access to features.",
    checkout: true,
  },
  {
    id: 'pro-plan',
    stripeProductId:
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "STAGING"
        ? "prod_RtxpuU81xgUmtC" // test
        : "prod_RsXQA8ueb1y03D", // live
    name: "Pro",
    title: "Pro",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
  },
  {
    id: 'team-plan',
    stripeProductId:
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "STAGING"
        ? "prod_RtxpuU81xgUmtC" // test
        : "prod_RsXMLhxoR4rauv", // live
    name: "Team",
    title: "Team",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
  },
  {
    id: 'dev-plan',
    stripeProductId:
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION === "STAGING"
        ? "prod_RtxoClDkiPAOAs" // test
        : "prod_RsVYLiuNEcSgQj", // live
    name: "Dev",
    title: "Dev",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
  },
];

export const mapStripeProductIdToPlan = (productId: string): string | null =>
  stripeProducts.find((product) => product.stripeProductId === productId)
    ?.name ?? null;
