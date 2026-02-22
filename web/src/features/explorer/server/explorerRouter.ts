import { z } from "zod/v4";
import { createTRPCRouter, protectedProjectProcedure } from "@/src/server/api/trpc";
import { explorerGet, explorerHealthCheck } from "./explorerClient";
import type { ChainNetwork, ChainStats, IndexerHealth } from "../types";

const NETWORKS: ChainNetwork[] = ["mainnet", "testnet", "devnet"];

// ---------------------------------------------------------------------------
// Explorer Router
// ---------------------------------------------------------------------------

export const explorerRouter = createTRPCRouter({
  getStats: protectedProjectProcedure
    .input(z.object({ projectId: z.string(), network: z.enum(["mainnet", "testnet", "devnet"]) }))
    .query(async ({ input }) => {
      const raw = await explorerGet<Record<string, unknown>>(input.network, "/api/v2/stats");
      return {
        network: input.network,
        totalBlocks: String(raw.total_blocks ?? raw.totalBlocks ?? "0"),
        totalTransactions: String(raw.total_transactions ?? raw.totalTransactions ?? "0"),
        totalAddresses: raw.total_addresses
          ? String(raw.total_addresses)
          : raw.totalAddresses
            ? String(raw.totalAddresses)
            : undefined,
        averageBlockTime:
          typeof raw.average_block_time === "number"
            ? raw.average_block_time
            : typeof raw.averageBlockTime === "number"
              ? raw.averageBlockTime
              : undefined,
        networkUtilization:
          typeof raw.network_utilization === "number"
            ? raw.network_utilization
            : typeof raw.networkUtilization === "number"
              ? raw.networkUtilization
              : undefined,
      } satisfies ChainStats;
    }),

  getAllStats: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    const results = await Promise.allSettled(
      NETWORKS.map(async (network) => {
        const raw = await explorerGet<Record<string, unknown>>(network, "/api/v2/stats");
        return {
          network,
          totalBlocks: String(raw.total_blocks ?? raw.totalBlocks ?? "0"),
          totalTransactions: String(raw.total_transactions ?? raw.totalTransactions ?? "0"),
          totalAddresses: raw.total_addresses
            ? String(raw.total_addresses)
            : raw.totalAddresses
              ? String(raw.totalAddresses)
              : undefined,
          averageBlockTime:
            typeof raw.average_block_time === "number"
              ? raw.average_block_time
              : typeof raw.averageBlockTime === "number"
                ? raw.averageBlockTime
                : undefined,
          networkUtilization:
            typeof raw.network_utilization === "number"
              ? raw.network_utilization
              : typeof raw.networkUtilization === "number"
                ? raw.networkUtilization
                : undefined,
        } satisfies ChainStats;
      }),
    );
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : ({
            network: NETWORKS[i]!,
            totalBlocks: "0",
            totalTransactions: "0",
          } satisfies ChainStats),
    );
  }),

  getHealth: protectedProjectProcedure.input(z.object({ projectId: z.string() })).query(async () => {
    const results = await Promise.allSettled(
      NETWORKS.map(async (network) => {
        const health = await explorerHealthCheck(network);
        let latestBlockNumber: string | undefined;
        let latestBlockTimestamp: string | undefined;

        if (health.healthy) {
          try {
            const stats = await explorerGet<Record<string, unknown>>(network, "/api/v2/stats");
            latestBlockNumber = stats.total_blocks
              ? String(stats.total_blocks)
              : stats.totalBlocks
                ? String(stats.totalBlocks)
                : undefined;
          } catch {
            // health check passed but stats might fail — still healthy
          }
        }

        return {
          network,
          healthy: health.healthy,
          latestBlockNumber,
          latestBlockTimestamp,
          responseTimeMs: health.responseTimeMs,
        } satisfies IndexerHealth;
      }),
    );
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : ({
            network: NETWORKS[i]!,
            healthy: false,
            responseTimeMs: 0,
          } satisfies IndexerHealth),
    );
  }),
});
