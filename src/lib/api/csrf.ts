/**
 * Anti-CSRF token for the console money-WRITE surface — fetched once and echoed as
 * `X-CSRF-Token` on every state-changing request that authenticates via the AMBIENT
 * session cookie.
 *
 * WHY only the embed build. The forward-perfect money path is the cloud binary's
 * same-origin session bridge: the go:embed console writes with its first-party
 * httpOnly cookie (ambient — a cross-site page's request to our origin carries it
 * too), so the cloud binary guards those writes with `requireCSRF`
 * (clients/account/csrf.go): POST/DELETE `/v1/iam/{keys,onboard} + /v1/commerce/topup/wallet`,
 * POST `/v1/billing/*`, and POST|PUT|PATCH|DELETE `/v1/commerce/*`. A NON-embed host
 * (console2/admin/brand) writes through the Next user-bearer BFF, which carries an
 * `Authorization` header ⇒ CSRF-immune (`ambientCookieAuth` is false there), so we
 * mint/echo the token ONLY when `IS_EMBED`. Bearer/API callers are always exempt.
 *
 * The token is minted at `GET /v1/csrf` (its response body is unreadable to a
 * cross-site page by the Same-Origin Policy), bound to the caller's validated
 * (uid, org), and lives `expiresIn` seconds (12h). We cache it until ~1 min before
 * expiry, share one in-flight fetch across concurrent writes, and re-mint on a 403
 * (blue's contract: "the SPA re-fetches on a 403").
 */
import { IS_EMBED } from '~/lib/embed'

export const CSRF_HEADER = 'X-CSRF-Token'
import { config } from '~/config'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEFAULT_TTL_S = 43_200 // 12h — matches the server csrfTTL; only a fallback if expiresIn is absent
const REFRESH_SKEW_MS = 60_000 // re-mint a minute before the server would reject it

// Same builder as client.ts `originV1Url` (a pure one-liner) — inlined here to keep
// this module free of an import cycle with client.ts (which imports `applyCsrfToInit`).
// It reads `config` directly, which is cycle-free: src/config/index.ts imports nothing.
//
// The host MUST match the host the write goes to. A CSRF token is minted and verified
// against server state, so minting at the page origin while POSTing to api.hanzo.ai
// would only work for as long as those two happen to be the same binary — which today
// they are, and which is exactly the coincidence this change stops relying on.
const csrfEndpoint = (): string => `${config.cloudUrl}/v1/csrf`

let cached: { token: string; expiresAt: number } | null = null
let inflight: Promise<string | null> | null = null

/**
 * The write surfaces cloud's `requireCSRF` actually gates (clients/account/console.go):
 * POST/DELETE /v1/iam/{keys,onboard} + /v1/commerce/topup/wallet, POST /v1/billing/*, and
 * POST/PUT/PATCH/DELETE /v1/commerce/*. Every OTHER mutating request (login, session,
 * agents/tracker/… control-plane) is NOT csrf-gated server-side, so it must NOT trigger
 * a `GET /v1/csrf` — that fetch fires the SPA's ONE console error: a mutating
 * bootstrap request (e.g. the pre-login session POST) minting a token before any session
 * cookie exists → 403. Scoping to these prefixes both matches the server and kills that
 * spurious pre-auth mint. When a url isn't supplied (legacy call), fall back to method-only.
 */
const CSRF_WRITE_PREFIXES = ['/v1/iam/keys', '/v1/iam/onboard', '/v1/billing/', '/v1/commerce/']

/** True when a request must carry a CSRF token: the embed ambient-cookie money-write path + a mutating verb. */
export const csrfRequired = (method?: string, url?: string): boolean =>
  IS_EMBED &&
  !!method &&
  MUTATING.has(method.toUpperCase()) &&
  (url === undefined || CSRF_WRITE_PREFIXES.some((p) => url.includes(p)))

/** Forget the cached token so the next write re-mints it (call on a 403 CSRF refusal). */
export const clearCsrfToken = (): void => {
  cached = null
}

/**
 * The current CSRF token, minted on demand from the same-origin `GET /v1/csrf`.
 * Cached until just before expiry; concurrent callers share one in-flight fetch.
 * Returns `null` when unobtainable (non-embed, unauthenticated, or the endpoint is
 * unreachable) — the caller then proceeds without the header and the server
 * fail-secures (a missing token on an ambient write is refused).
 */
export async function csrfToken(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!IS_EMBED) return null
  if (cached && Date.now() < cached.expiresAt) return cached.token
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetchImpl(csrfEndpoint(), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return null
      const body = (await res.json().catch(() => null)) as
        | { csrfToken?: string; expiresIn?: number }
        | null
      const token = body?.csrfToken
      if (typeof token !== 'string' || !token) return null
      const ttlS = typeof body?.expiresIn === 'number' && body.expiresIn > 0 ? body.expiresIn : DEFAULT_TTL_S
      cached = { token, expiresAt: Date.now() + Math.max(0, ttlS * 1000 - REFRESH_SKEW_MS) }
      return token
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Stamp `X-CSRF-Token` onto a mutating embed request's `init.headers` in place,
 * minting the token if needed. A no-op for reads, non-embed hosts, or when no token
 * is obtainable. Handles the three `HeadersInit` shapes so it composes with whatever
 * the caller built (`baseHeaders` returns a plain record; a caller may pass `Headers`).
 */
export async function applyCsrfToInit(init: RequestInit, url?: string): Promise<void> {
  if (!csrfRequired(init.method, url)) return
  const token = await csrfToken()
  if (!token) return
  const h = init.headers
  if (h instanceof Headers) h.set(CSRF_HEADER, token)
  else if (Array.isArray(h)) h.push([CSRF_HEADER, token])
  else init.headers = { ...(h as Record<string, string> | undefined), [CSRF_HEADER]: token }
}
