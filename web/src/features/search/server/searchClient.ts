import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

const SEARCH_API_BASE = "https://api.cloud.hanzo.ai";

function toTRPCError(status: number, body: string): TRPCError {
  const map: Record<number, TRPCError["code"]> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    429: "TOO_MANY_REQUESTS",
  };
  return new TRPCError({
    code: map[status] ?? "INTERNAL_SERVER_ERROR",
    message: `Search API error (${status}): ${body}`,
  });
}

/**
 * Resolve the API key for calling the Search/Vector service.
 *
 * Uses the project's secret key from the session context. Falls back to the
 * HANZO_SEARCH_API_KEY env var for dev/single-tenant deployments.
 */
export function resolveApiKey(secretKey?: string): string {
  if (secretKey) return secretKey;

  const globalKey = env.HANZO_SEARCH_API_KEY;
  if (globalKey) return globalKey;

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Search API key is not configured. " + "Ensure your project has an API key or set HANZO_SEARCH_API_KEY env var.",
  });
}

async function searchRequest<T>(
  method: string,
  path: string,
  apiKey: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(path, SEARCH_API_BASE);
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) throw toTRPCError(res.status, text);

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function searchGet<T>(path: string, apiKey: string, params?: Record<string, string | undefined>): Promise<T> {
  return searchRequest<T>("GET", path, apiKey, { params });
}

export function searchPost<T>(
  path: string,
  apiKey: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return searchRequest<T>("POST", path, apiKey, { body, params });
}

export function searchDelete<T>(path: string, apiKey: string, params?: Record<string, string | undefined>): Promise<T> {
  return searchRequest<T>("DELETE", path, apiKey, { params });
}
