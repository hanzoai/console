import { env } from "@/src/env.mjs";

// Use secure cookies on https hostnames, exception for Vercel which sets NEXTAUTH_URL without the protocol
const shouldSecureCookies = () => {
  return process.env.NODE_ENV === "production" || env.NEXTAUTH_URL.startsWith("https");
};

export const getCookieOptions = () => {
  const isNgrok = env.NEXTAUTH_URL.includes("ngrok");
  return {
    domain: isNgrok ? undefined : env.NEXTAUTH_COOKIE_DOMAIN ?? undefined,
    httpOnly: true,
    sameSite: isNgrok ? "none" : (process.env.NODE_ENV === "development" ? "lax" : "strict") as "lax" | "strict" | "none",
    path: "/",
    secure: isNgrok ? true : shouldSecureCookies(),
    maxAge: 30 * 24 * 60 * 60, // 30 days
  };
};

export const getCookieName = (name: string) =>
  [
    shouldSecureCookies() ? "__Secure-" : "",
    env.NEXT_PUBLIC_COOKIE_PREFIX ?? "",
    name,
    env.NEXT_PUBLIC_HANZO_CLOUD_REGION
      ? `.${env.NEXT_PUBLIC_HANZO_CLOUD_REGION}`
      : "",
  ].join("");
