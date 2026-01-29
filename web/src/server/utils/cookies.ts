import { env } from "@/src/env.mjs";

// Use secure cookies on https hostnames, exception for Vercel which sets NEXTAUTH_URL without the protocol
const shouldSecureCookies = () => {
  return process.env.NODE_ENV === "production" || env.NEXTAUTH_URL.startsWith("https");
};

export const getCookieOptions = () => ({
  domain: env.NEXTAUTH_COOKIE_DOMAIN ?? undefined,
  httpOnly: true,
  sameSite: "lax" as const,
  path: env.NEXT_PUBLIC_BASE_PATH || "/",
  secure: shouldSecureCookies(),
});

export const getCookieName = (name: string) =>
  [
    shouldSecureCookies() ? "__Secure-" : "",
    env.NEXT_PUBLIC_COOKIE_PREFIX ?? "",
    name,
    env.NEXT_PUBLIC_HANZO_CLOUD_REGION ? `.${env.NEXT_PUBLIC_HANZO_CLOUD_REGION}` : "",
  ].join("");
