import { TRPCError } from "@trpc/server";
import type { ChainNetwork } from "../types";

const INDEXER_URLS: Record<ChainNetwork, string> = {
  mainnet: "https://api-explore.lux.network",
  testnet: "https://api-explore-test.lux.network",
  devnet: "https://api-explore-dev.lux.network",
};

function toTRPCError(status: number, body: string): TRPCError {
  const map: Record<number, TRPCError["code"]> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    429: "TOO_MANY_REQUESTS",
  };
  return new TRPCError({
    code: map[status] ?? "INTERNAL_SERVER_ERROR",
    message: `Explorer API error (${status}): ${body}`,
  });
}

export async function explorerGet<T>(network: ChainNetwork, path: string): Promise<T> {
  const base = INDEXER_URLS[network];
  const url = new URL(path, base);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) throw toTRPCError(res.status, text);

    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `Explorer ${network} request timed out`,
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Explorer ${network} request failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function explorerHealthCheck(
  network: ChainNetwork,
): Promise<{ healthy: boolean; responseTimeMs: number }> {
  const base = INDEXER_URLS[network];
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${base}/api/v2/stats`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const responseTimeMs = Date.now() - start;
    return { healthy: res.ok, responseTimeMs };
  } catch {
    return { healthy: false, responseTimeMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}
