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
    active: true
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
