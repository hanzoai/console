import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

/**
 * HTTP client for the Hanzo Commerce service.
 *
 * Follows the same pattern as kmsClient.ts — bearer-token auth with
 * request helpers that map HTTP errors to TRPCError codes.
 */

function baseUrl(): string {
  return env.COMMERCE_API_URL;
}

function getToken(): string {
  if (!env.COMMERCE_SERVICE_TOKEN) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Commerce authentication is not configured. Set COMMERCE_SERVICE_TOKEN.",
    });
  }
  return env.COMMERCE_SERVICE_TOKEN;
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
    message: `Commerce API error (${status}): ${body}`,
  });
}

async function commerceRequest<T>(
  method: string,
  path: string,
  opts?: {
    body?: unknown;
    params?: Record<string, string | undefined>;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const token = getToken();
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
      ...(opts?.headers ?? {}),
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) throw toTRPCError(res.status, text);

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function commerceGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  return commerceRequest<T>("GET", path, { params, headers });
}

export function commercePost<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  return commerceRequest<T>("POST", path, { body, params, headers });
}

export function commercePatch<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  return commerceRequest<T>("PATCH", path, { body, params, headers });
}

export function commerceDelete<T>(
  path: string,
  params?: Record<string, string | undefined>,
  headers?: Record<string, string>,
): Promise<T> {
  return commerceRequest<T>("DELETE", path, { params, headers });
}
