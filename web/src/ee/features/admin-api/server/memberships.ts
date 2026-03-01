import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleGetMemberships(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleUpdateMembership(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleDeleteMembership(req: NextApiRequest, res: NextApiResponse, _orgId?: string) {
  res.status(501).json({ error: "Not implemented" });
}
