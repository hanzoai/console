import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Catch-all proxy for Hanzo O11y (observability) API.
 *
 * Forwards /api/observe/* to ${O11Y_URL}/api/* stripping the /api/observe prefix.
 * Server-side only -- O11Y_URL is never exposed to the client.
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

const TIMEOUT_MS = 30_000;

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

function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const o11yUrl = process.env.O11Y_URL ?? "https://o11y.hanzo.ai";

  const pathSegments = req.query.path;
  if (!pathSegments || !Array.isArray(pathSegments)) {
    return res.status(400).json({ error: "Invalid path" });
  }
  const upstreamPath = pathSegments.map(encodeURIComponent).join("/");

  const query = { ...req.query };
  delete query.path;
  const qs = new URLSearchParams(query as Record<string, string>).toString();

  const targetUrl = `${o11yUrl.replace(/\/+$/, "")}/api/${upstreamPath}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP.has(lowerKey)) continue;
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  let body: Buffer | undefined;
  if (req.method && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    body = await readBody(req);
  }

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
    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

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
        message: `O11y API did not respond within ${TIMEOUT_MS}ms`,
      });
    }

    const message = err instanceof Error ? err.message : "Unknown proxy error";
    console.error("[observe-proxy]", message);
    return res.status(502).json({
      error: "Bad Gateway",
      message: `Failed to reach O11y API: ${message}`,
    });
  }
}
