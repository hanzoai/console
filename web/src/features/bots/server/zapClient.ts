import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

// ---------------------------------------------------------------------------
// ZAP HTTP Client for Bot Gateway
//
// Communicates with the bot control plane via the ZAP protocol (HTTP transport).
// Auth via KMS service token or BOT_GATEWAY_TOKEN env var.
// ---------------------------------------------------------------------------

function gatewayUrl(): string {
  return (
    env.ZAP_BOT_GATEWAY_URL ??
    env.BOT_GATEWAY_URL ??
    "https://bot.hanzo.ai"
  );
}

function gatewayToken(): string {
  const token =
    env.ZAP_BOT_GATEWAY_TOKEN ??
    env.BOT_GATEWAY_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Bot gateway auth not configured. " +
        "Set ZAP_BOT_GATEWAY_TOKEN or BOT_GATEWAY_TOKEN.",
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
    message: `Bot gateway error (${status}): ${body}`,
  });
}

async function zapRequest<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  const base = gatewayUrl();
  const url = new URL(path, base);
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${gatewayToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) throw toTRPCError(res.status, text);
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `Bot gateway request timed out: ${method} ${path}`,
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Bot gateway connection error: ${(err as Error).message}`,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call a ZAP tool on the bot gateway.
 * Maps to POST /v1/tools/call { name, args }
 */
export async function zapCallTool<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await zapRequest<{ content: T }>("POST", "/v1/tools/call", {
    body: { name, args },
  });
  return res.content;
}

/** GET helper */
export function zapGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return zapRequest<T>("GET", path, { params });
}

/** POST helper */
export function zapPost<T>(path: string, body: unknown): Promise<T> {
  return zapRequest<T>("POST", path, { body });
}

/** PATCH helper */
export function zapPatch<T>(path: string, body: unknown): Promise<T> {
  return zapRequest<T>("PATCH", path, { body });
}

/** DELETE helper */
export function zapDelete<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return zapRequest<T>("DELETE", path, { params });
}
