/**
 * Hanzo IAM (OIDC) client — the ONE credential source for the console.
 *
 * Built on `@hanzo/iam`'s browser SDK (the `IAM` class from `@hanzo/iam/browser`):
 * a single redirect + PKCE (RFC 7636) authorize flow where IAM (hanzo.id) owns every
 * credential step. There is NO inline password form, NO ROPC (`/v1/iam/login`), NO
 * confidential-client BFF code->cookie exchange — the browser drives one authorize
 * redirect to `${iamUrl}/v1/iam/oauth/authorize` and completes the token exchange
 * itself via PKCE (no client secret). Social providers, email-code, MFA and wallet
 * all live on IAM's hosted login; the console never reconstructs an IdP URL.
 *
 * The SDK owns the token store (`hanzo_iam_*`) and picks it: `localStorage`, so the
 * session belongs to the BROWSER and not to one tab. This module passes no `storage`
 * — that decision lives in `@hanzo/iam` alone, where every Hanzo surface inherits it.
 *
 * It used to pass `window.sessionStorage`, and that was the whole "a new tab is
 * signed out" defect: a middle-clicked link, a restored window or a `target=_blank`
 * opened a context that could not see the session the user had just established.
 * Note this is not a confidentiality trade — both Web Storage areas are readable by
 * any script on the origin. Credentials that must be unreadable by script belong in
 * an httpOnly cookie; `src/lib/server/session.ts` already defines that (`hz_session`,
 * AEAD-sealed) for the server-side half.
 *
 * This module exposes a browser-only singleton so the API client can read the bearer
 * synchronously and the session provider / callback route can start + complete the
 * flow. The React `<IamProvider>` (mounted at the root) constructs its OWN `IAM` from
 * the SAME `iamConfig()`, so it shares that token store — the two views stay
 * consistent.
 */
import { IAM, type IAMConfig } from '@hanzo/iam/browser'

import { config } from '~/config'

/** Path IAM redirects back to after authorize. */
export const CALLBACK_PATH = '/auth/callback'

/**
 * The IAM SDK configuration for this host's brand. Shared by the browser singleton
 * below AND the React `<IamProvider>` (Provider.tsx) so both drive the same PKCE
 * flow against the same token store. Per-brand issuer + client come from `config`
 * (resolved from the hostname); on an admin host `config` already switches to the
 * reserved `admin-console` app in the `admin` org.
 */
export function iamConfig(): IAMConfig {
  return {
    serverUrl: config.iamUrl,
    clientId: config.iamClientId,
    organization: config.iamOrgName,
    redirectUri: `${typeof window !== 'undefined' ? window.location.origin : ''}${CALLBACK_PATH}`,
    scope: 'openid profile email',
  }
}

let sdk: IAM | null = null

/** The browser IAM singleton (browser-only — the SDK touches `window`/`localStorage`). */
export function iamSdk(): IAM {
  if (typeof window === 'undefined') throw new Error('IAM SDK is browser-only')
  if (!sdk) sdk = new IAM(iamConfig())
  return sdk
}

/** Begin sign-in: redirect the browser to IAM's authorize endpoint (PKCE). */
export function signinRedirect(): Promise<void> {
  return iamSdk().signinRedirect()
}

/** Complete sign-in on the `/auth/callback` route — the PKCE token exchange. */
export async function handleIamCallback(): Promise<void> {
  await iamSdk().handleCallback()
}

/** The current IAM access token (bearer), or null when signed out / on the server. */
export function iamAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return iamSdk().getAccessToken()
  } catch {
    return null
  }
}

/**
 * True when the browser still holds an IAM session to refresh — an access token is
 * stored, even if the SDK considers it expired (`getAccessToken` returns the raw
 * stored token). Cheap + synchronous, no network. Used to BOUND the refresh retry:
 * an anonymous visitor (no stored token) never waits through the backoff, and a
 * retry stops the moment the session is gone from storage (a revoked token the SDK
 * cleared cannot be brought back by retrying).
 */
export function iamHasSession(): boolean {
  return iamAccessToken() != null
}

/** A valid (auto-refreshed if needed) access token, or null. */
export async function iamValidAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const token = await iamSdk().getValidAccessToken()
    if (token) return token
    // The SDK marks a freshly-minted token "expired" when the token-exchange response
    // carried no `expires_in` (an IAM app with no configured token lifetime) and no
    // refresh token was issued — yet IAM still accepts the token (userinfo 200). Fall
    // back to the raw stored token so a valid session is not discarded, which dead-ended
    // AccountApi.session() -> account=null and looped /signin. The proactive-refresh
    // lifetime is derived independently from the token's own `exp` (iamExpiresInSeconds).
    return iamAccessToken()
  } catch {
    return null
  }
}

/** The signed-in user's OIDC claims (userinfo), or null. */
export async function iamUserInfo(): Promise<Record<string, unknown> | null> {
  if (typeof window === 'undefined') return null
  try {
    return await iamSdk().getUserInfo()
  } catch {
    return null
  }
}

/** Seconds until the current access token expires (null when absent/expired). */
export function iamExpiresInSeconds(): number | null {
  const t = iamAccessToken()
  if (!t) return null
  try {
    const claims = JSON.parse(atob(t.split('.')[1])) as { exp?: number }
    if (!claims.exp) return null
    const secs = claims.exp - Math.floor(Date.now() / 1000)
    return secs > 0 ? secs : null
  } catch {
    return null
  }
}

/** Clear all IAM tokens (sign out, client side). */
export function iamSignOut(): void {
  if (typeof window === 'undefined') return
  try {
    iamSdk().clearTokens()
  } catch {
    /* best-effort */
  }
}

/**
 * Where to send the browser to END THE SESSION AT THE ISSUER.
 *
 * `iamSignOut()` above drops this tab's tokens and nothing else, which is only
 * half of signing out and is the half nobody notices. The other half is the
 * `iam_session_id` cookie at hanzo.id: leave it and signing out does not stick,
 * because the very next thing the app does is bounce to `/signin`, and sign-in
 * asks the issuer for a code from the EXISTING session. Measured against prod —
 * clear the tokens the way this module did and silent SSO still answers
 * `status: ok` with a code, so the user lands straight back in the console they
 * just left. Clearing the whole session cookie jar is not an option either: it
 * is set on hanzo.id, and this origin cannot touch it.
 *
 * Only the issuer can end the issuer's session, so sign-out has to be a
 * NAVIGATION there. RP-initiated logout returns the browser to
 * `post_logout_redirect_uri`, which is why this replaces the `/signin` assign
 * rather than racing it: one navigation, and it lands where the old one did.
 *
 * Verified: after this URL, the same silent-SSO probe answers
 * "please sign in first" and mints nothing.
 */
export function iamSignOutUrl(origin: string, returnPath = '/signin'): string {
  // The origin is a PARAMETER, not `window.location.origin` read in here. Every
  // other function in this module guards `typeof window === 'undefined'` because
  // this file is imported by server-rendered code; one that reads `window`
  // unguarded throws the moment anything touches it during SSR. Taking it as an
  // argument removes the hazard instead of guarding it, and makes the URL a pure
  // function of its inputs — testable with no DOM, which is what this repo's
  // suite runs.
  const url = new URL('/v1/iam/oauth/logout', config.iamUrl)
  // Resolve the return against OUR origin, then require it to have stayed there.
  // An absolute URL wins over a base in `new URL`, so a caller passing a foreign
  // one would otherwise hand the IdP an open redirect to hand back. A return leg
  // that left this origin is never what sign-out meant, so it falls back to the
  // sign-in page rather than being honored.
  const back = new URL(returnPath, origin)
  const safe = back.origin === origin ? back : new URL('/signin', origin)
  url.searchParams.set('post_logout_redirect_uri', safe.toString())
  return url.toString()
}

// -- Graceful re-auth: return the user to their task after re-signing in --------
// A mid-task session expiry (a 401) should not dump the user on the home page — we
// stash where they were and the callback lands them back there.

const RETURN_TO_KEY = 'hz_return_to'

/** Remember the current in-app location (path + query) for post-sign-in return. */
export function stashReturnTo(): void {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  // Never round-trip back to the auth pages themselves.
  if (pathname.startsWith('/signin') || pathname.startsWith('/auth')) return
  try {
    window.sessionStorage.setItem(RETURN_TO_KEY, `${pathname}${search}`)
  } catch {
    /* sessionStorage may be unavailable (private mode) — best-effort only */
  }
}

/** Consume the stashed return location (default `/`), clearing it. */
export function takeReturnTo(): string {
  if (typeof window === 'undefined') return '/'
  try {
    const to = window.sessionStorage.getItem(RETURN_TO_KEY)
    window.sessionStorage.removeItem(RETURN_TO_KEY)
    // Only same-origin in-app paths — never an attacker-supplied absolute URL.
    if (to && to.startsWith('/') && !to.startsWith('//')) return to
  } catch {
    /* ignore */
  }
  return '/'
}

/**
 * Start a graceful re-authentication: remember the current task location, then
 * redirect to IAM. After sign-in the callback returns the user here. ONE entry
 * point for "your session expired — sign in again" across the honest-state cards.
 */
export function startReauth(): void {
  if (typeof window === 'undefined') return
  stashReturnTo()
  void signinRedirect()
}
