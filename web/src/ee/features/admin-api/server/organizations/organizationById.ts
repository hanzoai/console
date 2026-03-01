import { type NextApiRequest, type NextApiResponse } from "next";

export async function handleGetOrganizationById(req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleUpdateOrganization(req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: "Not implemented" });
}

export async function handleDeleteOrganization(req: NextApiRequest, res: NextApiResponse) {
  res.status(501).json({ error: "Not implemented" });
}
