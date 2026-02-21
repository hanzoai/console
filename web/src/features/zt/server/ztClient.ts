import { env } from "@/src/env.mjs";

// ---------------------------------------------------------------------------
// ZT Edge Management API client.
//
// Authenticates via updb credentials and caches the zt-session token.
// Used by ztTools.ts (ZAP tool handlers) — no tRPC dependency.
// ---------------------------------------------------------------------------

/** Cached zt-session token and its fetch time. */
let cachedSession: string | null = null;
let sessionFetchedAt = 0;
const SESSION_REFRESH_MS = 25 * 60 * 1000; // refresh every 25 min (ZT default 30 min)

function baseUrl(): string {
  return env.ZT_API_URL;
}

/**
 * Authenticate against the ZT controller using updb credentials.
 * Returns a zt-session token.
 */
async function authenticate(): Promise<string> {
  const res = await fetch(
    `${baseUrl()}/edge/management/v1/authenticate?method=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: env.ZT_ADMIN_USERNAME,
        password: env.ZT_ADMIN_PASSWORD,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new ZtApiError(res.status, `ZT auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { data: { token: string } };
  return data.data.token;
}

/**
 * Obtain a zt-session token, caching it for reuse.
 */
async function getSession(): Promise<string> {
  const now = Date.now();
  if (cachedSession && now - sessionFetchedAt < SESSION_REFRESH_MS) {
    return cachedSession;
  }

  cachedSession = await authenticate();
  sessionFetchedAt = now;
  return cachedSession;
}

/** Structured error from ZT API calls. */
export class ZtApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ZtApiError";
    this.status = status;
  }
}

/**
 * ZT API response envelope: { data: T, meta: { ... } }
 */
export interface ZtEnvelope<T> {
  data: T;
  meta?: {
    filterableFields?: string[];
    pagination?: {
      limit: number;
      offset: number;
      totalCount: number;
    };
  };
}

async function ztRequest<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; params?: Record<string, string | undefined> },
): Promise<ZtEnvelope<T>> {
  const session = await getSession();
  const url = new URL(path, baseUrl());
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "zt-session": session,
      "Content-Type": "application/json",
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  // On 401, clear cached session so next request re-authenticates
  if (res.status === 401) {
    cachedSession = null;
    sessionFetchedAt = 0;
  }

  const text = await res.text();
  if (!res.ok) throw new ZtApiError(res.status, `ZT API error (${res.status}): ${text}`);

  return text ? (JSON.parse(text) as ZtEnvelope<T>) : ({ data: {} as T });
}

export function ztGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<ZtEnvelope<T>> {
  return ztRequest<T>("GET", path, { params });
}

export function ztPost<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<ZtEnvelope<T>> {
  return ztRequest<T>("POST", path, { body, params });
}

export function ztPatch<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<ZtEnvelope<T>> {
  return ztRequest<T>("PATCH", path, { body, params });
}

export function ztPut<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | undefined>,
): Promise<ZtEnvelope<T>> {
  return ztRequest<T>("PUT", path, { body, params });
}

export function ztDelete<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<ZtEnvelope<T>> {
  return ztRequest<T>("DELETE", path, { params });
}
