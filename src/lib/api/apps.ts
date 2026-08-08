/**
 * Apps API — the org's BUILDABLE SITES store (cloud `clients/projectsvc`), the
 * projects hanzo.app publishes when a user ships a site from the conversational
 * builder. Each "app" is a deployed static/SSR site with a live URL and a versioned
 * deployment history (S3-backed, Cloudflare-fronted).
 *
 * Every call is same-origin, keyless and prefix-free (`originV1Url('projects')` →
 * `<origin>/v1/projects`, the CTO one-endpoint form). The console's OWN `app/v1`
 * user-bearer BFF serves the `projects` head — it mints a short-lived user-bound IAM
 * token server-side and forwards it; the projectsvc handler resolves the org from the
 * token's `owner` claim, so every read is org-scoped SERVER-SIDE and no credential
 * reaches the browser. A cookie-only call would 403 ("X-Org-Id required"), so the
 * bearer BFF is mandatory — the EXACT per-tenant path Agents/Prompts/Evals/CRM use
 * (`projects` allow-listed in `proxy-allow.ts` CLOUD_HEADS).
 *
 * DISTINCT from two neighbours that share the "project" word:
 *  - IAM tenancy `Project` (`lib/api/projects.ts`) — the org's resource SCOPE
 *    (o11y/API-keys/datasets live under it), served by IAM. NOT a buildable site.
 *  - PaaS `PaasApp` (`lib/api/paas.ts`, `/v1/platform/*`) — long-running container
 *    apps. NOT a hanzo.app-published static site.
 * This client is the hanzo.app buildable-sites store ONLY.
 *
 * Routes (cloud `clients/projectsvc/projectsvc.go`, all return PLAIN JSON — a bare
 * array / object, NOT the casibase `{status,msg,data}` envelope):
 *   GET   /v1/projects                     list (org)       → App[]
 *   GET   /v1/projects/:slug               get              → App
 *   GET   /v1/projects/:slug/deployments   deploy history   → AppDeployment[]
 *   PATCH /v1/projects/:slug               update           → App
 *   GET   /v1/tags?key=<pk->               resolved tags    → BrowserTag[]
 *
 * A site carries its own browser TAG CONFIG (`App.tags`, platform → non-secret pixel
 * id) and the publishable `key` the hosted tag ships in the page. Both live here
 * because a project IS a site and cloud serves the public tag door from the process
 * that owns the project store (`apps/projects/tagdoor.go`) — the client mirrors that
 * ownership rather than splitting one site's tags across two modules. The API SECRET
 * of a server-side destination is NEVER here: it is sealed to KMS through
 * `POST /v1/destinations/:platform` (see `destinations.ts`).
 *
 * The `projectView` nests repo fields under `repo`; a deploy is versioned
 * monotonically (queued→building→uploading→live | error). Payloads are normalized
 * DEFENSIVELY — a field rename upstream degrades a cell rather than throwing, the
 * list reads a bare array OR any common envelope key, and the repo/currentDeploy
 * fields read either the nested HTTP shape or the flat store column. PURE normalizers
 * are unit-tested (apps.test.ts).
 */
import { restGet, restPatch, originV1Url } from './client'

const BASE = 'projects'
const enc = encodeURIComponent

// ── Coercion helpers (defensive; crm.ts style) ──────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return 0
}
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** Pull the first array found under any common envelope key (or a bare root). */
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
const rows = (payload: unknown) => arrayUnder(payload, ['data', 'projects', 'deployments', 'items', 'rows'])

// ── Domain types (mirror cloud clients/projectsvc projectView/deploymentView) ──

/** A linked source repo (the HTTP `repo` object; flat store columns also read). */
export type AppRepo = { url: string; branch: string; provider: string }

/** A buildable/deployed site (projectsvc `projectView`). */
export type App = {
  id: string
  org: string
  slug: string
  name: string
  description: string
  repo: AppRepo
  framework: string
  /** draft | queued | building | uploading | live | error (free-form lifecycle). */
  status: string
  liveUrl: string
  bucket: string
  currentDeploymentId: string
  /**
   * The site's publishable ingest key (`pk-…`). PUBLISHABLE means it belongs in a
   * page's source — it names a write scope and mints no principal — so cloud returns
   * it in full and the console shows it in full. It is what `event.js` carries.
   */
  key: string
  /** Browser tag config: platform slug → non-secret pixel id. Never a secret. */
  tags: Record<string, string>
  createdAt: number
  updatedAt: number
}

/**
 * One resolved browser tag from the public door (`GET /v1/tags`) — what the hosted
 * tag will actually inject. `type` is the injector cloud dispatches on, so it is the
 * proof a configured id reached the page, not just the stored config echoed back.
 */
export type BrowserTag = { platform: string; type: string; id: string }

/**
 * The platforms with a CLIENT-SIDE pixel — the exact set cloud's tag door injects
 * (`browserTags` in `apps/projects/tagdoor.go`). A platform outside this set can still
 * receive conversions server-side (a destination), but nothing is injected into the
 * page for it, so offering an input here would promise an injection that never
 * happens. `example` shows the shape of a real id, never a working one.
 */
export const BROWSER_PLATFORMS: readonly { platform: string; label: string; example: string }[] = [
  { platform: 'ga4', label: 'Google Analytics 4', example: 'G-XXXXXXXXXX' },
  { platform: 'meta', label: 'Meta', example: '1234567890123456' },
  { platform: 'tiktok', label: 'TikTok', example: 'CXXXXXXXXXXXXXXXXXXX' },
  { platform: 'x', label: 'X (Twitter)', example: 'oxxxx' },
]

/** One deploy attempt of a site (projectsvc `deploymentView`, versioned per app). */
export type AppDeployment = {
  id: string
  projectId: string
  version: number
  /** queued | building | uploading | live | error. */
  status: string
  source: string
  commit: string
  liveUrl: string
  prefix: string
  files: number
  bytes: number
  message: string
  createdAt: number
  updatedAt: number
}

// ── Normalizers (pure) ───────────────────────────────────────────────────────

/** The linked repo, from the nested HTTP `repo` object OR the flat store columns. */
function normalizeRepo(raw: unknown, flat: Record<string, unknown>): AppRepo {
  const r = asRecord(raw)
  return {
    url: str(r.url) || str(flat.repoUrl),
    branch: str(r.branch) || str(flat.repoBranch),
    provider: str(r.provider) || str(flat.repoProvider),
  }
}

/**
 * A site's tag config: lower-cased platform keys, trimmed ids, empties dropped —
 * mirroring cloud's own `sanitizeTags`, so what the console shows is what the door
 * will serve. `tags` is omitted entirely when a site has none.
 */
export function normalizeTags(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(asRecord(raw))) {
    const platform = k.trim().toLowerCase()
    const id = str(v).trim()
    if (platform && id) out[platform] = id
  }
  return out
}

export function normalizeApp(raw: unknown): App {
  const r = asRecord(raw)
  return {
    id: str(r.id),
    org: str(r.org),
    slug: str(r.slug),
    name: str(r.name),
    description: str(r.description),
    repo: normalizeRepo(r.repo, r),
    framework: str(r.framework),
    status: str(r.status),
    liveUrl: str(r.liveUrl),
    bucket: str(r.bucket),
    // HTTP view: `currentDeploymentId`; flat store column: `currentDeploy`.
    currentDeploymentId: str(r.currentDeploymentId) || str(r.currentDeploy),
    key: str(r.key),
    tags: normalizeTags(r.tags),
    createdAt: num(r.createdAt),
    updatedAt: num(r.updatedAt),
  }
}

/**
 * The tag set to WRITE, given a site's CURRENT tags and a draft of the platforms the
 * console renders.
 *
 * A PATCH REPLACES the whole set, so the write has to carry everything the site should
 * keep. The stored map is not limited to the four platforms with a browser pixel — it is
 * also what the server CAPI reads — so building the body from the form alone would
 * silently delete config the console never showed. Starting from `current` is what
 * prevents that; only the rendered platforms are overwritten, and clearing one removes
 * it, which is the whole point of a replacing write.
 */
export function mergeTags(
  current: Record<string, string>,
  draft: Record<string, string>,
): Record<string, string> {
  const out = { ...current }
  for (const { platform } of BROWSER_PLATFORMS) {
    const id = (draft[platform] ?? '').trim()
    if (id) out[platform] = id
    else delete out[platform]
  }
  return out
}

/** The door answers `{tags:[…]}`; a tag needs a platform and an id to mean anything. */
export const normalizeBrowserTags = (p: unknown): BrowserTag[] =>
  arrayUnder(p, ['tags'])
    .map((t) => ({ platform: str(t.platform), type: str(t.type), id: str(t.id) }))
    .filter((t) => t.platform && t.id)

export function normalizeDeployment(raw: unknown): AppDeployment {
  const r = asRecord(raw)
  return {
    id: str(r.id),
    projectId: str(r.projectId),
    version: num(r.version),
    status: str(r.status),
    source: str(r.source),
    commit: str(r.commit),
    liveUrl: str(r.liveUrl),
    prefix: str(r.prefix),
    files: num(r.files),
    bytes: num(r.bytes),
    message: str(r.message),
    createdAt: num(r.createdAt),
    updatedAt: num(r.updatedAt),
  }
}

/** A site needs an identity (slug or id) to be listed; a bare/garbage row is dropped. */
export const normalizeApps = (p: unknown): App[] =>
  rows(p).map(normalizeApp).filter((a) => a.slug || a.id)

/** Deployments carry an id; newest first (highest version, else newest createdAt). */
export const normalizeDeployments = (p: unknown): AppDeployment[] =>
  rows(p)
    .map(normalizeDeployment)
    .filter((d) => d.id)
    .sort((a, b) => b.version - a.version || b.createdAt - a.createdAt)

// ── Deep-link (pure, injection-safe) ─────────────────────────────────────────

/**
 * The hanzo.app builder deep-link that opens an EXISTING site for conversational
 * editing — the console→app round-trip. The builder (`app/dev`) reads `?project=`
 * and loads that project. `slug` is a single URL-encoded query param
 * (`URLSearchParams` encodes `&`/`=`/`#`/spaces), so nothing in a slug can inject
 * another param or escape the query. `appBase` is defaulted so the helper is
 * pure/testable; callers pass `config.appUrl`.
 */
export function builderEditUrl(slug: string, appBase = 'https://hanzo.app'): string {
  const url = new URL(`${appBase.replace(/\/+$/, '')}/dev`)
  url.searchParams.set('project', slug)
  return url.toString()
}

// ── Install snippet (pure) ───────────────────────────────────────────────────

/**
 * The PUBLIC API host a customer's own page fetches the hosted tag from.
 *
 * Deliberately NOT `config.cloudUrl`: in the browser that resolves to the console's
 * own origin, so the snippet would tell a customer to load `event.js` from the host
 * they happen to be reading the console on. The tag ships in someone else's page and
 * must name the gated API host every brand's traffic already reaches.
 */
const TAG_HOST = 'https://api.hanzo.ai'

/**
 * The one-line install for a site, keyed by its publishable `pk-`. The tag then
 * fetches `GET /v1/tags?key=` itself to learn which pixels to inject, so this line
 * never changes as the site's tags do. `defer` keeps it off the parser's critical
 * path. Pure + host-defaulted so it is testable, matching `builderEditUrl`.
 */
export const installTag = (key: string, host = TAG_HOST): string =>
  `<script defer src="${host.replace(/\/+$/, '')}/v1/event.js" data-key="${key}"></script>`

// ── Network methods (thin — one per documented route) ────────────────────────

export const AppsApi = {
  /** The org's buildable/deployed sites (`GET /v1/projects`, bare array). */
  list: (): Promise<App[]> => restGet<unknown>(originV1Url(BASE)).then(normalizeApps),

  /** One site by slug (`GET /v1/projects/:slug`). */
  get: (slug: string): Promise<App> => restGet<unknown>(originV1Url(`${BASE}/${enc(slug)}`)).then(normalizeApp),

  /** A site's deploy history, newest first (`GET /v1/projects/:slug/deployments`). */
  deployments: (slug: string): Promise<AppDeployment[]> =>
    restGet<unknown>(originV1Url(`${BASE}/${enc(slug)}/deployments`)).then(normalizeDeployments),

  /**
   * Replace a site's browser tag config (`PATCH /v1/projects/:slug`).
   *
   * A present `tags` object REPLACES the whole set — so the caller sends every
   * platform it wants kept, and `{}` clears them. That is cloud's contract, not a
   * convenience: a merge would make "remove this pixel" unexpressible. The URL owns
   * which site is written; a `slug` in the body cannot move the write.
   */
  setTags: (slug: string, tags: Record<string, string>): Promise<App> =>
    restPatch<unknown>(originV1Url(`${BASE}/${enc(slug)}`), { tags }).then(normalizeApp),

  /**
   * The tags a site's hosted tag will actually inject, straight from the public door
   * (`GET /v1/tags?key=`). This is the RESOLVED set — cloud drops a platform with no
   * browser pixel and any empty id — so it answers "what will the page do", which the
   * stored config alone cannot. Public and fail-safe: an unresolvable key is an empty
   * set at 200, never an error.
   */
  browserTags: (key: string): Promise<BrowserTag[]> =>
    restGet<unknown>(originV1Url(`tags?key=${enc(key)}`)).then(normalizeBrowserTags),
}
