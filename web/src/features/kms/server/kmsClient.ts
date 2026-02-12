import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

function getHeaders(): Record<string, string> {
  const token = env.KMS_SERVICE_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "KMS service token is not configured",
    });
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
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
  const url = new URL(path, baseUrl());
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: getHeaders(),
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

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
