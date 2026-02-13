import { env } from "@/src/env.mjs";

export interface BillingProduct {
  id: string;
  productId: string;
  name: string;
  description?: string;
  checkout: boolean;
  active?: boolean;
  title?: string;
}

export const billingProducts: BillingProduct[] = [
  {
    id: "credits-plan",
    productId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" || env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_Ru16ryEtJtEmRh" // test
        : "prod_Ru0gok2x52s57Y", // live
    name: "Credits",
    title: "Credits",
    description: "For serious projects. Includes access to full history, higher usage and access to features.",
    checkout: true,
    active: true,
  },
  {
    id: "premium-plan",
    productId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" || env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_SMzWLE1hJzYfTf" // test
        : "prod_SMzWLE1hJzYfTf", // live
    name: "Premium",
    title: "Premium",
    description:
      "Premium plan ideal for individuals and teams working on advanced projects. Includes access to AI-powered tools, team collaboration features, extended usage limits, and priority support. ",
    checkout: true,
    active: true,
  },
];

export const mapProductIdToPlan = (productId: string): string | null =>
  billingProducts.find((product) => product.productId === productId)?.name ?? null;

/** @deprecated Use billingProducts instead */
export const stripeProducts = billingProducts;
/** @deprecated Use mapProductIdToPlan instead */
export const mapStripeProductIdToPlan = mapProductIdToPlan;
