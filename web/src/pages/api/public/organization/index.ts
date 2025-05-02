import { prisma } from "@hanzo/shared/src/db";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizationMemberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const organizations = user.organizationMemberships.map(
      (membership) => membership.organization
    );

    return res.status(200).json({ organizations });
  } catch (error) {
    console.error("Error fetching organizations", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
