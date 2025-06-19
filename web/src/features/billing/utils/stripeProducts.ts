import { env } from "@/src/env.mjs";
// import { type Plan } from "@hanzo/shared";

export interface StripeProduct {
  id: string; // Unique identifier
  stripeProductId: string;
  name: string;
  description?: string;
  checkout: boolean;
  active?: boolean;
  type: "persional" | "team" | "api" | "others";
  price: string;
  billingPeriod: string;
  title?: string; // Add optional title for backwards compatibility
  isPay?: boolean;
  billingPeriodsObject?: Record<string, Object>;
}

// map of planid to plan name
export const stripeProducts: StripeProduct[] = [
  {
    id: "credits-plan",
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_Ru16ryEtJtEmRh" // test
        : // : "prod_Ru0gok2x52s57Y", // live
          "prod_SVUpp1cE7V42At", // live
    name: "Credits",
    title: "Credits",
    description:
      "For serious projects. Includes access to full history, higher usage and access to features.",
    checkout: true,
    active: true,
    type: "others",
    price: "Free",
    billingPeriod: "forever",
  },
  {
    id: "dev-plan",
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_RtxoClDkiPAOAs" // test
        : "prod_RsVYLiuNEcSgQj", // live
    name: "Dev",
    title: "Dev",
    description:
      "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
    active: false,
    type: "persional",
    price: "Free",
    billingPeriod: "/forever",
  },
  {
    id: "pro-plan",
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_SVyXlhcWNjma3F" // test
        : "prod_RsVYLiuNEcSgQj", // live
    name: "Pro",
    title: "Pro",
    description:
      "The Pro plan for individuals who need advanced tools, private deployments, and premium features for personal projects.",
    checkout: true,
    active: false,
    type: "persional",
    price: "20$",
    billingPeriod: "/month",
  },
  {
    id: "max-plan",
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_RtxpuU81xgUmtC" // test
        : "prod_RsXQA8ueb1y03D", // live
    name: "Max",
    title: "Max Plan",
    description:
      "Dedicated solutions and support for your team. Contact us for additional add-ons listed on the pricing page.",
    checkout: true,
    active: false,
    type: "persional",
    price: "200$",
    billingPeriod: "/month",
  },
  {
    id: "premium-plan",
    stripeProductId:
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
      env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
        ? "prod_SMzWLE1hJzYfTf" // test
        : "prod_SRnfvBzuBEfiVI", // live
    name: "Premium",
    title: "Premium",
    description:
      "Premium plan ideal for individuals and teams working on advanced projects. Includes access to AI-powered tools, team collaboration features, extended usage limits, and priority support. ",
    checkout: true,
    active: true,
    type: "team",
    price: "30$",
    billingPeriod: "/month",
    billingPeriodsObject: {
      "/month": {
        price: "30$",
        priceId:
          env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
          env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
            ? "price_1RawtqJ03IK6WYmUYBKPaOy7" // test
            : "price_1RawvVJ03IK6WYmUkHWoZ7xd", // live
      },
      "/year": {
        price: "25$",
        priceId:
          env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
          env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
            ? "price_1Rax8YJ03IK6WYmUc4Xtu6sS" // test
            : "price_1Rax9KJ03IK6WYmUowIK1Y9N", // live
      },
    },
  },
  // {
  //   id: "premium-plan-year",
  //   stripeProductId:
  //     env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "DEV" ||
  //     env.NEXT_PUBLIC_HANZO_CLOUD_REGION === "STAGING"
  //       ? "prod_SMzWLE1hJzYfTf" // test
  //       : "prod_SMzWLE1hJzYfTf", // live
  //   name: "Premium",
  //   title: "Premium",
  //   description:
  //     "Premium plan ideal for individuals and teams working on advanced projects. Includes access to AI-powered tools, team collaboration features, extended usage limits, and priority support. ",
  //   checkout: true,
  //   active: true,
  //   type: "team",
  //   price: "25$",
  //   billingPeriod: "/user/year",
  // },
];

export const mapStripeProductIdToPlan = (productId: string): string | null =>
  stripeProducts.find((product) => product.stripeProductId === productId)
    ?.name ?? null;
