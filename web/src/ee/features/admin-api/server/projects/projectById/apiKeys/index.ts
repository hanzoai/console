import { type NextApiRequest, type NextApiResponse } from "next";
import type { ParsedUrlQuery } from "querystring";

export function validateQueryAndExtractId(query: ParsedUrlQuery): string | null {
  const { projectId } = query;
  if (!projectId || typeof projectId !== "string") return null;
  return projectId;
}

export async function handleGetApiKeys(req: NextApiRequest, res: NextApiResponse, _projectId?: string) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleCreateApiKey(
  req: NextApiRequest,
  res: NextApiResponse,
  _projectId?: string,
  _orgId?: string,
) {
  res.status(501).json({ error: "Not implemented" });
}
