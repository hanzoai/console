import { z } from "zod/v4";

// ── Chain Network ───────────────────────────────────────────────────

export const ChainNetworkSchema = z.enum(["mainnet", "testnet", "devnet"]);
export type ChainNetwork = z.infer<typeof ChainNetworkSchema>;

// ── Chain Stats ─────────────────────────────────────────────────────

export const ChainStatsSchema = z.object({
  network: ChainNetworkSchema,
  totalBlocks: z.string(),
  totalTransactions: z.string(),
  totalAddresses: z.string().optional(),
  averageBlockTime: z.number().optional(),
  networkUtilization: z.number().optional(),
});
export type ChainStats = z.infer<typeof ChainStatsSchema>;

// ── Indexer Health ──────────────────────────────────────────────────

export const IndexerHealthSchema = z.object({
  network: ChainNetworkSchema,
  healthy: z.boolean(),
  latestBlockNumber: z.string().optional(),
  latestBlockTimestamp: z.string().optional(),
  syncLag: z.number().optional(),
  responseTimeMs: z.number().optional(),
  networkUtilization: z.number().optional(),
});
export type IndexerHealth = z.infer<typeof IndexerHealthSchema>;
