// ---------------------------------------------------------------------------
// MPC API client
//
// Calls mpc.hanzo.ai REST endpoints with the project's auth bearer token.
// Used by React Query hooks in hooks.ts.
// ---------------------------------------------------------------------------

const MPC_BASE_URL = "https://mpc.hanzo.ai/api";

export class MpcApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MpcApiError";
    this.status = status;
  }
}

/**
 * Fetch helper for MPC API endpoints.
 *
 * Auth token is pulled from the browser cookie (same-origin) or passed
 * explicitly.  The console API proxy at /api/mpc/* can be added later;
 * for now we call the external endpoint directly.
 */
export async function mpcFetch<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown; token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(`${MPC_BASE_URL}${path}`, {
    method: opts?.method ?? "GET",
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      message = text;
    }
    throw new MpcApiError(res.status, message);
  }

  return (await res.json()) as T;
}
