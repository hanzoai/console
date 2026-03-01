import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleCreateProject(req: NextApiRequest, res: NextApiResponse, _scope?: unknown) {
  res.status(501).json({ error: "Not implemented" });
}
