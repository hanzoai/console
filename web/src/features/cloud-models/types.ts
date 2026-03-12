import { z } from "zod/v4";

// ── Cloud Model (from Cloud API GET /api/models) ────────────────────

export const CloudModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  owned_by: z.string(),
  premium: z.boolean(),
});
export type CloudModel = z.infer<typeof CloudModelSchema>;

export const CloudModelsResponseSchema = z.object({
  object: z.string(),
  data: z.array(CloudModelSchema),
});
export type CloudModelsResponse = z.infer<typeof CloudModelsResponseSchema>;

// ── Pricing data (from pricing API) ─────────────────────────────────

export type ModelPricing = {
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  inputCostPerMTok?: number;
  outputCostPerMTok?: number;
};

// ── Provider (derived from owned_by) ────────────────────────────────

export const providerLabels: Record<string, string> = {
  "do-ai": "DigitalOcean AI",
  fireworks: "Fireworks AI",
  "openai-direct": "OpenAI Direct",
  anthropic: "Anthropic",
  hanzo: "Hanzo (Zen)",
};

// ── Model Configuration (per-project settings) ─────────────────────

export const ModelConfigSchema = z.object({
  projectId: z.string(),
  defaultModel: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const UpdateModelConfigInput = z.object({
  projectId: z.string(),
  defaultModel: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(128000),
});
export type UpdateModelConfigInput = z.infer<typeof UpdateModelConfigInput>;
