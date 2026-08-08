/**
 * Destinations API — the org's SERVER-SIDE conversion destinations (cloud
 * `clients/destinations`). A destination receives the same events the browser pixel
 * does, sent server-to-server from the Conversions API, stamped with the same
 * `event_id` the hosted tag stamps — which is what lets a platform dedupe the two.
 *
 * Every call is same-origin, keyless and prefix-free (`originV1Url('destinations')` →
 * `<origin>/v1/destinations`). The handler resolves the org from the validated
 * principal, so a cookie-only or forged-header call is refused and every read is
 * org-scoped SERVER-SIDE (`destinations` allow-listed in `proxy-allow.ts`).
 *
 * SCOPE — destinations are per-ORG, browser tags are per-SITE. That is cloud's model
 * (a destination row is keyed by org and platform alone), so this client never
 * accepts a site and the UI must not imply one. Conflating them would show a
 * per-site switch that silently writes org-wide.
 *
 * SECRETS — a destination's API credential is sealed into KMS under a path scoped to
 * the caller's own org. It is submitted ONCE through `connect` and is never returned
 * by any route: a status card publishes only the NAMES a platform custodies
 * (`secrets`), never a value. So this module can read a destination's state without
 * ever holding a credential, and nothing here can display one.
 *
 * Routes (PLAIN JSON, not the casibase `{status,msg,data}` envelope):
 *   GET    /v1/destinations                  every platform + this org's state
 *   POST   /v1/destinations/:platform        connect / update  (org admin)
 *   DELETE /v1/destinations/:platform        disconnect        (org admin)
 *   POST   /v1/destinations/:platform/test   send one synthetic event
 *
 * The connect body is UNTYPED by design: its property NAMES are chosen by the
 * addressed platform's own spec, which the status card carries. So the console
 * renders the form FROM the response (`fields` + `secrets`) rather than hardcoding a
 * shape per platform — a platform added upstream appears here with no console change.
 */
import { restGet, restPost, restDelete, originV1Url } from './client'

const BASE = 'destinations'
const enc = encodeURIComponent

// ── Coercion helpers (defensive; apps.ts style) ─────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const bool = (v: unknown): boolean => v === true
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const arrayUnder = (payload: unknown, keys: string[]): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]
  if (payload && typeof payload === 'object') {
    for (const k of keys) {
      const v = (payload as Record<string, unknown>)[k]
      if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]
    }
  }
  return []
}

// ── Domain types (mirror cloud DestinationStatus / DestinationField) ─────────

/** One NON-SECRET input a platform needs — a measurement, pixel or dataset id. */
export type DestinationField = {
  /** The camelCase key on both the connect body and the stored config. */
  key: string
  label: string
  /** A connect that leaves a required field empty is refused. */
  required: boolean
  /** A sample of the right SHAPE ("G-XXXXXXX"), never a working value. */
  example: string
}

/** A platform this deployment can forward to, with this org's connection state. */
export type Destination = {
  /** The platform slug, and the path segment every route addresses it by. */
  platform: string
  name: string
  /** Analytics | Advertising — groups the cards. */
  category: string
  /** This org has configured it at least once. Says nothing about the credential. */
  connected: boolean
  /** Whether the fan-out forwards to it. False on a connected-but-paused one. */
  enabled: boolean
  /** Whether a credential resolves RIGHT NOW. `connected && !live` = reconnect me. */
  live: boolean
  /** The operator's own label for the connected account. */
  account: string
  /** The org's stored NON-SECRET ids, keyed by field. Never holds a secret. */
  config: Record<string, string>
  /** The non-secret inputs to render. */
  fields: DestinationField[]
  /** The KMS secret NAMES this platform custodies — names only, never values. */
  secrets: string[]
}

/** The outcome of one synthetic send, reported as DATA so a rejection renders. */
export type DestinationTest = {
  ok: boolean
  /** How many events the platform accepted; null when it did not say. */
  sent: number | null
  /** The platform's own note on success. */
  message: string
  /** The platform's rejection on failure. */
  error: string
}

// ── Normalizers (pure) ───────────────────────────────────────────────────────

function normalizeField(raw: unknown): DestinationField {
  const r = asRecord(raw)
  return { key: str(r.key), label: str(r.label), required: bool(r.required), example: str(r.example) }
}

/** The stored config is non-secret ids only; coerce every value to a string. */
function normalizeConfig(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(asRecord(raw))) {
    const val = str(v).trim()
    if (k && val) out[k] = val
  }
  return out
}

export function normalizeDestination(raw: unknown): Destination {
  const r = asRecord(raw)
  return {
    platform: str(r.platform),
    name: str(r.name) || str(r.platform),
    category: str(r.category),
    connected: bool(r.connected),
    enabled: bool(r.enabled),
    live: bool(r.live),
    account: str(r.account),
    config: normalizeConfig(r.config),
    fields: (Array.isArray(r.fields) ? r.fields : []).map(normalizeField).filter((f) => f.key),
    secrets: (Array.isArray(r.secrets) ? r.secrets : []).map(str).filter(Boolean),
  }
}

/** A destination needs a platform to be addressable; a bare/garbage row is dropped. */
export const normalizeDestinations = (p: unknown): Destination[] =>
  arrayUnder(p, ['destinations', 'data', 'items', 'rows']).map(normalizeDestination).filter((d) => d.platform)

export function normalizeTest(raw: unknown): DestinationTest {
  const r = asRecord(raw)
  return {
    ok: bool(r.ok),
    sent: typeof r.sent === 'number' && Number.isFinite(r.sent) ? r.sent : null,
    message: str(r.message),
    error: str(r.error),
  }
}

// ── Pure logic (exported for tests) ──────────────────────────────────────────

/**
 * The connect-body key for a KMS secret: the camelCase of its name
 * (`api_secret` → `apiSecret`). Cloud accepts both forms; we send the documented one.
 */
export const secretKey = (name: string): string =>
  name.trim().toLowerCase().replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())

/** A human label for a KMS secret name (`access_token` → "Access token"). */
export const secretLabel = (name: string): string => {
  const words = name.trim().toLowerCase().split(/[_\s]+/).filter(Boolean)
  if (words.length === 0) return name
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

/**
 * Whether a destination still needs its credential typed in. A NEW connection always
 * does; an existing one does not — cloud keeps the sealed secret when the body omits
 * it, so an operator editing a pixel id is not forced to re-paste a token they cannot
 * read back. A connected destination whose credential stopped resolving
 * (`connected && !live`) is exactly the case where re-entry is the fix.
 */
export const needsSecret = (d: Destination): boolean =>
  d.secrets.length > 0 && (!d.connected || !d.live)

/** The one honest state word for a destination, for the status pill. */
export function destinationState(d: Destination): 'live' | 'paused' | 'reconnect' | 'off' {
  if (!d.connected) return 'off'
  if (!d.live) return 'reconnect'
  return d.enabled ? 'live' : 'paused'
}

/**
 * The first missing REQUIRED field, or null when the form is complete. Cloud refuses
 * such a connect with a 400; catching it here names the field instead.
 */
export function missingField(d: Destination, values: Record<string, string>): DestinationField | null {
  for (const f of d.fields) {
    if (f.required && !(values[f.key] ?? '').trim()) return f
  }
  return null
}

/**
 * The connect body: the platform's own non-secret fields, then each supplied secret
 * under its camelCase name, then the account label and enabled flag.
 *
 * An EMPTY secret is omitted rather than sent blank — cloud reads an omitted secret as
 * "keep the sealed one" and would treat a blank as nothing to seal, so omitting is what
 * makes editing a connected destination non-destructive. Values are trimmed; a blank
 * optional field is dropped so it clears rather than storing whitespace.
 */
export function connectBody(
  d: Destination,
  values: Record<string, string>,
  secrets: Record<string, string>,
  opts: { account?: string; enabled?: boolean } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of d.fields) {
    const v = (values[f.key] ?? '').trim()
    if (v) body[f.key] = v
  }
  for (const name of d.secrets) {
    const v = (secrets[name] ?? '').trim()
    if (v) body[secretKey(name)] = v
  }
  if (opts.account !== undefined) body.account = opts.account.trim()
  if (opts.enabled !== undefined) body.enabled = opts.enabled
  return body
}

// ── Network methods (thin — one per documented route) ────────────────────────

export const DestinationsApi = {
  /** Every platform this deployment can forward to, with the org's state. */
  list: (): Promise<Destination[]> => restGet<unknown>(originV1Url(BASE)).then(normalizeDestinations),

  /**
   * Connect or update one destination. The secret (when supplied) is sealed to KMS
   * server-side and never returned; the response is the same status card the reads
   * answer with, so `live` reports whether the credential actually resolved.
   */
  connect: (platform: string, body: Record<string, unknown>): Promise<Destination> =>
    restPost<unknown>(originV1Url(`${BASE}/${enc(platform)}`), body).then(normalizeDestination),

  /** Disconnect: the row and its sealed credentials are removed. */
  disconnect: (platform: string): Promise<void> =>
    restDelete(originV1Url(`${BASE}/${enc(platform)}`)),

  /**
   * Send one synthetic pageview. It answers 200 with `{ok:false, error}` on a platform
   * rejection rather than an HTTP error, so the rejection is rendered as data.
   */
  test: (platform: string): Promise<DestinationTest> =>
    restPost<unknown>(originV1Url(`${BASE}/${enc(platform)}/test`)).then(normalizeTest),
}
