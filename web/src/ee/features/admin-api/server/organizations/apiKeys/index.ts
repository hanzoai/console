import { type NextApiRequest, type NextApiResponse } from "next";
import type { ParsedUrlQuery } from "querystring";

export function validateQueryAndExtractId(query: ParsedUrlQuery): string | null {
  const { organizationId } = query;
  if (!organizationId || typeof organizationId !== "string") return null;
  return organizationId;
}

export async function handleGetApiKeys(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleCreateApiKey(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}
