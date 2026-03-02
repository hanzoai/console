import { type NextApiRequest, type NextApiResponse } from "next";
import { env } from "@/src/env.mjs";

/**
 * Admin API authentication for the Hanzo stack.
 *
 * Validates requests against the ADMIN_API_KEY environment variable.
 * Used by internal admin endpoints (BullMQ management, eval retry, API key ops)
 * and the tRPC admin procedure.
 */
export class AdminApiAuthService {
  /**
   * Verify an API key string against the configured admin key.
   * Returns a discriminated result so callers can branch without exceptions.
   */
  static verifyAuthString(apiKey: string) {
    const adminKey = env.ADMIN_API_KEY;
    if (!adminKey || apiKey !== adminKey) {
      return { isAuthorized: false as const, error: "Unauthorized" };
    }
    return { isAuthorized: true as const };
  }

  /**
   * Express/Next.js middleware-style auth check.
   * Reads Bearer token from Authorization header, validates it,
   * and sends 401 on failure. Returns true if authorized.
   */
  static handleAuth(req: NextApiRequest, res: NextApiResponse): boolean {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    const result = AdminApiAuthService.verifyAuthString(token);
    if (!result.isAuthorized) {
      res.status(401).json({ error: result.error });
      return false;
    }
    return true;
  }
}
