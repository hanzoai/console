import { TRPCError } from "@trpc/server";
import { env } from "@/src/env.mjs";

// ---------------------------------------------------------------------------
// Commerce API Client — calls Hanzo Commerce directly (not via bot gateway)
//
// Endpoints:
//   GET  /api/v1/users/:userId/payment-methods
//   POST /api/v1/users/:userId/payment-methods
//   GET  /api/v1/users/:userId/subscriptions
//   GET  /api/v1/users/:userId/orders
//   GET  /api/v1/users/:userId/credits
//   POST /api/v1/billing/invoices
// ---------------------------------------------------------------------------

function commerceUrl(): string {
  return (
    env.COMMERCE_API_URL ?? "http://commerce.hanzo.svc.cluster.local:8001"
  );
}

function commerceToken(): string {
  const token = env.COMMERCE_SERVICE_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Commerce API auth not configured. Set COMMERCE_SERVICE_TOKEN.",
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
    message: `Commerce API error (${status}): ${body}`,
  });
}

async function commerceRequest<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<T> {
  const base = commerceUrl();
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
        Authorization: `Bearer ${commerceToken()}`,
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
        message: `Commerce API request timed out: ${method} ${path}`,
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Commerce API connection error: ${(err as Error).message}`,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** GET helper */
export function commerceGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return commerceRequest<T>("GET", path, { params });
}

/** POST helper */
export function commercePost<T>(path: string, body: unknown): Promise<T> {
  return commerceRequest<T>("POST", path, { body });
}

// ---------------------------------------------------------------------------
// Typed Commerce API methods
// ---------------------------------------------------------------------------

export interface CommercePaymentMethod {
  id: string;
  type: "card" | "crypto" | "wire";
  label: string;
  last4?: string;
  brand?: string;
  walletAddress?: string;
  network?: string;
  bankName?: string;
  isDefault: boolean;
}

export interface CommerceInvoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  description: string;
  paymentMethod?: string;
}

export interface CommerceCredits {
  balance: number;
  currency: string;
}

export interface CommerceSubscription {
  id: string;
  plan: string;
  status: "active" | "cancelled" | "past_due";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyBase: number;
}

/**
 * List payment methods for a project (scoped by projectId as userId).
 */
export function listPaymentMethods(projectId: string) {
  return commerceGet<CommercePaymentMethod[]>(
    `/api/v1/users/${projectId}/payment-methods`,
  );
}

/**
 * Add a payment method for a project.
 */
export function addPaymentMethod(
  projectId: string,
  data: {
    type: "card" | "crypto" | "wire";
    nonce?: string;
    walletAddress?: string;
    network?: string;
  },
) {
  return commercePost<{ id: string }>(
    `/api/v1/users/${projectId}/payment-methods`,
    data,
  );
}

/**
 * Get credits balance for a project.
 */
export function getCredits(projectId: string) {
  return commerceGet<CommerceCredits>(
    `/api/v1/users/${projectId}/credits`,
  );
}

/**
 * Get billing info (subscription + invoices) for a bot.
 */
export async function getBotBilling(projectId: string, botId: string) {
  const [subscription, invoices] = await Promise.all([
    commerceGet<CommerceSubscription | null>(
      `/api/v1/users/${projectId}/subscriptions`,
      { botId },
    ).catch(() => null),
    commerceGet<CommerceInvoice[]>(
      `/api/v1/users/${projectId}/orders`,
      { botId, type: "invoice" },
    ).catch(() => []),
  ]);

  return {
    currentPlan: subscription?.plan ?? "free",
    monthlyBase: subscription?.monthlyBase ?? 0,
    invoices: invoices ?? [],
  };
}

/**
 * Get the prepaid balance for a user (via Commerce billing API).
 * Returns available balance in cents.
 */
export function getBillingBalance(userId: string, currency = "usd") {
  return commerceGet<{
    user: string;
    currency: string;
    balance: number;
    holds: number;
    available: number;
  }>("/api/v1/billing/balance", { user: userId, currency });
}

/**
 * Upgrade a bot's subscription tier.
 */
export function upgradeBotPlan(
  projectId: string,
  botId: string,
  tier: string,
) {
  return commercePost<{ ok: boolean }>(
    `/api/v1/users/${projectId}/subscriptions`,
    { botId, plan: tier },
  );
}
