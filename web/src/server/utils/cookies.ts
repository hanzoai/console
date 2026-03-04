import { env } from "@/src/env.mjs";

// Use secure cookies when NEXTAUTH_URL is HTTPS or when running on Vercel
// (which sets NEXTAUTH_URL without the protocol).
// Explicitly do NOT force secure cookies just because NODE_ENV=production —
// the standalone build always runs as production, but e2e tests and some
// self-hosted deployments behind a TLS-terminating proxy use plain HTTP.
const shouldSecureCookies = () => {
  if (env.NEXTAUTH_URL.startsWith("http://")) return false;
  return env.NEXTAUTH_URL.startsWith("https") || process.env.NODE_ENV === "production";
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
