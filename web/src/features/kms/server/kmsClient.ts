import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

/** Cached token and its fetch time (for refresh logic). */
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_REFRESH_MS = 55 * 60 * 1000; // refresh every 55 min

/**
 * Obtain a KMS bearer token.
 *
 * Priority:
 *  1. Static KMS_SERVICE_TOKEN env var (simplest)
 *  2. Universal auth via KMS_CLIENT_ID + KMS_CLIENT_SECRET (auto-refresh)
 */
async function getToken(): Promise<string> {
  // Static token takes precedence
  if (env.KMS_SERVICE_TOKEN) return env.KMS_SERVICE_TOKEN;

  // Universal auth refresh
  if (env.KMS_CLIENT_ID && env.KMS_CLIENT_SECRET) {
    const now = Date.now();
    if (cachedToken && now - tokenFetchedAt < TOKEN_REFRESH_MS) {
      return cachedToken;
    }

    const res = await fetch(
      `${env.KMS_API_URL}/api/v1/auth/universal-auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: env.KMS_CLIENT_ID,
          clientSecret: env.KMS_CLIENT_SECRET,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `KMS auth failed (${res.status}): ${body}`,
      });
    }
    const data = (await res.json()) as { accessToken: string };
    cachedToken = data.accessToken;
    tokenFetchedAt = now;
    return cachedToken;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "KMS authentication is not configured. " +
      "Set KMS_SERVICE_TOKEN or KMS_CLIENT_ID + KMS_CLIENT_SECRET.",
  });
}

function baseUrl(): string {
  return env.KMS_API_URL;
}

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
    message: `KMS API error (${status}): ${body}`,
  });
}

async function kmsRequest<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  const token = await getToken();
  const url = new URL(path, baseUrl());
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  // On 401, clear cached token so next request re-authenticates
  if (res.status === 401) {
    cachedToken = null;
    tokenFetchedAt = 0;
  }

  const text = await res.text();
  if (!res.ok) throw toTRPCError(res.status, text);

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function kmsGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return kmsRequest<T>("GET", path, { params });
}

export function kmsPost<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return kmsRequest<T>("POST", path, { body, params });
}

export function kmsPatch<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return kmsRequest<T>("PATCH", path, { body, params });
}

export function kmsDelete<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return kmsRequest<T>("DELETE", path, { params });
}
