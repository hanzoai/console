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
 *    client NEVER sends an org/tenant on the wire — Cloud stamps it from the
 *    credential, and `ingestKey` is that credential.
 *  - `ingestKey` — the BRAND's own publishable key (`config.ingestKey`, resolved
 *    per host). It names the tenant; see the note below for why it, and not the
 *    visitor's bearer.
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

import { config } from '~/config'

/** Honor an explicit browser opt-out signal (GPC, then legacy DNT). SSR (no
 *  navigator) defaults to enabled; the browser instance reads the real signal. */
function consented(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null }
  if (nav.globalPrivacyControl === true) return false
  const dnt = nav.doNotTrack
  return dnt !== '1' && dnt !== 'yes'
}

// ── THE TENANT IS THIS CONSOLE, NOT ITS VISITOR ──────────────────────────────
//
// This file used to pass `getToken` — the signed-in visitor's IAM bearer — and
// argued at length that a publishable key would be a cross-tenant leak. It had the
// leak exactly backwards.
//
// Cloud stamps `event.fact.org` from whatever credential reaches the door, and a
// validated bearer WINS: `eventTenant` (apps/analytics/event.go) returns on the
// bearer BEFORE a key is read. The org it stamps is `X-Org-Id`, which SanitizeIdentity
// sets to the org the visitor SELECTED (any org in their signed `orgs` claim), else
// their home org. So the console's own product telemetry was filed into whichever
// customer tenant the visitor happened to be acting in. Production proved it: 18
// rows of Hanzo console analytics under `proofwalk-aug05`, one onboarding walk,
// because first-run onboarding CREATES an org and re-authenticates into it. Every
// signed-in customer does that. It scaled with the customer list.
//
// Adding a key while KEEPING the bearer would have fixed nothing — the bearer still
// wins server-side — which is why `getToken` is GONE rather than merely joined.
//
// The key is not a leak, because it is resolved PER BRAND at runtime from the
// hostname (`config.ingestKey` → `brandFromHost`), which is the same mechanism that
// already picks the IAM issuer and the billing host. One artifact, six brands, six
// keys; a brand with no key emits NOTHING rather than borrowing someone's identity.
// That is why the key lives in `src/config` and not in a build arg: a build arg
// carries one value, and one value cannot serve six brands.
//
// Nothing is lost by dropping the bearer. It was only ever a credential — never the
// identity. `distinctId` comes from `identify()` (Analytics.tsx binds the stable
// `owner/name` actor id), so who the person is still rides the stream; only WHERE
// the row lands has changed hands, from the visitor to the console.

/** Error-plane credential. Unset → captureError is inert (fail-safe). */
const dsn = process.env.NEXT_PUBLIC_HANZO_EVENT_DSN?.trim() || undefined

/** This brand's publishable key — the tenant of everything this client sends. */
const ingestKey = config.ingestKey || undefined

/**
 * The ONE gate, shared by the client and the ambient wrapper below so they cannot
 * disagree. Both conditions are necessary: consent decides WHETHER we may send, the
 * key decides WHERE it lands, and without a destination there is nothing to send.
 */
const emitting = consented() && Boolean(ingestKey)

/**
 * The ONE console analytics client. Built once at module scope (SSR-safe: the
 * client's browser-only side effects are guarded and deferred to `init()`, which
 * the provider fires in an effect). Shared by the provider and the error boundaries.
 */
export const eventClient: Analytics = createAnalytics({
  product: 'console',
  host: '',
  // The brand's own key, read at module init — in the browser, where `config`
  // resolves it from the real `window.location.hostname`. Unlike the token it
  // replaces, this does not change during a session, so there is nothing to
  // re-read at flush time.
  ingestKey,
  dsn,
  enabled: emitting,
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
// one stream, same-origin — so component events arrive CREDENTIALED, attributed to
// the BRAND by the key this client carries. `AnalyticsProvider` in Provider.tsx
// already hands this same instance to `useAnalytics()`.
//
// The wrapper is the `Telemetry` shape @hanzogui/telemetry hands out; every method
// delegates, so there is nothing here to keep in sync but the delegation itself.
// `enabled` mirrors the client's own gate rather than asserting true: a wrapper
// that claims to be live over a disabled client makes `telemetry.enabled` lie.
setTelemetry({
  enabled: emitting,
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
