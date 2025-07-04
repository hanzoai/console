import { type PrismaClient } from "@hanzo/shared/src/db";
import { env } from "@/src/env.mjs";

interface LLMUsageData {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  byModel: Array<{
    model: string;
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

/**
 * Get LLM usage data for an organization from the Hanzo Router
 */
export async function getLLMUsageForOrganization(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  llmApiKey: string
): Promise<LLMUsageData> {
  try {
    const ROUTER_URL = env.ROUTER_URL || "http://localhost:4000/trpc";
    
    const response = await fetch(`${ROUTER_URL}/usage.summary`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        team_id: organizationId,
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch LLM usage");
    }

    const data = await response.json();
    return data.result.data;
  } catch (error) {
    console.error("Error fetching LLM usage:", error);
    // Return empty usage if error
    return {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      byModel: [],
    };
  }
}

/**
 * Get LLM usage limits based on organization plan
 */
export function getLLMUsageLimitsForPlan(plan: string): {
  monthlyTokenLimit: number | null;
  monthlyCostLimit: number | null;
  includedCredits: number;
} {
  switch (plan) {
    case "cloud:free":
    case "oss":
      return {
        monthlyTokenLimit: 1_000_000, // 1M tokens
        monthlyCostLimit: 10, // $10
        includedCredits: 0,
      };
    case "cloud:dev":
      return {
        monthlyTokenLimit: 10_000_000, // 10M tokens
        monthlyCostLimit: 100, // $100
        includedCredits: 10, // $10 included
      };
    case "cloud:team":
      return {
        monthlyTokenLimit: 50_000_000, // 50M tokens
        monthlyCostLimit: 500, // $500
        includedCredits: 50, // $50 included
      };
    case "cloud:pro":
      return {
        monthlyTokenLimit: null, // Unlimited
        monthlyCostLimit: null, // Pay as you go
        includedCredits: 100, // $100 included
      };
    default:
      return {
        monthlyTokenLimit: 1_000_000,
        monthlyCostLimit: 10,
        includedCredits: 0,
      };
  }
}

/**
 * Calculate overage charges for LLM usage
 */
export function calculateLLMOverageCharges(
  usage: LLMUsageData,
  plan: string
): {
  overageAmount: number;
  isOverLimit: boolean;
  usagePercentage: number;
} {
  const limits = getLLMUsageLimitsForPlan(plan);
  
  // Calculate usage after included credits
  const billableUsage = Math.max(0, usage.totalCost - limits.includedCredits);
  
  // Check if over monthly limit
  const isOverLimit = limits.monthlyCostLimit !== null && 
    billableUsage > limits.monthlyCostLimit;
  
  // Calculate overage amount (charges beyond included limit)
  const overageAmount = isOverLimit && limits.monthlyCostLimit !== null
    ? billableUsage - limits.monthlyCostLimit
    : 0;
  
  // Calculate usage percentage
  const usagePercentage = limits.monthlyCostLimit !== null
    ? (billableUsage / limits.monthlyCostLimit) * 100
    : 0;
  
  return {
    overageAmount,
    isOverLimit,
    usagePercentage,
  };
}