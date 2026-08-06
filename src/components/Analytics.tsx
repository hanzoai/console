'use client'

/**
 * The console's telemetry surface — the ONE Hanzo telemetry provider, plus the one
 * thing it deliberately leaves to the app.
 *
 * `TelemetrySurface` mounts `@hanzogui/telemetry`, which owns the whole plane for
 * this subtree: pageviews (including SPA route changes), `window.onerror` +
 * `unhandledrejection`, React render errors (its internal boundary REPORTS and
 * re-throws, so the app's own error UI still decides what the user sees), lazily
 * imported interaction capture, and DNT/GPC consent. It replaces the hand-rolled
 * `<AnalyticsProvider>` + bridge + boundary combo; it mounts @hanzo/event's
 * `AnalyticsProvider` internally with its own client, so every existing
 * `useAnalytics()` call site keeps working against that ONE client and one stream.
 * `product="console"` names the surface — @hanzo/event's DSN registry resolves the
 * hanzo-console Sentry project from it, so the error plane needs no `dsn` prop and
 * no env var — and `ingestKey` names the TENANT. Those two are the configuration.
 *
 * It reads `usePathname()` ITSELF rather than taking a `path` prop from `Provider`:
 * `Provider` memoizes its tree on `children`, so a path read up there would be
 * baked into the cached element and go stale on the first client navigation.
 *
 * `AnalyticsBridge` is the one thing TelemetryProvider does NOT do — `identify`.
 * It binds the person to the STABLE `owner/name` actor id (the same id the API
 * client uses via `setCurrentActor`), never the email, once the session resolves.
 * We send the user id only — the org comes from the key, never from the person, so
 * WHO is signed in can no longer decide WHERE the row lands — and anonymous
 * placeholder sessions are skipped. It renders nothing and emits NO pageview — the
 * provider owns those, and a second emitter would double-count every route.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { TelemetryProvider, useTelemetry } from '@hanzogui/telemetry'

import { config } from '~/config'
import { useSession } from '~/lib/auth/session'
import { type Account } from '~/lib/api/types'

/** The user attributes worth carrying alongside the id, from the IAM claims the
 *  session already decoded. A key is OMITTED rather than sent undefined, so an
 *  absent claim never overwrites a trait a prior identify established. */
export function identityTraits(account: Account): Record<string, unknown> {
  const traits: Record<string, unknown> = {}
  if (account.email) traits.email = account.email
  const name = account.displayName ?? account.name
  if (name) traits.name = name
  return traits
}

export function TelemetrySurface({ children }: { children: ReactNode }) {
  const path = usePathname()
  // THE TENANT IS THIS CONSOLE, NOT ITS VISITOR — so we send the brand's own
  // publishable key and NO bearer.
  //
  // Cloud picks the tenant from whatever credential arrives, and a validated IAM
  // bearer WINS: `eventTenant` returns on the bearer before a key is even read
  // (apps/analytics/event.go). So passing the visitor's token filed Hanzo's own
  // product telemetry into whatever org that visitor was acting in — `X-Org-Id`,
  // the SELECTED org, straight onto `event.fact.org`. First-run onboarding creates
  // an org and re-authenticates into it, so every new customer collected a slice of
  // our console analytics: 18 rows under `proofwalk-aug05` from one signup walk.
  // Passing BOTH would not have fixed it — the bearer would still win — which is
  // why `getToken` is gone rather than merely joined by a key.
  //
  // Nothing is lost by dropping it. The bearer was only ever a credential: the
  // person is bound by `AnalyticsBridge` below via `identify`, and `distinctId`
  // comes from that, not from the token.
  //
  // `enabled` is left UNDEFINED when a key exists, because it is a hard override
  // that would win over DNT/GPC; consent must still decide. With no key it is a
  // flat false — no key, no tenant, no emission.
  // `host=""` is SAME-ORIGIN, matching lib/event.ts so the console's two clients
  // agree on one door. It is also load-bearing for tenancy: @hanzo/event >= 0.3.18
  // falls back to a BAKED hanzo key when `host` is undefined or api.hanzo.ai
  // (dsn.ts), which on a lux/zoo/pars console would file that brand into Hanzo's
  // org — the same misfiling, arriving by default instead of by bearer. An explicit
  // same-origin host is outside that fallback, so a brand without a key of its own
  // stays silent rather than borrowing Hanzo's.
  const ingestKey = config.ingestKey || undefined
  return (
    <TelemetryProvider
      product="console"
      path={path}
      host=""
      ingestKey={ingestKey}
      enabled={ingestKey ? undefined : false}
    >
      {children}
    </TelemetryProvider>
  )
}

export function AnalyticsBridge() {
  const telemetry = useTelemetry()
  const { account } = useSession()

  const identified = useRef('')
  useEffect(() => {
    if (!account?.owner || !account?.name || account.type === 'anonymous-user') return
    const personId = `${account.owner}/${account.name}`
    if (identified.current === personId) return
    identified.current = personId
    telemetry.identify(personId)
  }, [account, telemetry])

  return null
}
