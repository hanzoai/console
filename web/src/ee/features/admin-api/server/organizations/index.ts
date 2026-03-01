import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleGetOrganizations(req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleCreateOrganization(req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: "Not implemented" });
}
