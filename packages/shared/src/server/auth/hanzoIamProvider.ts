import type {
  OAuthConfig,
  OAuthUserConfig,
} from "next-auth/providers/oauth";

interface HanzoIamProfile extends Record<string, unknown> {
  sub: string;
  name: string;
  email: string;
  preferred_username?: string;
  picture?: string;
  avatar?: string;
}

/**
 * Hanzo IAM OAuth provider (Casdoor-based)
 * Uses Casdoor SDK-style OAuth endpoints proxied through hanzo.id
 *
 * Note: Do NOT set `issuer` — it triggers OIDC discovery which overrides
 * the explicit endpoint URLs and causes iss-validation failures because
 * Casdoor returns JWT tokens with iss claims that openid-client rejects
 * when configured as a plain OAuth (non-OIDC) provider.
 */
export function HanzoIamProvider<P extends HanzoIamProfile>(
  options: OAuthUserConfig<P> & {
    serverUrl: string;
    orgName?: string;
    appName?: string;
  },
): OAuthConfig<P> {
  const serverUrl = options.serverUrl.replace(/\/$/, "");

  return {
    id: "hanzo-iam",
    name: "Hanzo IAM",
    type: "oauth",
    // No issuer — prevents OIDC discovery from overriding explicit endpoints
    // and avoids "unexpected iss value" errors from Casdoor JWT tokens
    authorization: {
      url: `${serverUrl}/login/oauth/authorize`,
      params: { scope: "openid profile email" },
    },
    token: {
      url: `${serverUrl}/api/login/oauth/access_token`,
    },
    userinfo: {
      url: `${serverUrl}/api/userinfo`,
    },
    // Casdoor returns JWT tokens with iss claim; skip id_token validation
    // since we use the userinfo endpoint for profile data
    idToken: false,
    checks: ["state"],
    profile(profile) {
      return {
        id: profile.sub,
        name:
          profile.name || profile.preferred_username || profile.email || "",
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
