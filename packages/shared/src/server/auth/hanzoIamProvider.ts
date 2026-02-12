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
 * Custom token exchange bypasses openid-client JWT validation — Casdoor
 * returns JWT-format tokens with iss claims that openid-client rejects
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
  const tokenUrl = `${serverUrl}/api/login/oauth/access_token`;

  return {
    id: "hanzo-iam",
    name: "Hanzo IAM",
    type: "oauth",
    authorization: {
      url: `${serverUrl}/login/oauth/authorize`,
      params: { scope: "openid profile email" },
    },
    // Custom token exchange — bypasses openid-client's JWT iss validation
    // by making a direct HTTP request instead of using the OIDC client.
    // Casdoor returns JWT access_tokens with iss claims that openid-client
    // rejects when no issuer is configured.
    token: {
      url: tokenUrl,
      // Context: { params, checks, client, provider }
      // Using any to avoid complex openid-client type dependencies
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async request(context: any) {
        const { params, provider } = context;
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code: String(params.code ?? ""),
          redirect_uri: provider.callbackUrl,
          client_id: provider.clientId ?? "",
          client_secret: provider.clientSecret ?? "",
        });

        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        const data = (await res.json()) as Record<string, unknown>;
        if (data.error) {
          throw new Error(
            `Token exchange failed: ${String(data.error_description || data.error)}`,
          );
        }

        // Cast to satisfy NextAuth's TokenSet type — Casdoor returns
        // standard OAuth fields (access_token, id_token, refresh_token, etc.)
        return {
          tokens: data as unknown as Record<string, unknown> & {
            access_token: string;
            token_type: string;
          },
        };
      },
    },
    userinfo: {
      url: `${serverUrl}/api/userinfo`,
    },
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
