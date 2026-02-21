import type { NextApiRequest, NextApiResponse } from "next";
import { getServerAuthSession } from "@/src/server/auth";
import { hasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  callTool,
  getToolScope,
  type ZapToolRequest,
} from "@/src/features/zt/server/ztTools";
import { ZtApiError } from "@/src/features/zt/server/ztClient";

/**
 * ZAP tool endpoint for ZT (Zero Trust).
 *
 * Accepts: POST /api/zap/zt
 * Body:    { name: "zt.<tool>", args: { ... } }
 * Returns: { content: T }
 *
 * Auth: Next-Auth session + RBAC project scope check.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate via session
  const session = await getServerAuthSession({ req, res });
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse request body
  const body = req.body as { name?: string; args?: Record<string, unknown> };
  if (!body.name || typeof body.name !== "string") {
    return res.status(400).json({ error: "Missing or invalid tool name" });
  }

  const toolName = body.name;
  const args = body.args ?? {};

  // Check RBAC scope
  const scope = getToolScope(toolName);
  if (!scope) {
    return res.status(404).json({ error: `Unknown tool: ${toolName}` });
  }

  const projectId =
    typeof args.projectId === "string" ? args.projectId : undefined;
  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId in args" });
  }

  if (!hasProjectAccess({ session, projectId, scope })) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Dispatch tool call
  try {
    const request: ZapToolRequest = { name: toolName, args };
    const result = await callTool(request);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ZtApiError) {
      return res.status(err.status).json({
        error: err.message,
      });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[zap/zt]", message);
    return res.status(500).json({ error: message });
  }
}
