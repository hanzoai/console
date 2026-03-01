import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleUpdateProject(
  req: NextApiRequest,
  res: NextApiResponse,
  _projectId?: string,
  _scope?: unknown,
) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleDeleteProject(
  req: NextApiRequest,
  res: NextApiResponse,
  _projectId?: string,
  _scope?: unknown,
) {
  res.status(501).json({ error: "Not implemented" });
}
