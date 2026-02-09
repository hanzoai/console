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
 * Uses GitHub-style OAuth endpoints proxied through hanzo.id
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
    },
    options,
  };
}
