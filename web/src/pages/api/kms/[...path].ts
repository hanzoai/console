import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAuthSession } from "@/src/server/auth";

/**
 * Catch-all proxy for Hanzo KMS API.
 *
 * Forwards /api/kms/* to ${KMS_API_URL}/* stripping the /api/kms prefix.
 * Server-side only -- KMS_API_URL is never exposed to the client.
 *
 * Multi-tenant: extracts org/project context from the console session and
 * injects X-Org-ID / X-Project-ID headers so the KMS backend can scope
 * its responses per-organization.
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
  const kmsUrl = process.env.KMS_API_URL;
  if (!kmsUrl) {
    return res.status(503).json({
      error: "Hanzo KMS API not configured",
      message: "KMS_API_URL environment variable is not set",
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

  const targetUrl = `${kmsUrl.replace(/\/+$/, "")}/${upstreamPath}${qs ? `?${qs}` : ""}`;

  // Build forwarded headers, dropping hop-by-hop.
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  // Inject org/project context from console session (best-effort, non-blocking).
  try {
    const session = await getServerAuthSession({ req, res });
    if (session?.user) {
      const orgId =
        (session as any).orgId ??
        session.user.organizations?.[0]?.id;
      const projectId =
        (session as any).projectId ??
        session.user.organizations?.[0]?.projects?.[0]?.id;
      if (orgId) headers["x-org-id"] = orgId;
      if (projectId) headers["x-project-id"] = projectId;
    }
  } catch {
    // Session extraction failed — continue without context headers.
  }

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
        message: `Hanzo KMS API did not respond within ${TIMEOUT_MS}ms`,
      });
    }

    const message =
      err instanceof Error ? err.message : "Unknown proxy error";
    console.error("[kms-proxy]", message);
    return res.status(502).json({
      error: "Bad Gateway",
      message: `Failed to reach Hanzo KMS API: ${message}`,
    });
  }
}
