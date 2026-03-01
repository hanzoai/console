import { type NextApiRequest, type NextApiResponse } from "next";
import { env } from "@/src/env.mjs";

export class AdminApiAuthService {
  static verifyAdminAuthFromAuthString(apiKey: string) {
    const adminKey = env.ADMIN_API_KEY;
    if (!adminKey || apiKey !== adminKey) {
      return { isAuthorized: false as const, error: "Unauthorized" };
    }
    return { isAuthorized: true as const };
  }

  static handleAdminAuth(req: NextApiRequest, res: NextApiResponse, _options?: Record<string, unknown>): boolean {
    const authHeader = req.headers.authorization ?? "";
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const result = AdminApiAuthService.verifyAdminAuthFromAuthString(apiKey);
    if (!result.isAuthorized) {
      res.status(401).json({ error: result.error });
      return false;
    }
    return true;
  }
}
