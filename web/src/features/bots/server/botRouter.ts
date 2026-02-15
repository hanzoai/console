import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { zapCallTool } from "./zapClient";
import {
  listPaymentMethods,
  addPaymentMethod,
  getCredits,
  getBotBilling,
  upgradeBotPlan,
} from "./commerceClient";
import { kmsGet } from "@/src/features/kms/server/kmsClient";
import type { Bot, BotLogEntry, BotInvoice, TeamPreset, BotDID, BotWallet } from "../types";

// ---------------------------------------------------------------------------
// Bot Router
//
// Bot lifecycle (list, create, start, stop, etc.) → ZAP gateway
// Billing, payments, credits → Hanzo Commerce API (direct)
// Secrets → Hanzo KMS
// ---------------------------------------------------------------------------

export const botRouter = createTRPCRouter({
  // ── Bot Lifecycle (via ZAP gateway) ─────────────────────────────────

  list: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<Bot[]>("bots.list", {
        projectId: input.projectId,
      });
    }),

  getById: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<Bot>("bots.get", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  create: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(64),
        platform: z.enum(["linux", "macos", "windows"]),
        region: z.string(),
        channels: z.array(z.string()),
        modelsEnabled: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      return zapCallTool<Bot>("bots.create", {
        projectId: input.projectId,
        name: input.name,
        platform: input.platform,
        region: input.region,
        channels: input.channels,
        modelsEnabled: input.modelsEnabled,
      });
    }),

  update: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        botId: z.string(),
        name: z.string().min(1).max(64).optional(),
        channels: z.array(z.string()).optional(),
        modelsEnabled: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return zapCallTool<Bot>("bots.update", {
        projectId: input.projectId,
        botId: input.botId,
        name: input.name,
        channels: input.channels,
        modelsEnabled: input.modelsEnabled,
      });
    }),

  delete: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .mutation(async ({ input }) => {
      return zapCallTool<{ ok: true }>("bots.delete", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  start: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .mutation(async ({ input }) => {
      return zapCallTool<Bot>("bots.start", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  stop: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .mutation(async ({ input }) => {
      return zapCallTool<Bot>("bots.stop", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  restart: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .mutation(async ({ input }) => {
      return zapCallTool<Bot>("bots.restart", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  getUsage: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<Bot["monthlyUsage"]>("bots.usage", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  getLogs: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        botId: z.string(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input }) => {
      return zapCallTool<BotLogEntry[]>("bots.logs", {
        projectId: input.projectId,
        botId: input.botId,
        limit: input.limit,
      });
    }),

  // ── Billing (via Hanzo Commerce API — direct) ───────────────────────

  getBilling: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), botId: z.string() }))
    .query(async ({ input }) => {
      const [billing, usage] = await Promise.all([
        getBotBilling(input.projectId, input.botId),
        zapCallTool<Bot["monthlyUsage"]>("bots.usage", {
          projectId: input.projectId,
          botId: input.botId,
        }).catch(() => ({ messages: 0, tokens: 0, cost: 0 })),
      ]);

      return {
        currentPlan: billing.currentPlan,
        monthlyBase: billing.monthlyBase,
        usage,
        invoices: billing.invoices as BotInvoice[],
      };
    }),

  upgradePlan: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        botId: z.string(),
        tier: z.enum(["free", "cloud", "cloud-pro"]),
      }),
    )
    .mutation(async ({ input }) => {
      await upgradeBotPlan(input.projectId, input.botId, input.tier);
      // Return updated bot
      return zapCallTool<Bot>("bots.get", {
        projectId: input.projectId,
        botId: input.botId,
      });
    }),

  // ── Payment Methods (via Hanzo Commerce API — direct) ───────────────

  listPaymentMethods: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return listPaymentMethods(input.projectId);
    }),

  addPaymentMethod: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: z.enum(["card", "crypto", "wire"]),
        nonce: z.string().optional(),
        walletAddress: z.string().optional(),
        network: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return addPaymentMethod(input.projectId, {
        type: input.type,
        nonce: input.nonce,
        walletAddress: input.walletAddress,
        network: input.network,
      });
    }),

  // ── Credits (via Hanzo Commerce API — direct) ───────────────────────

  getCredits: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return getCredits(input.projectId);
    }),

  // ── KMS Secrets (bot-scoped) ────────────────────────────────────────

  listSecrets: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        botId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return kmsGet<{ secrets: Array<{ key: string; value: string }> }>(
        "/api/v3/secrets/raw",
        {
          workspaceId: input.projectId,
          environment: "production",
          secretPath: `/bots/${input.botId}`,
        },
      );
    }),

  // ── Team Presets (via bot gateway) ──────────────────────────────────

  listTeamPresets: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async () => {
      return zapCallTool<TeamPreset[]>("team.presets.list", {});
    }),

  getTeamPreset: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), presetId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<TeamPreset>("team.presets.get", {
        presetId: input.presetId,
      });
    }),

  provisionTeamPreset: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        presetId: z.string(),
        workspace: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return zapCallTool<{ ok: boolean; agentId: string; name?: string }>(
        "team.provision",
        {
          presetId: input.presetId,
          workspace: input.workspace,
        },
      );
    }),

  provisionAllTeamPresets: protectedProjectProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async () => {
      return zapCallTool<{
        ok: boolean;
        created: number;
        existing: number;
        total: number;
      }>("team.provision.all", {});
    }),

  // ── Agent Identity (DID + Wallet) ─────────────────────────────────

  getAgentDID: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), agentId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<{ agentId: string; did: BotDID | null }>(
        "agent.did.get",
        { agentId: input.agentId },
      );
    }),

  createAgentDID: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        agentId: z.string(),
        method: z.enum(["hanzo", "lux", "pars", "zoo", "ai"]).default("hanzo"),
      }),
    )
    .mutation(async ({ input }) => {
      return zapCallTool<{ agentId: string; did: BotDID }>(
        "agent.did.create",
        { agentId: input.agentId, method: input.method },
      );
    }),

  getAgentWallet: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), agentId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<{ agentId: string; wallet: BotWallet | null }>(
        "agent.wallet.get",
        { agentId: input.agentId },
      );
    }),

  createAgentWallet: protectedProjectProcedure
    .input(
      z.object({
        projectId: z.string(),
        agentId: z.string(),
        chain: z
          .enum(["lux", "hanzo", "zoo", "pars"])
          .default("hanzo"),
      }),
    )
    .mutation(async ({ input }) => {
      return zapCallTool<{ agentId: string; wallet: BotWallet }>(
        "agent.wallet.create",
        { agentId: input.agentId, chain: input.chain },
      );
    }),

  getAgentIdentity: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), agentId: z.string() }))
    .query(async ({ input }) => {
      return zapCallTool<{
        agentId: string;
        name: string | null;
        emoji: string | null;
        avatar: string | null;
        did: BotDID | null;
        wallet: BotWallet | null;
      }>("agent.identity.full", { agentId: input.agentId });
    }),
});
