import { type NextApiRequest, type NextApiResponse } from "next";
import type { ParsedUrlQuery } from "querystring";

export function validateQueryParams(query: ParsedUrlQuery): { projectId: string; apiKeyId: string } | null {
  const { projectId, apiKeyId } = query;
  if (!projectId || typeof projectId !== "string" || !apiKeyId || typeof apiKeyId !== "string") return null;
  return { projectId, apiKeyId };
}

export async function handleDeleteApiKey(
  req: NextApiRequest,
  res: NextApiResponse,
  _projectId?: string,
  _apiKeyId?: string,
  _orgId?: string,
) {
  res.status(501).json({ error: "Not implemented" });
}
