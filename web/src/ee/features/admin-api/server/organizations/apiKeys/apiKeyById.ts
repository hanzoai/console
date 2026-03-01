import { type NextApiRequest, type NextApiResponse } from "next";
import type { ParsedUrlQuery } from "querystring";

export function validateQueryParams(query: ParsedUrlQuery): { organizationId: string; apiKeyId: string } | null {
  const { organizationId, apiKeyId } = query;
  if (!organizationId || typeof organizationId !== "string" || !apiKeyId || typeof apiKeyId !== "string") return null;
  return { organizationId, apiKeyId };
}

export async function handleDeleteApiKey(
  req: NextApiRequest,
  res: NextApiResponse,
  _orgId?: string,
  _apiKeyId?: string,
) {
  res.status(501).json({ error: "Not implemented" });
}
