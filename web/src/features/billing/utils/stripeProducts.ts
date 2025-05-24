import { env } from "@/src/env.mjs";
// import { type Plan } from "@hanzo/shared";

export interface StripeProduct {
  id: string; // Unique identifier
  stripeProductId: string;
  name: string;
  description?: string;
  checkout: boolean;
  active?: boolean
  title?: string; // Add optional title for backwards compatibility
}

// map of planid to plan name
export const stripeProducts: StripeProduct[] = [
  {
    id: 'credits-plan',
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
        env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_Ru16ryEtJtEmRh" // test
        : "prod_Ru0gok2x52s57Y", // live
    name: "Credits",
    title: "Credits",
    description: "For serious projects. Includes access to full history, higher usage and access to features.",
    checkout: true,
    active: false
  },
  {
    id: 'pro-plan',
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
        env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_RtxpuU81xgUmtC" // test
        : "prod_RsXQA8ueb1y03D", // live
    name: "Pro",
    title: "Pro",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
    active: false

  },
  {
    id: 'team-plan',
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
        env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_RtxpPPb2RTz8bj" // test
        : "prod_RsXMLhxoR4rauv", // live
    name: "Team",
    title: "Team",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
    active: false

  },
  {
    id: 'dev-plan',
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
        env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_RtxoClDkiPAOAs" // test
        : "prod_RsVYLiuNEcSgQj", // live
    name: "Dev",
    title: "Dev",
    description: "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
    active: false

  },
  {
    id: 'premium-plan',
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
        env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_SMzWLE1hJzYfTf" // test
        : "prod_SMzWLE1hJzYfTf", // live
    name: "Premium",
    title: "Premium",
    description: "Premium plan ideal for individuals and teams working on advanced projects. Includes access to AI-powered tools, team collaboration features, extended usage limits, and priority support. ",
    checkout: true,
    active: true
  },
];

export const mapStripeProductIdToPlan = (productId: string): string | null =>
  stripeProducts.find((product) => product.stripeProductId === productId)
    ?.name ?? null;
