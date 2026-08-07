/**
 * Silent session refresh — the ONE client entry point, single-flight.
 *
 * Both the proactive timer (SessionProvider) and the reactive 401 handler (the API
 * client) call `refreshSession()`. It delegates to the `@hanzo/iam` SDK's refresh
 * grant (RFC 6749 `refresh_token`) — IAM owns the credential, the console holds only
 * the SDK's token store. There is NO `/auth/refresh` BFF POST any more.
 *
 * SINGLE-FLIGHT is load-bearing, not an optimization: IAM refresh tokens are
 * one-time-use rotating, so two concurrent refreshes would race — the first rotates
 * the token, the second replays the now-invalid one and 400s, needlessly killing a
 * healthy session. Sharing ONE in-flight promise means every concurrent caller (the
 * timer + N parallel 401s) awaits the SAME single rotation.
 *
 * RESILIENT, not jumpy. One attempt used to be the whole story: a single transient
 * failure (a network blip, a 5xx from IAM, a lost rotation race) yielded a bare
 * `false`, and the caller took that one "no" as a definitive sign-out — the "session
 * expired, sign in again" card fired mid-task on a hiccup. A transient failure and a
 * genuinely-dead refresh token are indistinguishable at this layer (the SDK collapses
 * both to a null token), so we RETRY a bounded few times with short backoff WHILE a
 * session still exists: a blip self-heals (session preserved, no false eviction), and a
 * truly-expired session resolves `false` ~1s later — an acceptable delay before the
 * honest re-auth card. An anonymous visitor (no stored token) never waits through the
 * backoff (`hasSession` short-circuits on the first miss).
 */
import { iamValidAccessToken, iamHasSession } from './iam'

/** Backoff before each retry AFTER the first attempt — transient recovery only. Worst
 *  case added before an honest `false` when a stored token is dead: ~1.6s. */
export const REFRESH_RETRY_MS = [400, 1200]

/** Injected dependencies for `resilientRefresh` — real ones in `refreshSession`, fakes
 *  in tests. Mirrors the `ResilientDeps` idiom the API client uses for `resilientFetch`. */
export interface RefreshDeps {
  /** One refresh attempt: a live access token, or null (a TRANSIENT failure OR a
   *  genuinely signed-out state — this layer cannot tell them apart). Never throws. */
  attempt: () => Promise<string | null>
  /** True while the browser still holds a session to refresh (else retrying is futile). */
  hasSession: () => boolean
  sleep: (ms: number) => Promise<void>
}

/**
 * Pure refresh orchestration (over its injected deps): try once, then retry a bounded
 * few times with backoff — but ONLY while a session still exists. So a network blip /
 * lost rotation race self-heals (returns true on recovery), while a genuinely signed-out
 * state resolves false without wasted retries. Bounded by `REFRESH_RETRY_MS`.
 */
export async function resilientRefresh(deps: RefreshDeps): Promise<boolean> {
  for (let i = 0; ; i++) {
    if (await deps.attempt()) return true
    // First attempt failed. Stop if we've exhausted the budget OR the session is gone
    // from storage (an anonymous visitor, or a revoked token the SDK cleared — retrying
    // cannot bring it back). Otherwise wait and retry: the failure may be transient.
    if (i >= REFRESH_RETRY_MS.length || !deps.hasSession()) return false
    await deps.sleep(REFRESH_RETRY_MS[i])
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let inflight: Promise<boolean> | null = null

/**
 * Refresh the IAM access token if a valid refresh token exists. Resolves true when a
 * live token is available afterwards, false otherwise (signed out, or the refresh
 * token is expired/revoked → the caller falls through to graceful re-auth). Never throws.
 */
export function refreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (inflight) return inflight
  inflight = resilientRefresh({
    // getValidAccessToken() returns the current token, or transparently runs the refresh
    // grant when it is expired — the SDK's own single rotation. iamValidAccessToken wraps
    // it browser-safe and never throws (a failure is a null token).
    attempt: iamValidAccessToken,
    hasSession: iamHasSession,
    sleep,
  })
  // Cleared AFTER this round settles, so a caller arriving mid-flight joins THIS
  // rotation and one arriving after it starts a fresh one.
  void inflight.finally(() => {
    inflight = null
  })
  return inflight
}
