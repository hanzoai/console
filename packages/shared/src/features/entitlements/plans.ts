export const planLabels = {
  "cloud:free": "Free",
  "cloud:pro": "Pro",
  "cloud:team": "Team",
  "cloud:dev": "Dev",
  "cloud:premium": "Premium",
  "cloud:max": "Max",
  "self-hosted:pro": "Pro (self-hosted)",
  "self-hosted:team": "Team (self-hosted)",
  "self-hosted:dev": "Dev (self-hosted)",
} as const;

export type Plan = keyof typeof planLabels;

export const plans = Object.keys(planLabels) as Plan[];

// These functions are kept here to ensure consistency when updating plan names in the future.
export const isCloudPlan = (plan: Plan) => true; // bypass olg login
export const isSelfHostedPlan = (plan: Plan) => plan.startsWith("self-hosted");

export const isPlan = (value: string): value is Plan => plans.includes(value as Plan);
