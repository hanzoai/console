/**
 * The ONE telemetry client for the console — @hanzo/event, natively enabled.
 *
 * Analytics and product events (pageview · product event · identify) ride ONE
 * batched stream to the ONE Hanzo Cloud front door, POST /v1/event, which lenses
 * them server-side into web analytics and product insights. There is a SINGLE
 * instance, referenced as a value everywhere it's needed — the
 * `AnalyticsProvider` (pageviews + product `capture`) and the app's error
 * boundaries (`reportError`), so even the provider-less `global-error` boundary
 * reports through the same client. One client, no second path.
 *
 * ERRORS ARE A SECOND PLANE, and they do NOT ride the event stream. There is no
 * server-side fan-out from /v1/event into error tracking — a claim this file used
 * to make, which is precisely why the console reported ZERO errors. `captureError`
 * sends a Sentry envelope directly, authenticated by its own `dsn`. NO DSN => THE
 * ERROR PLANE IS INERT (fail-safe, by design). Requires @hanzo/event >= 0.3.2;
 * versions <= 0.3.1 had no envelope code at all.
 *
 * Wiring for the console SPA:
 *  - `host: ''` — SAME-ORIGIN. Events POST to the console's own `/v1/event`. The
 *    client NEVER sends an org/tenant — Cloud stamps it from the validated bearer.
 *  - `getToken` — the signed-in visitor's own Hanzo IAM access token, falling back
 *    to the publishable key when there is none. The token attributes the stream to
 *    the visitor's own org on every brand host; the key exists so a SIGNED-OUT view
 *    is admitted at all. Token first, key second — see the note below.
 *  - `dsn` (`NEXT_PUBLIC_HANZO_EVENT_DSN`) — the error plane's own credential,
 *    shaped `https://<key>@api.hanzo.ai/v1/sentry/<project>`. Publishable by design
 *    (it ships in the client bundle). Unset → errors are captured and dropped.
 *  - auto error capture is ON by default (window.onerror + unhandledrejection),
 *    making this the app-wide error path (subsumes @sentry). React render errors —
 *    which React swallows before window.onerror — are reported from the boundaries
 *    via `reportError`.
 *
 * Consent + PII: the stream is PII-free by construction — a random anon id + the
 * IAM user id (never an email), org never sent. On top of that we honor an
 * explicit browser opt-out (Global Privacy Control / Do-Not-Track): a
 * visitor who signals it is not tracked at all. This is the consent layer for the
 * logged-out marketing/public views.
 */
import { createAnalytics, type Analytics } from '@hanzo/event'
import { setTelemetry } from '@hanzo/ui/telemetry'

import { iamAccessToken } from '~/lib/auth/iam'

/** Honor an explicit browser opt-out signal (GPC, then legacy DNT). SSR (no
 *  navigator) defaults to enabled; the browser instance reads the real signal. */
function consented(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null }
  if (nav.globalPrivacyControl === true) return false
  const dnt = nav.doNotTrack
  return dnt !== '1' && dnt !== 'yes'
}

// ── The token FIRST, the publishable key only when there is no token ─────────
//
// The signed-in path is unchanged and remains the point: cloud resolves the
// tenant from the IAM bearer's OWN owner claim, so each visitor's events land in
// THEIR org on every brand host — cloud.hanzo.ai, cloud.lux.cloud,
// cloud.zoo.cloud — with no per-brand configuration. The JWT carries the org;
// everything downstream is org-scoped by it.
//
// What changed is the SIGNED-OUT path, which reported nothing at all. A
// credential-less POST is refused outright — `401 ingest_key_required`, measured
// against the live door with and without a browser Origin, for pageviews and
// exceptions alike. (An earlier version of this comment described an "anonymous
// lane" that admitted pageview + error under a `$public` tenant and answered 200.
// That lane is not implemented in the deployed cloud; the same claim was wrong in
// four other repos and is why keyless surfaces were believed to be half-working.)
//
// So the publishable key is a FALLBACK, never an override. That distinction is
// load-bearing: @hanzo/event resolves the outgoing credential as
// `ingestKey ?? token`, so passing `ingestKey` would REPLACE each signed-in
// user's bearer and file their events under the key's org instead of their own —
// on a multi-brand image, that is a cross-tenant defect. Supplying the key
// through `getToken` inverts that precedence into `token ?? key`, which is the
// order this product actually wants.
//
// THE COOKIE IS NOT A CREDENTIAL HERE. This file once claimed that posting
// same-origin let the first-party session ride along. It does not: that cookie is
// the casibase session, while cloud resolves a tenant from a VALIDATED IAM bearer
// (SanitizeIdentity), so a cookie-only POST carries no principal.

/**
 * Publishable ingest key — the SIGNED-OUT credential only. Org-scoped and
 * write-only by construction, so it is safe in the bundle. Unset → signed-out
 * views go back to reporting nothing, which is the previous behaviour and not a
 * crash.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_PUBLISHABLE_KEY?.trim() || undefined

/** Error-plane credential. Unset → captureError is inert (fail-safe). */
const dsn = process.env.NEXT_PUBLIC_HANZO_EVENT_DSN?.trim() || undefined

/**
 * The ONE console analytics client. Built once at module scope (SSR-safe: the
 * client's browser-only side effects are guarded and deferred to `init()`, which
 * the provider fires in an effect). Shared by the provider and the error boundaries.
 */
export const eventClient: Analytics = createAnalytics({
  product: 'console',
  host: '',
  // Read through a function, not captured once: this module is a singleton built at
  // import time, when the visitor is not signed in yet and the token does not exist.
  // The client calls this at flush time, so a sign-in — and every silent refresh
  // after it — is picked up with no rebuild. Returns undefined on the server and
  // when signed out, which is the anonymous path.
  getToken: () => iamAccessToken() ?? PUBLISHABLE_KEY,
  dsn,
  enabled: consented(),
})

// ── The shared components emit through THIS client, not a second one ─────────
//
// @hanzo/ui instruments itself: DataTable, PrimaryButton, SlideOver, ConfirmDelete,
// the Field* editors, ComboBox, Segmented/SearchInput, MenuItemView, OrgSwitcher,
// ThemeToggle, Toast and EmptyState all report what a user did. They emit through
// module-scope `track()`, which resolves an AMBIENT client — and left alone that
// client would be a SECOND one: default host api.hanzo.ai, no cookie, no session.
// Cloud's anonymous lane admits only pageview + error, so every one of those
// component events would have been DROPPED on arrival.
//
// Registering `eventClient` as the ambient client is the whole fix, and it is what
// keeps the promise this file's header makes: ONE client, one batch, one anon id,
// one stream, same-origin with the session cookie — so component events arrive
// CREDENTIALED and are attributed to the signed-in org. `AnalyticsProvider` in
// Provider.tsx already hands this same instance to `useAnalytics()`.
//
// The wrapper is the `Telemetry` shape @hanzogui/telemetry hands out; every method
// delegates, so there is nothing here to keep in sync but the delegation itself.
setTelemetry({
  enabled: true,
  product: 'console',
  client: eventClient,
  track: (event, properties, commerce) => eventClient.capture(event, properties, commerce),
  pageview: (path, properties) => eventClient.pageview(path, properties),
  identify: (personId, traits) => eventClient.identify(personId, traits),
  group: (groupId, traits) => eventClient.group(groupId, traits),
  captureError: (err, context) => eventClient.captureError(err, context),
  captureException: (err, context) => eventClient.captureError(err, context),
  setCohort: (patch) => eventClient.setCohort(patch),
  flush: () => eventClient.flush(),
})

/**
 * Report a caught / React-boundary error to the ONE error stream. Marks it handled
 * (the app caught it) and never throws back — telemetry must not break recovery.
 */
export function reportError(err: unknown, properties?: Record<string, unknown>): void {
  try {
    eventClient.captureError(err, { handled: true, properties })
  } catch {
    /* fail-soft — a telemetry failure must never mask the real error */
  }
}
