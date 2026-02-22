import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

function baseUrl(): string {
  return env.PAAS_API_URL ?? "https://platform.hanzo.ai";
}

function getToken(): string {
  const token = env.PAAS_SERVICE_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "PaaS authentication is not configured. Set PAAS_SERVICE_TOKEN env var.",
    });
  }
  return token;
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
    message: `PaaS API error (${status}): ${body}`,
  });
}

async function paasRequest<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
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
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) throw toTRPCError(res.status, text);

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function paasGet<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  return paasRequest<T>("GET", path, { params });
}

export function paasPost<T>(path: string, body?: unknown, params?: Record<string, string | undefined>): Promise<T> {
  return paasRequest<T>("POST", path, { body, params });
}
