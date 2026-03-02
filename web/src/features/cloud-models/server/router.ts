import { z } from "zod/v4";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { cloudGet, cloudPost } from "./cloudModelClient";
import {
  CloudModelsResponseSchema,
  UpdateModelConfigInput,
  type CloudModelsResponse,
  type ModelConfig,
} from "../types";

export const cloudModelsRouter = createTRPCRouter({
  // ── List available models from Cloud API ────────────────────────────

  list: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    try {
      const raw = await cloudGet<CloudModelsResponse>({
        path: "/api/models",
      });
      const parsed = CloudModelsResponseSchema.safeParse(raw);
      if (parsed.success) {
        return parsed.data;
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
