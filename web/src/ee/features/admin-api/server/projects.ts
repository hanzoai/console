import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleGetProjects(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}
