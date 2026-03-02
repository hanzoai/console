import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

const VECTOR_API_BASE = "https://api.cloud.hanzo.ai";

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
    message: `Vector API error (${status}): ${body}`,
  });
}

export function resolveApiKey(): string {
  const globalKey = env.HANZO_SEARCH_API_KEY;
  if (globalKey) return globalKey;

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Vector API key is not configured. " + "Set HANZO_SEARCH_API_KEY env var.",
  });
}

async function vectorRequest<T>(
  method: string,
  path: string,
  apiKey: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(path, VECTOR_API_BASE);
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

export function vectorGet<T>(path: string, apiKey: string, params?: Record<string, string | undefined>): Promise<T> {
  return vectorRequest<T>("GET", path, apiKey, { params });
}

export function vectorPost<T>(
  path: string,
  apiKey: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return vectorRequest<T>("POST", path, apiKey, { body, params });
}

export function vectorDelete<T>(path: string, apiKey: string, params?: Record<string, string | undefined>): Promise<T> {
  return vectorRequest<T>("DELETE", path, apiKey, { params });
}
