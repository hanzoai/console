/**
 * Core client for the unified Hanzo Cloud `/v1` backend (the casibase API).
 *
 * One `request` function: every endpoint goes through it. Cookie credentials are
 * always included (the backend sets a session cookie at `/v1/iam/signin`), and the
 * Accept-Language header is forwarded so server-side messages localize.
 *
 * The backend wraps every response as `{ status, msg, data, total }` (legacy
 * emitters still send the count as `data2`; we read the named field first). We
 * unwrap it here and throw `ApiError` on `status !== "ok"`, so callers get the
 * payload directly or a typed failure — never a half-checked envelope.
 */
import { activeApiBase } from '~/lib/network'
import { IS_EMBED } from '~/lib/embed'
import { currentOrg } from '~/lib/org-scope'
import { currentActor } from '~/lib/actor-scope'
import { getScope } from '~/lib/scope'
import { refreshSession } from '~/lib/auth/refresh'
import { iamAccessToken } from '~/lib/auth/iam'
import { applyCsrfToInit, csrfRequired, clearCsrfToken } from './csrf'

export type ApiResponse<T> = {
  status: 'ok' | 'error'
  msg: string
  data: T
  /** Total row count for list endpoints (the named field; absent means absent). */
  total?: number
  /** Legacy Casdoor second slot — superseded by `total`; read only as fallback. */
  data2?: unknown
}

/**
 * Count from an envelope: the named `total` first, legacy `data2` second, else
 * the rows themselves. The data2 fallback lives ONLY here and dies with the
 * legacy emitters.
 */
export const envelopeTotal = (env: { total?: unknown; data2?: unknown }, rows: unknown): number => {
  if (typeof env.total === 'number') return env.total
  if (typeof env.data2 === 'number') return env.data2
  return Array.isArray(rows) ? rows.length : 0
}

/**
 * The origin-less form of a request URL — `https://console.hanzo.ai/v1/o11y/query_range`
 * and `/v1/o11y/query_range` both become `/v1/o11y/query_range`. ONE form, so an error
 * card names the same endpoint in the browser (absolute) and on the server (relative).
 * The query string is dropped: this labels the endpoint, not the individual call.
 */
const endpointPath = (url: string): string => {
  if (url === '') return ''
  try {
    return new URL(url, 'http://_').pathname
  } catch {
    return url
  }
}

export class ApiError extends Error {
  readonly status: number
  /**
   * The request path this failure actually came from (`/v1/o11y/query_range`), or ''
   * when the thrower had no URL to name.
   *
   * It is here because the honest-error cards were naming the endpoint they were LABELED
   * with rather than the one that failed: the Logs card said `/v1/o11y/logs` — a route
   * that is GET-only and 405s a POST — for a failure at `/v1/o11y/query_range`, and cost
   * a debugging session at the wrong door. A card can only tell the truth about which
   * call broke if the error carries it, so every throw below stamps its own URL.
   */
  readonly endpoint: string
  constructor(message: string, status = 0, endpoint = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpointPath(endpoint)
  }
}

const acceptLanguage = (): string => {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en'
}

/**
 * Headers sent on every cloud call. Besides locale, we stamp `X-Org-Id` with the
 * ACTIVE org scope (`currentOrg()` — the brand org by default, or the org a global
 * admin switched to in the OrgSwitcher). The casibase endpoints scope by the
 * session's org claim, but the sub-services mounted on the same backend that
 * speak plain REST (the provisioning service) require an explicit tenant header
 * and reject the request with 403 "X-Org-Id required" without it — this is what
 * lets the data-product modules resolve their tenant on the direct cloud-api
 * path, and re-scope when the operator switches org. When a gateway sits in front
 * and re-injects the header from the JWT, the stamped value is simply overwritten,
 * so sending it is correct in both topologies.
 */
const baseHeaders = (hasBody: boolean): Record<string, string> => {
  // The full tenant path on every cloud call: X-Org-Id is the ACTIVE org
  // (`currentOrg()` — brand org by default, or the org a global admin switched
  // to); X-Project-Id is sent only when a project is selected (absent =
  // org-level); X-Environment defaults to mainnet. Org scope lives in
  // lib/org-scope.ts, project + environment in lib/scope.ts — orthogonal layers
  // that compose here, so this ONE stamp makes EVERY module (o11y, api-keys,
  // deploys, …) org + project + environment scoped with no per-module change.
  const s = getScope()
  const actor = currentActor()
  // @hanzo/iam is the ONE credential: carry the PKCE access token as a Bearer on
  // every cloud call (cloud's SanitizeIdentity validates the JWT — aud=<brand>-cloud).
  // No session cookie / BFF exchange; a signed-out request simply omits it.
  const bearer = iamAccessToken()
  return {
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    'Accept-Language': acceptLanguage(),
    // ONE canonical org header. Both the provisioning sub-service and the casibase
    // data-scoping filters (ai `GetEffectiveOrg`, controllers/org_resolver.go) read
    // `X-Org-Id`, honoring it only for the principal's own org or a global admin —
    // so a brand admin's stamp is a safe no-op and a global admin's OrgSwitcher
    // change re-scopes every endpoint. (`X-IAM-Org-Id` is NOT read inbound; cloud
    // mints it OUTBOUND toward commerce from the validated principal, so stamping
    // it from the browser was inert — dropped.)
    'X-Org-Id': currentOrg(),
    // Project sub-scope. ONE fact (the selected project, from lib/scope.ts) leaves
    // this ONE seam in two wire forms, because an INTENT and an ASSERTION must not
    // share a name — conflating them is what makes a header "forgeable":
    //   - `X-Act-As-Project` is the INTENT: a request, never a claim. A validating
    //     boundary checks it against the caller's scope set and MINTS the
    //     authoritative `X-Project-Id` from it, then drops the intent — exactly what
    //     `X-Act-As-Org` → `X-Org-Id` does for the org switch (gateway
    //     iamauth.EffectiveOrg). It is what makes a project switch AUTHORIZED rather
    //     than asserted, so the switcher drives the mint instead of naming the value.
    //   - `X-Project-Id` is the ASSERTION the boundaries that exist TODAY read, and
    //     it is advisory at every one of them: the gateway STRIPS it at ingress; the
    //     `/v1`, `/vm` and `/commerce` bearer proxies DROP it (a browser-chosen
    //     project must not pick cloud's per-project eval key — see the RED MED-1
    //     suite in lib/server/bearer-proxy.test.ts); only the off-gateway readers
    //     (`/paas`, under its own admin gate + server-resolved org, and the embed's
    //     cloud, which sanitizes it) still honor it.
    // Both are sent only when a project is selected (absent = org-level), so the
    // absent-header ⟺ default-project wire contract is unchanged. The assertion
    // retires once the gateway mints `X-Project-Id` from the intent — at which point
    // no browser-supplied project reaches any backend and this collapses to one form.
    ...(s.project ? { 'X-Act-As-Project': s.project, 'X-Project-Id': s.project } : {}),
    // Actor sub-identity — the signed-in USER (`<owner>/<name>`), so org + project +
    // USER all pass on EVERY call. Present only when a session is resolved (absent
    // pre-sign-in / SSR); the gateway treats it as advisory, identity being
    // authoritative from the validated JWT — exactly like `X-Org-Id`.
    ...(actor ? { 'X-Actor-Id': actor } : {}),
    'X-Environment': s.environment,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

/** Upstream statuses that mean "the backend was momentarily unreachable" (a gateway/
 *  proxy 502, a rolling backend 503, a timeout 504) — the TRANSIENT class, safe to
 *  retry. A genuine 4xx (401/403/404/402) is NOT here: it is an honest answer, surfaced
 *  immediately. */
const TRANSIENT_STATUS = new Set([502, 503, 504])
/** Backoff schedule for the transient-retry loop: up to 3 retries after the first try
 *  (~300ms → 900ms → 2s). Worst-case added latency before the honest error card is ~3.2s. */
export const RETRY_BACKOFF_MS = [300, 900, 2000]
/** Only idempotent reads auto-retry — a POST/PUT/PATCH/DELETE that 5xx'd might have
 *  applied, so re-sending it could double-create; the user retries a mutation manually. */
export const isIdempotentMethod = (method?: string): boolean => {
  const m = (method ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}
/** True iff a `status` is the transient (retryable) class. */
export const isTransientStatus = (status: number): boolean => TRANSIENT_STATUS.has(status)

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Injected dependencies for `resilientFetch` — real ones in `authedFetch`, fakes in tests. */
export interface ResilientDeps {
  doFetch: (url: string, init: RequestInit) => Promise<Response>
  /** Single-flight server-side session refresh (returns true if it rotated the cookie). */
  refresh: () => Promise<boolean>
  sleep: (ms: number) => Promise<void>
  /** Whether a 401 refresh may be attempted (browser only — no console session on the server). */
  canRefresh: boolean
}

/**
 * The resilient fetch orchestration (pure over its injected deps) — two orthogonal
 * resiliences so a momentary backend hiccup is INVISIBLE to the user, while a genuine
 * failure is honest:
 *
 *  1. TRANSIENT-RETRY (backend rolls). A single-replica `Recreate` backend has a brief
 *     downtime window on every deploy; a read that lands in it gets a 502/503/504 or a
 *     connection error. Rather than dump the user on a scary "Could not load" card, an
 *     idempotent read (GET/HEAD) is retried with a short exponential backoff
 *     (`RETRY_BACKOFF_MS`). So a deploy blip self-heals and the error card shows ONLY on
 *     a persistent outage (after the retries exhaust). Mutations are NOT auto-retried
 *     (a 5xx'd POST might have applied — re-sending could double-create). A genuine 4xx
 *     (403/404/402) is returned immediately for the caller's honest state.
 *  2. REACTIVE silent refresh (session lapse). On a 401 it runs `refresh()` ONCE and
 *     retries with the rotated session cookie, so a durable-but-momentarily-stale console
 *     session self-heals instead of surfacing "Not authorized".
 *
 * A caller-aborted request (its own `init.signal`) is never retried — it is honored.
 */
export async function resilientFetch(url: string, init: RequestInit, deps: ResilientDeps): Promise<Response> {
  const idempotent = isIdempotentMethod(init.method)
  // Destructure to a LOCAL so the invocation below is a BARE call (`doFetch(...)`,
  // this=undefined) — NOT a method call (`deps.doFetch(...)`, this=deps). The browser's
  // global `fetch` throws "Illegal invocation" when its `this` is anything but the global,
  // so calling it as a property of `deps` would break EVERY request. A bare call works for
  // a raw global `fetch` AND for a wrapped/mock one (regression-tested).
  const doFetch = deps.doFetch
  let refreshed = false
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await doFetch(url, init)
    } catch (e) {
      // Network-level failure (connection refused / reset / DNS) during a roll → retry
      // an idempotent read, unless the CALLER aborted or the budget is exhausted.
      if (!idempotent || init.signal?.aborted || attempt >= RETRY_BACKOFF_MS.length) throw e
      await deps.sleep(RETRY_BACKOFF_MS[attempt])
      continue
    }
    // 401 → one silent server-side refresh, then retry once with the rotated cookie.
    if (res.status === 401 && !refreshed && deps.canRefresh) {
      refreshed = true
      if (await deps.refresh()) continue
      return res // no console session / refresh failed → surface the 401
    }
    // Transient upstream (a backend roll) → retry an idempotent read with backoff.
    if (idempotent && isTransientStatus(res.status) && attempt < RETRY_BACKOFF_MS.length) {
      await deps.sleep(RETRY_BACKOFF_MS[attempt])
      continue
    }
    return res
  }
}

/** The ONE fetch every cloud/BFF call goes through — `resilientFetch` wired to the real
 *  `fetch` + server-side `refreshSession` (browser-only).
 *
 *  On the embed ambient-cookie money path (`IS_EMBED`), a mutating request (POST/PUT/
 *  PATCH/DELETE) carries the anti-CSRF `X-CSRF-Token` the cloud binary's `requireCSRF`
 *  demands (clients/account/csrf.go). A 403 on such a write means an expired/rotated
 *  token (the server key resets on a cloud restart when `CONSOLE_CSRF_KEY` is unset), so
 *  we re-mint once and retry — blue's "SPA re-fetches on a 403" contract. Non-embed
 *  hosts write through the user-bearer BFF (CSRF-immune) so this is a no-op there. */
async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  const deps = { doFetch: fetch, refresh: refreshSession, sleep, canRefresh: typeof window !== 'undefined' }
  await applyCsrfToInit(init, url)
  const res = await resilientFetch(url, init, deps)
  if (res.status === 403 && csrfRequired(init.method, url)) {
    clearCsrfToken()
    await applyCsrfToInit(init, url) // re-mint a fresh token, re-stamp in place
    return resilientFetch(url, init, deps)
  }
  return res
}

const buildUrl = (path: string, query?: Query): string => {
  const url = new URL(`${activeApiBase()}/v1/${path.replace(/^\/+/, '')}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/**
 * Apply a query map to an already-built URL string (same encoding as `buildUrl`).
 * Absolute URLs pass through `new URL`; a root-relative `/v1/...` (SSR, where there
 * is no origin) is resolved against a throwaway base and returned relative again, so
 * the caller keeps the same root-relative form (the rewrite still applies).
 */
const withQuery = (base: string, query?: Query): string => {
  if (!query) return base
  const relative = base.startsWith('/')
  const url = new URL(base, relative ? 'http://_' : undefined)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return relative ? `${url.pathname}${url.search}` : url.toString()
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: { query?: Query; body?: unknown; absoluteUrl?: string; headers?: Record<string, string> } = {},
): Promise<ApiResponse<T>> {
  let res: Response
  const url = opts.absoluteUrl ? withQuery(opts.absoluteUrl, opts.query) : buildUrl(path, opts.query)
  try {
    res = await authedFetch(url, {
      method,
      credentials: 'include',
      // Caller headers merge LAST (over the canonical org/locale stamp) so a per-call
      // header like `Idempotency-Key` rides through; absent, this is the same as before.
      headers: { ...baseHeaders(opts.body !== undefined), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'Network request failed', 0, url)
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError('Not authorized', res.status, url)
  }

  let json: ApiResponse<T>
  try {
    json = (await res.json()) as ApiResponse<T>
  } catch {
    throw new ApiError(`Invalid response from server (HTTP ${res.status})`, res.status, url)
  }

  if (!res.ok && json?.status !== 'ok') {
    // `msg` is the casibase envelope's field. The plain-REST /v1 surfaces mounted on
    // the same backend answer `error` instead — the paywall's 402 body is
    // {"error":"subscription_required"} — so a response can legitimately carry either.
    // Reading only `msg` discarded that reason and left "Request failed (HTTP 402)",
    // which the honest-error classifier could only render as a generic top-up prompt,
    // sending a planless org to buy credits that will not satisfy the gate.
    const alt = (json as { error?: unknown })?.error
    const reason = json?.msg || (typeof alt === 'string' ? alt : '')
    throw new ApiError(reason || `Request failed (HTTP ${res.status})`, res.status, url)
  }
  // The envelope's own verdict, checked HERE rather than re-checked identically by all
  // seventeen verbs below. It was duplicated at every one of them, and every copy threw
  // an ApiError that could not name its endpoint because the URL is built in here. One
  // place, one throw, and the path comes with it. HTTP was 2xx, so the status stays 0.
  if (json?.status !== 'ok') throw new ApiError(json?.msg || 'Request failed', 0, url)
  return json
}

/** GET that unwraps `data` and throws on a non-ok envelope. */
export async function get<T>(path: string, query?: Query): Promise<T> {
  const r = await request<T>('GET', path, { query })
  return r.data
}

/**
 * POST a multipart form — the ONE upload door.
 *
 * It exists because `request` JSON-encodes its body, so a file cannot travel
 * that way. Everything else is shared: the SAME `authedFetch` (bearer + refresh)
 * and the SAME `baseHeaders` tenant stamp every other call carries, so an upload
 * is org/project-scoped exactly like a read.
 *
 * `Content-Type` is deliberately DELETED rather than set: the browser must write
 * it itself so it carries the multipart boundary. Setting it by hand produces a
 * body no server can parse.
 *
 * The response is a plain `/v1` JSON object (not the casibase envelope), and an
 * error body's `error`/`message` is surfaced verbatim — a failed upload should
 * say what the server said, not "Request failed".
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers = { ...baseHeaders(false) }
  delete (headers as Record<string, string>)['Content-Type']
  const url = buildUrl(path)
  let res: Response
  try {
    res = await authedFetch(url, { method: 'POST', credentials: 'include', headers, body: form })
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'Network request failed', 0, url)
  }
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: unknown; message?: unknown })
    | null
  if (!res.ok) {
    const reason = [body?.error, body?.message].find((v) => typeof v === 'string' && v) as
      | string
      | undefined
    throw new ApiError(reason || `Request failed (HTTP ${res.status})`, res.status, url)
  }
  if (!body) throw new ApiError(`Invalid response from server (HTTP ${res.status})`, res.status, url)
  return body as T
}

/**
 * Envelope GET pinned to the console's OWN origin (`<origin>/v1/<path>`), so it
 * always hits a same-origin rewrite → hardened server proxy, NEVER the direct-cloud
 * `NEXT_PUBLIC_CLOUD_URL` override. Used by the admin AGGREGATE reads
 * (`/v1/admin/{overview,usage,…}`), which MUST terminate at the global-admin-gated
 * `app/admin/aggregate` proxy — a split-origin cloud URL would bypass that console
 * gate. Same casibase envelope unwrap + `ApiError` as `get`.
 */
export async function originGet<T>(path: string, query?: Query): Promise<T> {
  const r = await request<T>('GET', path, { query, absoluteUrl: originV1Url(path) })
  return r.data
}

/**
 * Envelope POST pinned to the console's OWN origin (`<origin>/v1/<path>`) — the
 * mutating twin of `originGet`. The admin AGGREGATE mutations (`/v1/admin/providers/
 * {toggle,primary}`) MUST terminate at the global-admin-gated `app/admin/aggregate`
 * proxy, which applies the same-origin CSRF check, so pinning the ORIGIN (not
 * `config.cloudUrl`) is load-bearing: a split-origin `NEXT_PUBLIC_CLOUD_URL` could
 * otherwise route the write around the console gate. Same casibase envelope unwrap +
 * `ApiError` as `post`; the browser sends its session cookie only — no credential.
 * Optional `headers` ride through for a per-call header (e.g. `Idempotency-Key`).
 */
export async function originPost<T>(path: string, body?: unknown, query?: Query, headers?: Record<string, string>): Promise<T> {
  const r = await request<T>('POST', path, { query, body, absoluteUrl: originV1Url(path), headers })
  return r.data
}

/**
 * Envelope PUT / PATCH / DELETE pinned to the console's OWN origin (`<origin>/v1/<path>`)
 * — the idempotent-upsert / partial-edit / remove twins of `originPost`. Used by the
 * admin AGGREGATE mutations that need a verb beyond POST (`PUT /v1/admin/promos` upserts
 * the single platform promo; `PATCH`/`DELETE /v1/admin/caps/:id` edit/remove a cap).
 * They terminate at the global-admin-gated `app/admin/aggregate` proxy — which applies the
 * same-origin CSRF check on every mutating method (PUT/PATCH/DELETE included) — so pinning
 * the ORIGIN (not `config.cloudUrl`) keeps a split-origin `NEXT_PUBLIC_CLOUD_URL` from
 * routing the write around the console gate. Same casibase envelope unwrap + `ApiError`.
 */
export async function originPut<T>(path: string, body?: unknown, query?: Query): Promise<T> {
  const r = await request<T>('PUT', path, { query, body, absoluteUrl: originV1Url(path) })
  return r.data
}

export async function originPatch<T>(path: string, body?: unknown, query?: Query): Promise<T> {
  const r = await request<T>('PATCH', path, { query, body, absoluteUrl: originV1Url(path) })
  return r.data
}

/** Generic in its RESULT so a delete that reports what it freed (e.g. `/v1/admin/infra`
 *  volumes → `{deleted,snapshotId,freedMonthlyCents}`) can read it; defaults to `void`,
 *  so every existing `await originDelete(...)` caller is unchanged. */
export async function originDelete<T = void>(path: string, query?: Query): Promise<T> {
  const r = await request<T>('DELETE', path, { query, absoluteUrl: originV1Url(path) })
  return r.data
}

/**
 * Envelope GET routed through the console's OWN same-origin `/v1` user-bearer BFF
 * (`<origin>/v1/<path>`) — the casibase-envelope twin of `originGet` for the cloud-api
 * STORE-ADMIN surfaces (`get-stores` / `get-store` / `get-store-names` /
 * `get-cloud-usages` / `get-files`). These heads REQUIRE a Bearer: the
 * `app/v1/[...path]` catch-all mints a short-lived user token from the session and
 * forwards it (org from the Bearer owner), so a signed-in user reads real data instead
 * of a FALSE "session expired". Same casibase envelope unwrap + `ApiError` as `get`.
 * The head must be allow-listed in `proxy-allow.ts` (`allowCloudSurface`).
 */
export async function cloudGet<T>(path: string, query?: Query): Promise<T> {
  const r = await request<T>('GET', path, { query, absoluteUrl: cloudProxyV1Url(path) })
  return r.data
}

/** Envelope POST routed through the same-origin `/v1` user-bearer BFF — the mutating twin of `cloudGet`. */
export async function cloudPost<T = string>(path: string, body?: unknown, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('POST', path, { query, body, absoluteUrl: cloudProxyV1Url(path) })
  return r
}

/** GET that returns the full envelope (for list endpoints needing the total). */
export async function getList<T>(path: string, query?: Query): Promise<{ rows: T; total: number }> {
  const r = await request<T>('GET', path, { query })
  return { rows: r.data, total: envelopeTotal(r, r.data) }
}

/** POST a JSON body; returns the `msg` (most mutations return ok/affected). */
export async function post<T = string>(path: string, body?: unknown, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('POST', path, { query, body })
  return r
}

/**
 * IAM over the SAME `/v1` path + resilient fetch as every cloud call — IAM's
 * `{status,msg,data,total}` envelope IS our `ApiResponse`, so there is no second
 * client. These target `/v1/iam/<segment>`, which the cloud IAM edge (org-scoped)
 * serves in the one-binary console and the `/v1` bearer proxy forwards in the split
 * one — ONE path, ONE gate, in both topologies. `iamList` surfaces the total
 * (`total`, legacy `data2`) that plain `get` drops.
 */
export async function iamList<T>(segment: string, query?: Query): Promise<{ rows: T[]; total: number }> {
  const r = await request<T[]>('GET', `iam/${segment}`, { query })
  const rows = Array.isArray(r.data) ? r.data : []
  return { rows, total: envelopeTotal(r, rows) }
}

export async function iamOne<T>(segment: string, query?: Query): Promise<T> {
  const r = await request<T>('GET', `iam/${segment}`, { query })
  if (r.data === undefined || r.data === null) throw new ApiError('Not found', 404)
  return r.data
}

export const iamMutate = (segment: string, body?: unknown, query?: Query): Promise<void> =>
  post<unknown>(`iam/${segment}`, body, query).then(() => undefined)

/** Owner/name -> the `id` query param the backend expects (`owner/name`). */
export const idOf = (owner: string, name: string): string => `${owner}/${encodeURIComponent(name)}`

/**
 * A resource member URL: `<collection>/<owner>/<name>`.
 *
 * Every object in the backend is keyed by the PAIR (owner, name), and its REST
 * member route carries both as SEPARATE path segments. Each is encoded on its own
 * — encoding the pair as one segment would put a `%2F` in the path, which the
 * server decodes back into a separator before routing, so it would never match.
 */
export const memberOf = (collection: string, owner: string, name: string): string =>
  `${collection}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`

/** PATCH a JSON body — the update verb for a resource member. */
export async function patch<T = string>(path: string, body?: unknown, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('PATCH', path, { query, body })
  return r
}

/** DELETE a resource member. */
export async function del<T = string>(path: string, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('DELETE', path, { query })
  return r
}

/** The `cloudGet` twins for the mutating member verbs. */
export async function cloudPatch<T = string>(path: string, body?: unknown, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('PATCH', path, { query, body, absoluteUrl: cloudProxyV1Url(path) })
  return r
}

export async function cloudDelete<T = string>(path: string, query?: Query): Promise<ApiResponse<T>> {
  const r = await request<T>('DELETE', path, { query, absoluteUrl: cloudProxyV1Url(path) })
  return r
}

// ── Plain-REST layer ────────────────────────────────────────────────────────
// Some sub-services mounted on the same backend speak plain REST (raw JSON,
// 2xx / 201 / 204, DELETE) instead of the casibase `{status,msg,data}` envelope
// — the provisioning service (POST/GET/DELETE /v1/<kind>) and the platform DOKS
// control plane. Same cookie credentials and `ApiError` as the envelope path;
// only the body shape and verbs differ, so the transport stays in this one file.
//
// Tenancy is server-side: the gateway validates the session cookie and injects
// `X-Org-Id` from the JWT (and strips any client-supplied identity header), so
// the browser sends credentials only — never an org header.

/** Build a `/v1/<path>` URL on an arbitrary base (cloud backend by default). */
export const v1Url = (path: string, base: string = activeApiBase()): string =>
  `${base.replace(/\/+$/, '')}/v1/${path.replace(/^\/+/, '')}`

/**
 * The console's OWN same-origin `/v1/<path>` — the ONE client-visible form for EVERY
 * cloud API call, with NO prefix before `/v1/` (CTO contract: zero prefix). The browser
 * calls `<origin>/v1/prompts`; the console's `app/v1/[...path]` catch-all mints a
 * short-lived user bearer from the session and forwards to cloud-api `/v1/*` (org from
 * the Bearer owner) — so the client stays keyless and prefix-free while the bearer trust
 * boundary is unchanged. The NON-cloud heads (AI gateway, admin-aggregate, visor catalog,
 * billing, commerce) are dispatched to their own hardened proxy by a `next.config.mjs`
 * `beforeFiles` rewrite BEFORE the catch-all — invisibly to the client. On the server
 * (SSR / route handlers) there is no `window`, so this yields a root-relative `/v1/<path>`.
 */
export const originV1Url = (path: string): string => {
  const clean = path.replace(/^\/+/, '')
  return typeof window !== 'undefined' ? `${window.location.origin}/v1/${clean}` : `/v1/${clean}`
}

/**
 * Build the console's OWN same-origin `/v1/<path>` for a cloud-api head that must go
 * through the user-bearer BFF. Now IDENTICAL to `originV1Url` — every cloud path is
 * `/v1/`-rooted with ZERO prefix (CTO contract), and the `app/v1/[...path]` catch-all
 * mints a short-lived user bearer from the session and forwards to cloud-api `/v1/*`
 * (org from the Bearer owner). Kept as a named alias so the call sites that reach the
 * bearer BFF for a head that 403s on a cookie-only call (framework/s3/provisioning/
 * store-admin/…) read intentionally; the head is allow-listed in proxy-allow.ts.
 */
export const cloudProxyV1Url = originV1Url

/**
 * Build the console's OWN same-origin per-tenant billing path — the canonical
 * `/v1/billing/<path>` (the /v1-first law: ZERO prefix before `/v1/`). ONE form for
 * BOTH deployments:
 *  - go:embed console (`IS_EMBED`, console.hanzo.ai): same-origin with the cloud
 *    binary, which serves the per-tenant billing bridge at `/v1/billing/<path>`
 *    (clients/account/billing.go — forwards to commerce with the admin service token
 *    SCOPED to the validated caller's own subject); the caller is resolved from the
 *    first-party IAM session cookie (cloud middleware_identity.go).
 *  - Standalone (console2/admin): `/v1/billing/*` resolves to the console's OWN
 *    `app/v1/billing/[...path]` service-token route handler — MORE SPECIFIC than the
 *    `app/v1/[...path]` cloud BFF catch-all, so it wins — which injects the commerce
 *    SERVICE token and pins the caller's OWN billing subject server-side. Tenant
 *    isolation is unchanged; only the PATH is /v1-first (previously namespaced before `/v1/`).
 * On the server (SSR) there is no `window`, so this yields a root-relative `/v1/billing/<path>`.
 */
export const billingProxyV1Url = (path: string): string =>
  originV1Url(`billing/${path.replace(/^\/+/, '')}`)

/**
 * Build the console's OWN same-origin VISOR catalog path — the canonical `/v1/vm/<path>`
 * (the /v1-first law). The public compute CATALOG (regions / CPU sizes / GPU accelerators)
 * is served by VISOR (`visor.hanzo.svc`), a DISTINCT backend from cloud-api. `/v1/vm/*`
 * resolves to the console's OWN `app/v1/vm/[...path]` user-bearer route handler (MORE
 * SPECIFIC than the `/v1/[...path]` cloud BFF, so it wins), which mints a short-lived
 * user-bound token from the session and forwards to visor (`allowVisorSurface`). Visor's
 * catalog is un-scoped (any signed-in user), so the minted bearer is accepted and the real
 * DO region/size/GPU catalog loads. On the server (SSR) this yields a root-relative
 * `/v1/vm/<path>`.
 *
 * NB: the visor `/v1/vm/gpus` catalog (accelerator models + VRAM + price) is DISTINCT from
 * the cloud-api GPU INVENTORY at `/v1/gpus` (a per-org shape served by the cloud BFF) — the
 * catalog MUST read visor, never cloud-api.
 */
export const vmProxyV1Url = (path: string): string =>
  originV1Url(`vm/${path.replace(/^\/+/, '')}`)

/**
 * Build the console's OWN same-origin COMMERCE store path — the canonical
 * `/v1/commerce/<path>` (the /v1-first law). The store/merchant admin surface
 * (product/order/user/variant/collection/discount/store…) is served by commerce
 * (`commerce.hanzo.svc`) and REQUIRES a Bearer. ONE form for BOTH deployments:
 *  - go:embed console (`IS_EMBED`): same-origin with the cloud binary, which serves
 *    the per-tenant store bridge at `/v1/commerce/<path>` (clients/account/commerce.go),
 *    scoped to the validated caller's own org (first-party IAM session cookie).
 *  - Standalone (console2/admin): `/v1/commerce/*` resolves to the console's OWN
 *    `app/v1/commerce/[...path]` user-bearer route handler (MORE SPECIFIC than the
 *    `app/v1/[...path]` cloud BFF), which mints a short-lived user-bound IAM token and
 *    forwards to commerce with the org resolved from the token owner
 *    (`allowCommerceSurface`). Tenant isolation is unchanged; only the PATH is /v1-first
 *    (previously namespaced before `/v1/`).
 * On the server (SSR) there is no `window`, so this yields a root-relative `/v1/commerce/<path>`.
 */
export const commerceProxyV1Url = (path: string): string =>
  originV1Url(`commerce/${path.replace(/^\/+/, '')}`)

async function restRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T | undefined> {
  let res: Response
  try {
    res = await authedFetch(url, {
      method,
      credentials: 'include',
      headers: { ...baseHeaders(body !== undefined), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'Network request failed', 0, url)
  }

  return parseRestResponse<T>(res, url)
}

/** Parse a plain-REST `Response` into `T | undefined`: 401/403 → ApiError, 204 → undefined,
 *  a JSON body unwrapped, and a non-ok status carrying the human message from whichever
 *  error shape (`{msg}` / `{error}` / `{error:{message}}`). Shared by every REST verb.
 *  `url` is the request's own URL, stamped onto every failure so the error names the
 *  endpoint that actually broke — `res.url` is empty on a constructed Response, so the
 *  caller passes what it asked for rather than what the Response remembers. */
async function parseRestResponse<T>(res: Response, url: string): Promise<T | undefined> {
  if (res.status === 401 || res.status === 403) throw new ApiError('Not authorized', res.status, url)
  if (res.status === 204) return undefined

  const text = await res.text()
  let json: unknown
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // A non-JSON error body IS the human message — a backend that answers a 4xx with a
      // plain-text reason (the engine's 400/404/409) — so surface it (capped) instead of a
      // generic code. A non-JSON 2xx body is a malformed success.
      if (!res.ok) throw new ApiError(text.trim().slice(0, 300) || `Request failed (HTTP ${res.status})`, res.status, url)
      throw new ApiError(`Invalid response from server (HTTP ${res.status})`, res.status, url)
    }
  }

  if (!res.ok) {
    // The OpenAI-compatible endpoints return `{ error: { message } }` (e.g. the
    // 402 billing gate); plain REST returns `{ msg }` or `{ error: "…" }`. Pull
    // the human message from whichever shape so callers never see "[object Object]".
    let m: string | undefined
    if (json && typeof json === 'object') {
      const j = json as { msg?: unknown; error?: unknown }
      if (typeof j.msg === 'string' && j.msg) m = j.msg
      else if (typeof j.error === 'string') m = j.error
      else if (j.error && typeof j.error === 'object') {
        const em = (j.error as { message?: unknown }).message
        if (typeof em === 'string') m = em
      }
    }
    throw new ApiError(m || `Request failed (HTTP ${res.status})`, res.status, url)
  }
  return json as T
}

/**
 * POST a RAW binary body (a deploy artifact — a zip/tar.gz static build) to a full URL,
 * with the caller's own `Content-Type` (e.g. `application/zip`, `application/gzip`). Rides
 * the SAME `authedFetch` as every REST verb (session cookie, silent 401-refresh), but the
 * body is passed through verbatim — never `JSON.stringify`'d — and `baseHeaders(false)` is
 * used so the JSON `Content-Type` is NOT stamped over the binary one. The console `/v1`
 * bearer proxy forwards the bytes + this Content-Type to cloud unchanged (upstreamHeaders).
 */
export const restPostRaw = <T>(
  url: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
): Promise<T | undefined> =>
  (async () => {
    let res: Response
    try {
      res = await authedFetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { ...baseHeaders(false), 'Content-Type': contentType },
        // A raw binary body (ArrayBuffer/Uint8Array/Blob) is a valid fetch BodyInit; the
        // cast bridges the strict typed-array generic (Uint8Array<ArrayBufferLike>).
        body: body as BodyInit,
      })
    } catch (e) {
      throw new ApiError(e instanceof Error ? e.message : 'Network request failed', 0, url)
    }
    return parseRestResponse<T>(res, url)
  })()

/** REST GET on a full URL (build it with `v1Url`). */
export const restGet = <T>(url: string): Promise<T> => restRequest<T>('GET', url) as Promise<T>

/** REST POST a JSON body on a full URL, with optional extra request headers. */
export const restPost = <T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
  restRequest<T>('POST', url, body, headers) as Promise<T>

/** REST PUT a JSON body on a full URL, with optional extra request headers. */
export const restPut = <T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
  restRequest<T>('PUT', url, body, headers) as Promise<T>

/** REST PATCH a JSON body on a full URL, with optional extra request headers. */
export const restPatch = <T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> =>
  restRequest<T>('PATCH', url, body, headers) as Promise<T>

/** REST DELETE on a full URL; resolves on 204. */
export const restDelete = (url: string): Promise<void> =>
  restRequest<void>('DELETE', url).then(() => undefined)
