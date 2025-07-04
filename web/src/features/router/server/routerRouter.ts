import {
  createTRPCRouter,
  protectedProcedure,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

// Connect to Hanzo Router tRPC endpoint
const ROUTER_URL = env.ROUTER_URL || "http://localhost:4000/trpc";

// Re-export procedures from Hanzo Router
export const routerRouter = createTRPCRouter({
  // Models endpoints
  models: createTRPCRouter({
    list: protectedProcedure
      .input(
        z
          .object({
            includePublic: z.boolean().default(true),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        // Forward request to Hanzo Router
        const response = await fetch(`${ROUTER_URL}/models.list`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({ input }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch models",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),

    create: protectedProjectProcedure
      .input(
        z.object({
          modelName: z.string(),
          litellmParams: z.object({
            model: z.string(),
            apiKey: z.string().optional(),
            apiBase: z.string().optional(),
          }),
          modelInfo: z
            .object({
              inputCostPerToken: z.number().optional(),
              outputCostPerToken: z.number().optional(),
              maxTokens: z.number().optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user has permission to create models
        if (!ctx.session.user.admin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin access required",
          });
        }

        const response = await fetch(`${ROUTER_URL}/models.create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            model_name: input.modelName,
            litellm_params: input.litellmParams,
            model_info: input.modelInfo,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create model",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),
  }),

  // Keys endpoints
  keys: createTRPCRouter({
    list: protectedProjectProcedure
      .input(
        z.object({
          teamId: z.string().optional(),
          includeSpend: z.boolean().default(true),
        })
      )
      .query(async ({ ctx, input }) => {
        const response = await fetch(`${ROUTER_URL}/keys.list`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            team_id: input.teamId || ctx.projectId,
            include_spend: input.includeSpend,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch keys",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),

    create: protectedProjectProcedure
      .input(
        z.object({
          keyAlias: z.string().optional(),
          models: z.array(z.string()).optional(),
          maxBudget: z.number().optional(),
          budgetDuration: z
            .enum(["daily", "weekly", "monthly", "yearly"])
            .optional(),
          rateLimits: z
            .object({
              tpm: z.number().optional(),
              rpm: z.number().optional(),
            })
            .optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const response = await fetch(`${ROUTER_URL}/keys.create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            key_alias: input.keyAlias,
            team_id: ctx.projectId,
            models: input.models,
            max_budget: input.maxBudget,
            budget_duration: input.budgetDuration,
            tpm_limit: input.rateLimits?.tpm,
            rpm_limit: input.rateLimits?.rpm,
            tags: input.tags,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create key",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),

    delete: protectedProjectProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const response = await fetch(`${ROUTER_URL}/keys.delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({ key: input.key }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete key",
          });
        }

        return { success: true };
      }),
  }),

  // Usage endpoints
  usage: createTRPCRouter({
    summary: protectedProjectProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          teamId: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const response = await fetch(`${ROUTER_URL}/usage.summary`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            start_date: input.startDate,
            end_date: input.endDate,
            team_id: input.teamId || ctx.projectId,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch usage",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),

    byModel: protectedProjectProcedure
      .input(
        z.object({
          startDate: z.date(),
          endDate: z.date(),
          teamId: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const response = await fetch(`${ROUTER_URL}/usage.byModel`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            start_date: input.startDate,
            end_date: input.endDate,
            team_id: input.teamId || ctx.projectId,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch usage by model",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),
  }),

  // MCP servers endpoints
  mcp: createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
      const response = await fetch(`${ROUTER_URL}/mcp.list`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
        },
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch MCP servers",
        });
      }

      const data = await response.json();
      return data.result.data;
    }),

    toggle: protectedProjectProcedure
      .input(
        z.object({
          serverName: z.string(),
          enabled: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.session.user.admin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin access required",
          });
        }

        const response = await fetch(`${ROUTER_URL}/mcp.toggle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
          },
          body: JSON.stringify({
            server_name: input.serverName,
            enabled: input.enabled,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to toggle MCP server",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),
  }),

  // Billing endpoints
  billing: createTRPCRouter({
    subscription: protectedProcedure.query(async ({ ctx }) => {
      const response = await fetch(`${ROUTER_URL}/billing.subscription`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
        },
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch subscription",
        });
      }

      const data = await response.json();
      return data.result.data;
    }),

    purchaseCredits: protectedProcedure
      .input(
        z.object({
          amountUsd: z.number().min(5).max(10000),
          teamId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const response = await fetch(
          `${ROUTER_URL}/billing.purchaseCredits`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${ctx.session.user.llmApiKey}`,
            },
            body: JSON.stringify({
              amount_usd: input.amountUsd,
              team_id: input.teamId || ctx.projectId,
            }),
          }
        );

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create payment",
          });
        }

        const data = await response.json();
        return data.result.data;
      }),
  }),
});