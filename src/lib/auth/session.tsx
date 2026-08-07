'use client'

/**
 * Session context — the one source of auth truth for the console.
 *
 * Authentication is @hanzo/iam ONLY: a single redirect + PKCE flow (IAM owns every
 * credential step). On mount it resolves the account from the IAM identity via
 * `AccountApi.session()` (the SDK's userinfo + access token); `signIn()` redirects to
 * IAM's authorize endpoint; the `/auth/callback` route completes the PKCE token
 * exchange and this provider re-resolves the account.
 *
 * SILENT REFRESH. When a session exists we arm a PROACTIVE timer at ~80% of the
 * access-token lifetime that calls `refreshSession()` (the SDK's rotating refresh
 * grant) and reloads — so a short-lived access token is renewed before it expires and
 * the user is never bounced. The REACTIVE half (a 401 -> refresh -> retry) lives in the
 * API client. Both go through the ONE single-flight `refreshSession`.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { AccountApi, type Account } from '~/lib/api'
import { withTimeout } from '~/lib/with-timeout'
import { signinRedirect, stashReturnTo, iamSignOut, iamSignOutUrl } from './iam'
import { refreshSession } from './refresh'
import { setCurrentActor } from '~/lib/actor-scope'
import { claimReferralOnce, stashReferralCode } from '~/lib/referrals/claim'
import { attributeAffiliateOnce, stashAffiliateCode } from '~/lib/affiliates/claim'

type SessionState = {
  account: Account | null
  loading: boolean
  /** Begin sign-in: redirect to IAM (PKCE). ONE login path. */
  signIn: () => void
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

/** Only proactively refresh when the access token is short enough to expire in a
 *  session — a long (multi-day) token relies on the reactive 401 + self-heal-on-load
 *  path instead (and a multi-day setTimeout is unreliable). Floor keeps a tiny TTL
 *  from busy-looping. */
const MIN_PROACTIVE_MS = 30_000
const MAX_PROACTIVE_MS = 2 * 60 * 60 * 1000 // 2h

/** Cap the boot session resolve so a slow/hung backend can't hold the splash
 *  forever — on timeout the visitor is anonymous and the sign-in card renders. */
const SESSION_BOOT_TIMEOUT_MS = 8_000

export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reloadRef = useRef<() => void>(() => {})

  // Set the account AND keep the synchronous actor id (read by the API client's
  // baseHeaders) in lockstep — one source of auth truth for org (org-scope) + user.
  const applyAccount = useCallback((a: Account | null) => {
    setAccount(a)
    setCurrentActor(a && a.owner && a.name ? `${a.owner}/${a.name}` : '')
    if (a && a.owner && a.name) {
      // Claim a stashed referral (?ref= captured at signup) -> binds this org as the
      // referee. Once per session per org, server-idempotent, best-effort.
      claimReferralOnce(a.owner)
      // Attribute a stashed affiliate (?aff= captured at signup) -> binds this org to
      // the affiliate. Orthogonal to the referral above (an org can be both); once per
      // session per org, server-idempotent, best-effort.
      attributeAffiliateOnce(a.owner)
    }
  }, [])

  /** (Re)arm the proactive refresh timer for the given remaining lifetime. */
  const armRefresh = useCallback((expiresIn: number | null) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (typeof window === 'undefined' || !expiresIn || expiresIn <= 0) return
    const delayMs = expiresIn * 0.8 * 1000
    if (delayMs > MAX_PROACTIVE_MS) return // long token -> reactive/self-heal handles it
    timerRef.current = setTimeout(() => {
      // Refresh (single-flight), then reload to pick up the new lifetime and re-arm.
      void refreshSession().finally(() => reloadRef.current())
    }, Math.max(MIN_PROACTIVE_MS, delayMs))
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      // The boot "who am I" (AccountApi.session -> IAM userinfo) must never pin the
      // splash: cap it — on timeout treat the visitor as anonymous so the sign-in card
      // renders. A later reload/refresh resolves the real session.
      const { account: acct, expiresIn } = await withTimeout(
        AccountApi.session(),
        SESSION_BOOT_TIMEOUT_MS,
        { account: null, expiresIn: null },
      )
      applyAccount(acct)
      armRefresh(acct ? expiresIn : null)
    } finally {
      setLoading(false)
    }
  }, [armRefresh, applyAccount])

  // Keep the ref pointing at the latest reload so the timer callback never goes stale.
  useEffect(() => {
    reloadRef.current = reload
  }, [reload])

  useEffect(() => {
    // Capture a ?ref=<code> from the landing URL BEFORE auth resolves, so a referral
    // link survives the OAuth round-trip and is claimed on first authenticated load.
    stashReferralCode()
    // Same for an ?aff=<code> affiliate link (orthogonal capture).
    stashAffiliateCode()
    void reload()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [reload])

  const signIn = useCallback(() => {
    // Remember the current task so re-auth returns here (graceful mid-task expiry).
    stashReturnTo()
    void signinRedirect()
  }, [])

  const signOut = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await AccountApi.signout()
    iamSignOut()
    applyAccount(null)
    // Redirect DETERMINISTICALLY, and through the ISSUER. A hard navigation is
    // still the single source of truth for "signed out -> /signin" — it clears
    // all in-memory state (org scope, caches, balances) exactly as the sign-IN
    // path does — but it has to go via RP-initiated logout, which returns here
    // through post_logout_redirect_uri.
    //
    // Assigning '/signin' directly is what made sign-out not stick: the two
    // calls above end the session HERE, and the `iam_session_id` cookie at the
    // issuer survives, so /signin's silent SSO immediately mints a code from it
    // and puts the user back in the console they just left. Measured: same
    // probe, `status: ok` with a code before this change, "please sign in
    // first" after.
    if (typeof window !== 'undefined') {
      window.location.assign(iamSignOutUrl(window.location.origin, '/signin'))
    }
  }, [applyAccount])

  return (
    <SessionContext.Provider value={{ account, loading, signIn, signOut, reload }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>')
  return ctx
}
