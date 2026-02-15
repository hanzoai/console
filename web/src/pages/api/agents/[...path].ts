import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyProxyTenantHeaders,
  buildProxyTenantHeaders,
} from "@/src/server/tenant-headers";

/**
 * Catch-all proxy for Hanzo Agents control plane API.
 *
 * Forwards /api/agents/* to ${AGENTS_API_URL}/* stripping the /api/agents prefix.
 * Server-side only -- AGENTS_API_URL is never exposed to the client.
 *
 * Multi-tenant: extracts org/project/actor/env context from the console
 * session and injects headers for downstream scoping.
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

const TIMEOUT_MS = 30_000;

/** Headers that must not be forwarded between hops (RFC 2616 / 7230). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

/** Read the raw body from an incoming request stream. */
function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const agentsUrl = process.env.AGENTS_API_URL;
  if (!agentsUrl) {
    return res.status(503).json({
      error: "Hanzo Agents API not configured",
      message: "AGENTS_API_URL environment variable is not set",
    });
  }

  // Build upstream path from catch-all segments.
  const pathSegments = req.query.path;
  if (!pathSegments || !Array.isArray(pathSegments)) {
    return res.status(400).json({ error: "Invalid path" });
  }
  const upstreamPath = pathSegments.map(encodeURIComponent).join("/");

  // Preserve query string (minus the catch-all `path` param injected by Next.js).
  const query = { ...req.query };
  delete query.path;
  const qs = new URLSearchParams(
    query as Record<string, string>,
  ).toString();

  const targetUrl = `${agentsUrl.replace(/\/+$/, "")}/${upstreamPath}${qs ? `?${qs}` : ""}`;

  // Build forwarded headers, dropping hop-by-hop and tenant headers.
  // Tenant headers (x-org-id, x-project-id, x-tenant-id, x-actor-id) are
  // stripped from the client request and replaced with session-derived values
  // to prevent cross-tenant access via header injection.
  const TENANT_HEADERS = new Set(["x-org-id", "x-project-id", "x-tenant-id", "x-actor-id"]);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP.has(lowerKey)) continue;
    if (TENANT_HEADERS.has(lowerKey)) continue;
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  applyProxyTenantHeaders(headers, await buildProxyTenantHeaders(req, res));

  // Read body for methods that carry one.
  let body: Buffer | undefined;
  if (req.method && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    body = await readBody(req);
  }

  // Abort on timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Forward status.
    res.status(upstream.status);

    // Forward response headers, skipping hop-by-hop.
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    // Stream body back to client.
    if (upstream.body) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }

    res.end();
  } catch (err) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === "AbortError") {
      return res.status(504).json({
        error: "Gateway Timeout",
        message: `Hanzo Agents API did not respond within ${TIMEOUT_MS}ms`,
      });
    }

    const message =
      err instanceof Error ? err.message : "Unknown proxy error";
    console.error("[agents-proxy]", message);
    return res.status(502).json({
      error: "Bad Gateway",
      message: `Failed to reach Hanzo Agents API: ${message}`,
    });
  }
}
