import { z } from "zod/v4";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { cloudGet, cloudPost } from "./cloudModelClient";
import {
  CloudModelsResponseSchema,
  UpdateModelConfigInput,
  type CloudModelsResponse,
  type ModelConfig,
  type ModelPricing,
} from "../types";
const PRICING_API_URL = process.env.PRICING_API_URL ?? "http://pricing.hanzo.svc:8080";

/** Fetch pricing map from Hanzo pricing API (best-effort, returns empty on failure) */
async function fetchPricingMap(): Promise<Map<string, ModelPricing>> {
  const map = new Map<string, ModelPricing>();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${PRICING_API_URL}/v1/pricing/models`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!res.ok) return map;
    const data = (await res.json()) as {
      models?: Array<{
        id: string;
        pricing?: {
          input_cost_per_token?: number;
          output_cost_per_token?: number;
          input_cost_per_mtok?: number;
          output_cost_per_mtok?: number;
        };
      }>;
    };
    for (const m of data.models ?? []) {
      if (m.pricing) {
        map.set(m.id, {
          inputCostPerToken: m.pricing.input_cost_per_token,
          outputCostPerToken: m.pricing.output_cost_per_token,
          inputCostPerMTok: m.pricing.input_cost_per_mtok,
          outputCostPerMTok: m.pricing.output_cost_per_mtok,
        });
      }
    }
  } catch {
    // Pricing API unreachable — return empty map, models still shown without pricing
  }
  return map;
}

export const cloudModelsRouter = createTRPCRouter({
  // ── List available models from Cloud API + pricing ────────────────

  list: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    try {
      const [raw, pricingMap] = await Promise.all([
        cloudGet<CloudModelsResponse>({ path: "/api/models" }),
        fetchPricingMap(),
      ]);
      const parsed = CloudModelsResponseSchema.safeParse(raw);
      if (parsed.success) {
        return {
          ...parsed.data,
          data: parsed.data.data.map((m) => ({
            ...m,
            pricing: pricingMap.get(m.id) ?? null,
          })),
        };
      }
      return { object: "list" as const, data: [] };
    } catch {
      return { object: "list" as const, data: [] };
    }
  }),

  // ── Get project model configuration ─────────────────────────────────

  getConfig: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    try {
      return await cloudGet<ModelConfig>({
        path: "/api/model-config",
        queryParams: { projectId: input.projectId },
      });
    } catch {
      return {
        projectId: input.projectId,
        defaultModel: "zen4",
        temperature: 0.7,
        maxTokens: 4096,
      } satisfies ModelConfig;
    }
  }),

  // ── Update project model configuration ──────────────────────────────

  updateConfig: protectedProjectProcedure.input(UpdateModelConfigInput).mutation(async ({ input }) => {
    try {
      return await cloudPost<ModelConfig>({
        path: "/api/model-config",
        body: {
          projectId: input.projectId,
          defaultModel: input.defaultModel,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        },
      });
    } catch {
      return {
        projectId: input.projectId,
        defaultModel: input.defaultModel,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      } satisfies ModelConfig;
    }
  }),
});
