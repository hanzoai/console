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
        // : "prod_Ru0gok2x52s57Y", // live
        : "prod_SVUpp1cE7V42At", // live
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
        : "prod_SRnfvBzuBEfiVI", // live
    name: "Premium",
    title: "Premium",
    description: "$20/user/month — billed based on your active team member list. Access all AI- powered tools and features. Built for teams needing full collaboration capabilities.Includes extended usage limits and priority support.Ideal for growing businesses and advanced projects.",
    checkout: true,
    active: true
  },
];

export const mapStripeProductIdToPlan = (productId: string): string | null =>
  stripeProducts.find((product) => product.stripeProductId === productId)
    ?.name ?? null;
