import type {
  OAuthConfig,
  OAuthUserConfig,
} from "next-auth/providers/oauth";

interface IamProfile extends Record<string, unknown> {
  sub: string;
  name: string;
  email: string;
  preferred_username?: string;
  picture?: string;
  avatar?: string;
  displayName?: string;
  email_verified?: boolean;
}

/**
 * Hanzo IAM provider (OIDC-based) with OIDC discovery.
 *
 * Uses standard OIDC well-known endpoint for automatic configuration.
 * JWT id_token validation (issuer, audience, signature) is handled by
 * openid-client using the JWKS published at {serverUrl}/.well-known/jwks.
 */
export function IamProvider<P extends IamProfile>(
  options: OAuthUserConfig<P> & {
    serverUrl: string;
    orgName?: string;
    appName?: string;
  },
): OAuthConfig<P> {
  const issuer = options.serverUrl.replace(/\/$/, "");

  return {
    id: "hanzo-iam",
    name: "Hanzo IAM",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    idToken: true,
    checks: ["state"],
    authorization: { params: { scope: "openid profile email" } },
    profile(profile) {
      return {
        id: profile.sub,
        name:
          profile.displayName ||
          profile.name ||
          profile.preferred_username ||
          profile.email ||
          "",
        email: profile.email,
        image: profile.avatar || profile.picture || null,
      };
    },
    style: {
      bg: "#050508",
      text: "#fff",
      logo: "",
    },
    options,
  };
}
