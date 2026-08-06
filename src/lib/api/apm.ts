/**
 * APM / Infrastructure / Exceptions / Dashboards API — the O11y-flagship
 * observability surface, over the REAL Hanzo o11y (O11y) runtime.
 *
 * Transport: the same-origin user-bearer `/v1` proxy (`cloudProxyV1Url`, now an alias
 * of `originV1Url` → `<origin>/v1/o11y/<resource>`) — the browser sends only its session
 * cookie, the `app/v1/[...path]` catch-all mints a short-lived IAM bearer and forwards it,
 * and cloud-api serves the embedded o11y surface. Every cloud head is `/v1/`-rooted with
 * ZERO prefix (the `/cloud/` prefix was retired in v8.4.120); the `o11y` head is allow-
 * listed in `proxy-allow.ts` so a cookie-only or cross-tenant call is refused server-side
 * (o11y scopes every query by the JWT `owner` claim → `X-Org-Id`).
 *
 * Paths are VERSION-LESS: the canonical o11y contract is `/v1/o11y/<resource>` with NO
 * nested version and NO `/api/` — `o11y/services`, `o11y/dependency_graph`,
 * `o11y/query_range`, `o11y/listErrors`, `o11y/dashboards`, … (the old `o11y/v1/*` /
 * `o11y/v3/query_range` forms still resolve via a deprecated backend alias, but the
 * client speaks the canonical version-less surface). This is the SAME path AlertsModule
 * uses for `o11y/rules`, so the whole APM/infra/exceptions/dashboards surface rides it
 * with no new plumbing.
 *
 * o11y (O11y) speaks plain REST (raw JSON, real HTTP status codes), NOT the
 * casibase `{status,msg,data}` envelope — so we use `restGet`/`restPost`. When the
 * runtime is not initialized it answers 503; unrouted surfaces 404; access issues
 * 401/403. `restGet`/`restPost` throw a typed `ApiError` carrying that status, so
 * the modules render an honest `RuntimeNotice` instead of fabricating spans, hosts,
 * exceptions, or dashboards.
 *
 * Time units follow O11y's own controllers (verified against o11y
 * pkg/query-service): APM (services / dependency graph / listErrors) takes
 * NANOSECOND epoch strings; infra (hosts / pods / nodes / namespaces / clusters)
 * takes MILLISECOND epoch numbers. `apmWindow` / `infraWindow` build each correctly.
 *
 * Every reader returns a normalized, defensively-parsed view-model (garbage/absent
 * fields degrade to 0 / '' / [], never a throw), so the pure normalizers unit-test
 * without a live backend.
 */
import { restGet, restPost, cloudProxyV1Url } from './client'

// ── Time windows ──────────────────────────────────────────────────────────────

/** A resolved lookback window with the start/end in whatever unit the caller needs. */
export type ApmWindow = { startNs: string; endNs: string; startMs: number; endMs: number; seconds: number }

/** Build a window ending now, spanning `seconds`, carrying both ns-strings and ms-numbers. */
export function apmWindow(seconds: number): ApmWindow {
  const endMs = Date.now()
  const startMs = endMs - seconds * 1000
  return {
    startNs: String(startMs * 1_000_000),
    endNs: String(endMs * 1_000_000),
    startMs,
    endMs,
    seconds,
  }
}

// ── Service map / APM ─────────────────────────────────────────────────────────

/** One service row from `/v1/o11y/services` (POST): RED metrics over the window. */
export type ServiceRow = {
  serviceName: string
  /** p99 latency, nanoseconds (O11y returns ns). */
  p99: number
  /** Average duration, nanoseconds. */
  avgDuration: number
  numCalls: number
  callRate: number
  numErrors: number
  errorRate: number
  num4XX: number
  fourXXRate: number
}

/** One edge of the service dependency graph (`/v1/o11y/dependency_graph`). */
export type DependencyEdge = {
  parent: string
  child: string
  callCount: number
  callRate: number
  errorRate: number
  p99: number
  p95: number
  p50: number
}

/** One top-operation row for a service (`/v1/o11y/service/top_operations`). */
export type TopOperation = {
  name: string
  p50: number
  p95: number
  p99: number
  numCalls: number
  errorCount: number
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Normalize one raw service object → ServiceRow (tolerant of missing fields). */
export function normalizeService(r: unknown): ServiceRow {
  const o = (r ?? {}) as Record<string, unknown>
  return {
    serviceName: str(o.serviceName),
    p99: num(o.p99),
    avgDuration: num(o.avgDuration),
    numCalls: num(o.numCalls),
    callRate: num(o.callRate),
    numErrors: num(o.numErrors),
    errorRate: num(o.errorRate),
    num4XX: num(o.num4XX),
    fourXXRate: num(o.fourXXRate),
  }
}

/** Normalize the services response (an array, or `{data:[…]}`) → ServiceRow[]. */
export function normalizeServices(body: unknown): ServiceRow[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown[] })?.data) ? (body as { data: unknown[] }).data : []
  return rows.map(normalizeService).filter((s) => s.serviceName !== '')
}

/** Normalize one dependency-graph edge. */
export function normalizeEdge(r: unknown): DependencyEdge {
  const o = (r ?? {}) as Record<string, unknown>
  return {
    parent: str(o.parent),
    child: str(o.child),
    callCount: num(o.callCount),
    callRate: num(o.callRate),
    errorRate: num(o.errorRate),
    p99: num(o.p99),
    p95: num(o.p95),
    p50: num(o.p50),
  }
}

/** Normalize the dependency-graph response → edges (drops self/empty endpoints). */
export function normalizeDependencies(body: unknown): DependencyEdge[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown[] })?.data) ? (body as { data: unknown[] }).data : []
  return rows.map(normalizeEdge).filter((e) => e.parent !== '' && e.child !== '')
}

/** Normalize the top-operations response (O11y returns rows keyed by name). */
export function normalizeTopOperations(body: unknown): TopOperation[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown[] })?.data) ? (body as { data: unknown[] }).data : []
  return rows
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      return {
        name: str(o.name ?? o.operation),
        p50: num(o.p50),
        p95: num(o.p95),
        p99: num(o.p99),
        numCalls: num(o.numCalls),
        errorCount: num(o.errorCount),
      }
    })
    .filter((t) => t.name !== '')
}

// ── Per-service health (RED metrics for ONE product's service) ────────────────

/**
 * Pick the RED-metrics row for a product's OTel service from the services list,
 * trying each candidate name in order (the product's o11y `service.name`, then its
 * operator-app name — a product may emit under either). Exact match, so a wrong
 * guess yields `null` (→ honest empty), never another service's metrics.
 */
export function pickService(rows: ServiceRow[], candidates: (string | null | undefined)[]): ServiceRow | null {
  const names = candidates.filter((c): c is string => typeof c === 'string' && c !== '')
  for (const n of names) {
    const hit = rows.find((r) => r.serviceName === n)
    if (hit) return hit
  }
  return null
}

/** A product service's live health, derived from its o11y RED metrics over the window. */
export type ServiceHealth = {
  service: string
  numCalls: number
  callRate: number
  /** Error rate as a percentage (O11y `errorRate` is already a percent). */
  errorRatePct: number
  /** p99 latency in milliseconds (O11y returns nanoseconds). */
  p99Ms: number
  /** Average latency in milliseconds. */
  avgMs: number
  tone: 'green' | 'yellow' | 'red'
}

/**
 * Derive a service's health from its RED metrics: a service that served traffic in
 * the window is `green`, `yellow` at ≥1% errors, `red` at ≥5% — the standard RED
 * verdict. `null` when the service reported no calls (nothing to fabricate a verdict
 * from → the view shows an honest "no telemetry" state, never a fake green).
 */
export function serviceHealthOf(row: ServiceRow | null): ServiceHealth | null {
  if (!row || row.serviceName === '' || row.numCalls <= 0) return null
  const errorRatePct = Math.max(0, row.errorRate)
  const tone = errorRatePct >= 5 ? 'red' : errorRatePct >= 1 ? 'yellow' : 'green'
  return {
    service: row.serviceName,
    numCalls: row.numCalls,
    callRate: row.callRate,
    errorRatePct,
    p99Ms: row.p99 / 1_000_000,
    avgMs: row.avgDuration / 1_000_000,
    tone,
  }
}

// ── Infrastructure (hosts / k8s) ──────────────────────────────────────────────

/** One host row from `/v1/o11y/hosts/list`. */
export type HostRow = {
  hostName: string
  active: boolean
  os: string
  /** CPU utilization, 0..1 (O11y returns a fraction). */
  cpu: number
  /** Memory utilization, 0..1. */
  memory: number
  wait: number
  load15: number
}

/** One pod row from `/v1/o11y/pods/list`. */
export type PodRow = {
  podName: string
  cpu: number
  cpuRequest: number
  cpuLimit: number
  memory: number
  memoryRequest: number
  memoryLimit: number
  restarts: number
  /** Namespace / workload from the record's meta labels, best-effort. */
  namespace: string
  phase: { pending: number; running: number; succeeded: number; failed: number; unknown: number }
}

/** One node row from `/v1/o11y/nodes/list`. */
export type NodeRow = {
  nodeName: string
  cpuUsage: number
  cpuAllocatable: number
  memoryUsage: number
  memoryAllocatable: number
  condition: { ready: number; notReady: number; unknown: number }
}

/** The normalized infra list envelope: rows + total + whether any data was seen. */
export type InfraList<T> = { records: T[]; total: number; hasData: boolean }

/** Read the human name out of a record's `meta` labels, trying the known keys. */
const metaName = (meta: unknown, keys: string[]): string => {
  const m = (meta ?? {}) as Record<string, unknown>
  for (const k of keys) {
    const v = m[k]
    if (typeof v === 'string' && v !== '') return v
  }
  return ''
}

const rawRecords = (body: unknown): { rows: unknown[]; total: number } => {
  const b = (body ?? {}) as { records?: unknown[]; total?: unknown; data?: { records?: unknown[]; total?: unknown } }
  const src = b.records ? b : b.data ?? {}
  const rows = Array.isArray((src as { records?: unknown[] }).records) ? (src as { records: unknown[] }).records : []
  const total = num((src as { total?: unknown }).total) || rows.length
  return { rows, total }
}

/** Normalize the host-list response → HostRow[] (+ total + hasData). */
export function normalizeHosts(body: unknown): InfraList<HostRow> {
  const { rows, total } = rawRecords(body)
  const records = rows.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    return {
      hostName: str(o.hostName) || metaName(o.meta, ['host.name', 'hostName']),
      active: Boolean(o.active),
      os: str(o.os) || metaName(o.meta, ['os.type']),
      cpu: num(o.cpu),
      memory: num(o.memory),
      wait: num(o.wait),
      load15: num(o.load15),
    }
  })
  return { records, total, hasData: records.length > 0 }
}

/** Normalize the pod-list response → PodRow[]. */
export function normalizePods(body: unknown): InfraList<PodRow> {
  const { rows, total } = rawRecords(body)
  const records = rows.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const ph = (o.countByPhase ?? {}) as Record<string, unknown>
    return {
      podName: metaName(o.meta, ['k8s.pod.name', 'k8s_pod_name']) || str(o.podUID),
      cpu: num(o.podCPU),
      cpuRequest: num(o.podCPURequest),
      cpuLimit: num(o.podCPULimit),
      memory: num(o.podMemory),
      memoryRequest: num(o.podMemoryRequest),
      memoryLimit: num(o.podMemoryLimit),
      restarts: num(o.restartCount),
      namespace: metaName(o.meta, ['k8s.namespace.name', 'k8s_namespace_name']),
      phase: {
        pending: num(ph.pending),
        running: num(ph.running),
        succeeded: num(ph.succeeded),
        failed: num(ph.failed),
        unknown: num(ph.unknown),
      },
    }
  })
  return { records, total, hasData: records.length > 0 }
}

/** Normalize the node-list response → NodeRow[]. */
export function normalizeNodes(body: unknown): InfraList<NodeRow> {
  const { rows, total } = rawRecords(body)
  const records = rows.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>
    const c = (o.countByCondition ?? {}) as Record<string, unknown>
    return {
      nodeName: metaName(o.meta, ['k8s.node.name', 'k8s_node_name']) || str(o.nodeUID),
      cpuUsage: num(o.nodeCPUUsage),
      cpuAllocatable: num(o.nodeCPUAllocatable),
      memoryUsage: num(o.nodeMemoryUsage),
      memoryAllocatable: num(o.nodeMemoryAllocatable),
      condition: { ready: num(c.ready), notReady: num(c.notReady), unknown: num(c.unknown) },
    }
  })
  return { records, total, hasData: records.length > 0 }
}

// ── Exceptions ────────────────────────────────────────────────────────────────

/** One grouped exception from `/v1/o11y/listErrors`. */
export type ExceptionGroup = {
  groupID: string
  exceptionType: string
  exceptionMessage: string
  exceptionCount: number
  serviceName: string
  lastSeen: string
  firstSeen: string
}

/** Normalize one raw error group. */
export function normalizeException(r: unknown): ExceptionGroup {
  const o = (r ?? {}) as Record<string, unknown>
  return {
    groupID: str(o.groupID),
    exceptionType: str(o.exceptionType),
    exceptionMessage: str(o.exceptionMessage),
    exceptionCount: num(o.exceptionCount),
    serviceName: str(o.serviceName),
    lastSeen: str(o.lastSeen),
    firstSeen: str(o.firstSeen),
  }
}

/** Normalize the listErrors response → ExceptionGroup[]. */
export function normalizeExceptions(body: unknown): ExceptionGroup[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown[] })?.data) ? (body as { data: unknown[] }).data : []
  return rows.map(normalizeException).filter((e) => e.exceptionType !== '' || e.exceptionMessage !== '')
}

// ── Error tracking (Issues) ──────────────────────────────────────────────────
// Sentry-class grouped errors from the o11y errortracking module
// (`/v1/o11y/errortracking/issues`). Occurrences live in the telemetry store; an
// Issue is the fingerprint bucket with lifecycle. Org scope is server-enforced.

export type IssueStatus = 'unresolved' | 'resolved' | 'ignored'

export type Issue = {
  id: string
  fingerprint: string
  type: string
  value: string
  culprit: string
  level: string
  platform: string
  status: IssueStatus
  assignee: string
  firstSeen: string
  lastSeen: string
  count: number
  regressed: boolean
  environment: string
  release: string
  serviceName: string
}

export type OccurrenceFrame = { function: string; module: string; filename: string; lineno: number; inApp: boolean }

/** The issue's latest occurrence sample (drives the detail view). */
export type Occurrence = {
  eventId: string
  type: string
  value: string
  culprit: string
  level: string
  platform: string
  timestamp: string
  environment: string
  release: string
  serviceName: string
  traceId: string
  spanId: string
  frames: OccurrenceFrame[]
}

export type IssueDetail = { issue: Issue | null; latestEvent: Occurrence | null }

/** Unwrap the o11y `{status,data}` render envelope (a bare body passes through). */
const unwrapData = (body: unknown): unknown =>
  body && typeof body === 'object' && 'data' in (body as Record<string, unknown>) ? (body as { data: unknown }).data : body

const issueStatus = (v: unknown): IssueStatus => (v === 'resolved' || v === 'ignored' ? v : 'unresolved')

export function normalizeIssue(r: unknown): Issue {
  const o = (r ?? {}) as Record<string, unknown>
  return {
    id: str(o.id),
    fingerprint: str(o.fingerprint),
    type: str(o.type),
    value: str(o.value),
    culprit: str(o.culprit),
    level: str(o.level) || 'error',
    platform: str(o.platform),
    status: issueStatus(o.status),
    assignee: str(o.assignee),
    firstSeen: str(o.firstSeen),
    lastSeen: str(o.lastSeen),
    count: num(o.count),
    regressed: o.regressed === true,
    environment: str(o.environment),
    release: str(o.release),
    serviceName: str(o.serviceName),
  }
}

/** Unwrap {status,data:{items}} (or a bare array) → Issue[]. */
export function normalizeIssues(body: unknown): Issue[] {
  const data = unwrapData(body)
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] })?.items)
      ? (data as { items: unknown[] }).items
      : []
  return rows.map(normalizeIssue)
}

function normalizeOccurrence(r: unknown): Occurrence | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const frames = Array.isArray(o.frames) ? o.frames : []
  return {
    eventId: str(o.eventId),
    type: str(o.type),
    value: str(o.value),
    culprit: str(o.culprit),
    level: str(o.level) || 'error',
    platform: str(o.platform),
    timestamp: str(o.timestamp),
    environment: str(o.environment),
    release: str(o.release),
    serviceName: str(o.serviceName),
    traceId: str(o.traceId),
    spanId: str(o.spanId),
    frames: frames.map((f) => {
      const x = (f ?? {}) as Record<string, unknown>
      return { function: str(x.function), module: str(x.module), filename: str(x.filename), lineno: num(x.lineno), inApp: x.inApp === true }
    }),
  }
}

export function normalizeIssueDetail(body: unknown): IssueDetail {
  const data = (unwrapData(body) ?? {}) as Record<string, unknown>
  return {
    issue: data.issue ? normalizeIssue(data.issue) : null,
    latestEvent: normalizeOccurrence(data.latestEvent),
  }
}

// ── Dashboards (O11y) ───────────────────────────────────────────────────────

/** One dashboard from `/v1/o11y/dashboards` (list). */
export type Dashboard = {
  uuid: string
  title: string
  description: string
  tags: string[]
  /** Count of panels/widgets declared in the dashboard data. */
  widgetCount: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

/**
 * Normalize one raw dashboard. O11y nests the display fields under `data`
 * (`{uuid, created_at, data:{title, description, tags, widgets:[…]}}`); we read
 * both the top-level and `data.*` so either shape maps cleanly.
 */
export function normalizeDashboard(r: unknown): Dashboard {
  const o = (r ?? {}) as Record<string, unknown>
  const data = (o.data ?? {}) as Record<string, unknown>
  const tagsRaw = (data.tags ?? o.tags) as unknown
  const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((t): t is string => typeof t === 'string') : []
  const widgets = data.widgets ?? data.layout
  return {
    uuid: str(o.uuid ?? o.id),
    title: str(data.title ?? o.title) || 'Untitled dashboard',
    description: str(data.description ?? o.description),
    tags,
    widgetCount: Array.isArray(widgets) ? widgets.length : 0,
    createdAt: str(o.created_at ?? o.createdAt),
    updatedAt: str(o.updated_at ?? o.updatedAt),
    createdBy: str(o.created_by ?? o.createdBy),
  }
}

/** Normalize the dashboards-list response (`{status, data:[…]}` or a bare array). */
export function normalizeDashboards(body: unknown): Dashboard[] {
  const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown[] })?.data) ? (body as { data: unknown[] }).data : []
  return rows.map(normalizeDashboard).filter((d) => d.uuid !== '')
}

// ── Logs + Traces (O11y v5 query_range) ─────────────────────────────────────
//
// The universal `POST /v1/o11y/query_range` builder query (version-less canonical
// surface). A `raw` request over `signal: logs | traces` returns whole rows — recent
// log lines / spans — which is the one true logs/traces read. Time is epoch
// MILLISECONDS = `ApmWindow.startMs/endMs`. Every helper is pure (JSON in, view-model
// out) so it unit-tests without a live runtime.
//
// The wire dialect is o11y v5 (`github.com/hanzoai/o11y` v1.5.58, `QueryRangeRequest`):
//   { schemaVersion, start, end, requestType, compositeQuery: { queries: [ {type, spec} ] } }
// `compositeQuery` carries EXACTLY ONE field, `queries`. The v3 envelope this file used
// to send — `compositeQuery.{queryType,panelType,builderQueries}`, each query described
// by `dataSource` + `aggregateOperator` — does not exist server-side any more, and the
// server rejects it one field at a time: 400 `unknown field "queryType" in composite
// query`, then `panelType`, then `builderQueries`. Nothing on the deployed server still
// speaks v3, so there is no compatibility shim here either — ONE shape, the current one.

/** The telemetry signal a builder query reads (v5 `signal`; the v3 name was `dataSource`). */
export type O11ySignal = 'logs' | 'traces'

/**
 * Scope a logs/traces query to ONE OpenTelemetry `service.name`.
 *
 * A v5 filter is an EXPRESSION — one string the server parses — not v3's list of
 * `{key, op, value}` items. That also retires a piece of knowledge the client had no
 * business holding: v3 made us declare whether `service.name` was a plain resource
 * attribute (logs) or a materialized indexed column (traces). Which storage the field
 * lives in is the server's business, and now it stays there.
 *
 * The backslash and the single quote are escaped, in that order, so a service name can
 * never break out of the string literal.
 */
export function serviceFilterExpression(service: string): string {
  return `service.name = '${service.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * The `query_range` RAW-rows payload — ONE builder query named `A` over `signal`, paged
 * by `limit`/`offset`. `requestType: 'raw'` is the field that asks for whole rows back
 * (v3 spelled the same intent as the pair `panelType: 'list'` + `aggregateOperator: 'noop'`).
 *
 * A `service` scopes it to one product's OTel service, which adds the canonical `filter`
 * and `order` to the spec. Both are REFUSED by the deployed server today — see the
 * measured note above `ApmApi.logs`. We send them anyway, because they are the correct
 * query and the defect is not here: a client that quietly dropped them would serve an
 * unscoped log stream under a per-product heading and call that success.
 */
export function listQueryPayload(
  signal: O11ySignal,
  w: ApmWindow,
  limit: number,
  service?: string,
): Record<string, unknown> {
  const rows = Math.max(1, Math.min(1000, Math.floor(limit)))
  const spec: Record<string, unknown> = { name: 'A', signal, limit: rows, offset: 0 }
  if (service) {
    spec.filter = { expression: serviceFilterExpression(service) }
    spec.order = [{ key: { name: 'timestamp' }, direction: 'desc' }]
  }
  return {
    schemaVersion: 'v1',
    start: w.startMs,
    end: w.endMs,
    requestType: 'raw',
    compositeQuery: { queries: [{ type: 'builder_query', spec }] },
  }
}

/** One row of a v5 `raw` result: the row's time plus `data`, which holds the row's
 *  columns (`body`, `severity_text`, …) and the nested attribute maps. */
type ListRow = { timestamp?: string | number; data?: Record<string, unknown> | null }

/**
 * Pull the raw rows out of a v5 response, never throwing on shape. The rows live at
 * `data.data.results[].rows[]`:
 *   {"status":"success","data":{"type":"raw","data":{"results":[{"queryName":"A",
 *    "rows":[{"timestamp":…,"data":{…}}]}]}}}
 * (v3 put them at `data.result[].list`, mirrored at `data.newResult.data.result[].list`.
 * Both locations went away with the dialect, so neither is read here.)
 */
export function parseListRows(body: unknown): ListRow[] {
  const results = (body as { data?: { data?: { results?: unknown } } } | null | undefined)?.data?.data?.results
  if (!Array.isArray(results)) return []
  const out: ListRow[] = []
  for (const res of results) {
    const rows = (res as { rows?: unknown } | null)?.rows
    if (Array.isArray(rows)) out.push(...(rows as ListRow[]).filter((x): x is ListRow => x != null))
  }
  return out
}

/**
 * The nested maps a v5 row carries alongside its materialized columns. OpenTelemetry
 * attributes are stored by type and by scope, so `service.name` (a RESOURCE attribute)
 * is at `data.resources_string['service.name']`, an HTTP status at
 * `data.attributes_string['http.response.status_code']`, and so on.
 */
const ROW_ATTRIBUTE_MAPS = ['resources_string', 'attributes_string', 'attributes_number', 'attributes_bool', 'scope_string'] as const

/**
 * Flatten one v5 row's `data` into the single lookup map the normalizers read: the
 * nested attribute maps first, then the top-level columns OVER them — a materialized
 * column is the authoritative value when both carry the same name.
 */
function flatRow(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!data) return {}
  const flat: Record<string, unknown> = {}
  for (const m of ROW_ATTRIBUTE_MAPS) {
    const bag = data[m]
    if (bag && typeof bag === 'object' && !Array.isArray(bag)) Object.assign(flat, bag)
  }
  return Object.assign(flat, data)
}

/** Read the first present key from a flattened O11y row `data` map. */
function pick(data: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!data) return ''
  for (const k of keys) {
    const v = data[k]
    if (v !== undefined && v !== null && v !== '') return str(v)
  }
  return ''
}

/** Normalize the epoch value O11y returns (ns/us/ms/s, or an ISO string) → ISO. */
export function toIso(ts: string | number | undefined | null): string {
  if (ts == null || ts === '') return ''
  if (typeof ts === 'string' && !/^\d+$/.test(ts)) return ts // already ISO
  let ms = typeof ts === 'number' ? ts : Number(ts)
  if (!Number.isFinite(ms)) return ''
  while (ms > 1e14) ms = Math.floor(ms / 1000) // ns/us → ms by magnitude
  if (ms > 0 && ms < 1e11) ms = ms * 1000 // seconds → ms
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** One application/platform log line, projected from a logs list row. */
export type LogRow = { id: string; timestamp: string; severity: string; service: string; body: string }

/** Normalize one logs row → LogRow (tolerant of column-name variants). `service` comes
 *  from the `service.name` RESOURCE attribute, which `flatRow` lifts out of
 *  `resources_string`; a row that carries none leaves it empty rather than guessing. */
export function normalizeLogRow(row: ListRow, idx: number): LogRow {
  const d = flatRow(row.data)
  return {
    id: pick(d, ['id', 'log_id']) || `${str(row.timestamp)}-${idx}`,
    timestamp: toIso(row.timestamp) || toIso(pick(d, ['timestamp'])),
    severity: pick(d, ['severity_text', 'severityText', 'level', 'severity']).toLowerCase(),
    service: pick(d, ['service.name', 'service_name', 'serviceName']),
    body: pick(d, ['body', 'message', 'log', 'msg']),
  }
}

/** Normalize a logs `query_range` response → LogRow[] (newest first). */
export function normalizeLogs(body: unknown): LogRow[] {
  return parseListRows(body).map(normalizeLogRow)
}

/** One trace/span row from a `signal: traces` raw query. */
export type TraceSpan = {
  id: string
  timestamp: string
  traceId: string
  name: string
  service: string
  /** Duration in nanoseconds (O11y unit), or null when absent. */
  durationNano: number | null
  status: string
}

/** Normalize one traces row → TraceSpan. */
export function normalizeTraceSpan(row: ListRow, idx: number): TraceSpan {
  const d = flatRow(row.data)
  const traceId = pick(d, ['traceID', 'traceId', 'trace_id'])
  const spanId = pick(d, ['spanID', 'spanId', 'span_id'])
  const durRaw = d['durationNano'] ?? d['duration_nano'] ?? d['durationNs']
  const durNum = Number(durRaw)
  return {
    id: spanId || traceId || `${str(row.timestamp)}-${idx}`,
    timestamp: toIso(row.timestamp) || toIso(pick(d, ['timestamp'])),
    traceId,
    name: pick(d, ['name', 'operationName', 'operation']),
    service: pick(d, ['serviceName', 'service.name', 'service_name']),
    durationNano: durRaw != null && durRaw !== '' && Number.isFinite(durNum) ? durNum : null,
    status: pick(d, ['statusCode', 'status_code', 'httpCode', 'responseStatusCode']),
  }
}

/** Normalize a traces `query_range` response → TraceSpan[] (newest first). */
export function normalizeSpans(body: unknown): TraceSpan[] {
  return parseListRows(body).map(normalizeTraceSpan)
}

// ── Transport ─────────────────────────────────────────────────────────────────

const u = (path: string): string => cloudProxyV1Url(`o11y/${path}`)

// The composite builder query rides the FLAT public path `/v1/o11y/query_range` (one
// /v1/, no nested /api/vN). `listQueryPayload` + `parseListRows` are a matched v5 pair:
// `compositeQuery.{queries:[{type,spec}]}` out, `data.data.results[].rows[]` back.
//
// This used to say that cloud's clients/o11y flat route (query.go) pinned the path to
// the v3 engine handler server-side, so a v3 body was safe here. That file was DELETED
// from cloud. The version-less path now resolves to the HIGHEST engine version, v5,
// whose composite accepts only `{queries:[…]}` — so the v3 body this client kept sending
// was 400'd on every Logs and Traces load, and the comment was the reason nobody looked.
// The path was never the problem; the dialect was.
const COMPOSITE_QUERY_RANGE = 'query_range'

/** The APM POST body — a start/end window + optional tags filter (O11y shape). */
type ApmBody = { start: string; end: string; tags?: unknown[]; service?: string }
/** The infra POST body — a start/end (ms) window + an (empty) filter set. */
type InfraBody = { start: number; end: number; filters: { op: 'AND'; items: [] } }

const apmBody = (w: ApmWindow, extra?: Partial<ApmBody>): ApmBody => ({ start: w.startNs, end: w.endNs, tags: [], ...extra })
const infraBody = (w: ApmWindow): InfraBody => ({ start: w.startMs, end: w.endMs, filters: { op: 'AND', items: [] } })

export const ApmApi = {
  // ── Service map / APM ──
  services: async (w: ApmWindow): Promise<ServiceRow[]> => normalizeServices(await restPost<unknown>(u('services'), apmBody(w))),
  dependencies: async (w: ApmWindow): Promise<DependencyEdge[]> =>
    normalizeDependencies(await restPost<unknown>(u('dependency_graph'), apmBody(w))),
  topOperations: async (w: ApmWindow, service: string): Promise<TopOperation[]> =>
    normalizeTopOperations(await restPost<unknown>(u('service/top_operations'), apmBody(w, { service }))),

  // ── Infrastructure ──
  hosts: async (w: ApmWindow): Promise<InfraList<HostRow>> => normalizeHosts(await restPost<unknown>(u('hosts/list'), infraBody(w))),
  pods: async (w: ApmWindow): Promise<InfraList<PodRow>> => normalizePods(await restPost<unknown>(u('pods/list'), infraBody(w))),
  nodes: async (w: ApmWindow): Promise<InfraList<NodeRow>> => normalizeNodes(await restPost<unknown>(u('nodes/list'), infraBody(w))),

  // ── Exceptions ──
  exceptions: async (
    w: ApmWindow,
    opts: { limit?: number; order?: 'ascending' | 'descending'; orderParam?: string } = {},
  ): Promise<ExceptionGroup[]> =>
    normalizeExceptions(
      await restPost<unknown>(u('listErrors'), {
        start: w.startNs,
        end: w.endNs,
        limit: opts.limit ?? 100,
        order: opts.order ?? 'descending',
        orderParam: opts.orderParam ?? 'exceptionCount',
      }),
    ),

  // ── Dashboards ──
  dashboards: async (): Promise<Dashboard[]> => normalizeDashboards(await restGet<unknown>(u('dashboards'))),
  dashboard: (uuid: string): Promise<unknown> => restGet<unknown>(u(`dashboards/${encodeURIComponent(uuid)}`)),

  // ── Logs + Traces (composite query_range) ──
  // These POST `/v1/o11y/query_range`, NOT `/v1/o11y/logs` — that route is GET-only and
  // 405s a POST, so an error card blaming it sends the next reader to the wrong door.
  //
  // A `service` scopes the query to ONE product's OTel `service.name` (the per-product
  // Logs sub-page); omit it for the org-wide stream. The rows are re-filtered client-side
  // to the same service, so a runtime that ignored the filter still cannot leak another
  // service's lines onto a per-product page.
  //
  // MEASURED SERVER DEFECT (prod api.hanzo.ai, o11y v1.5.58): the scoped query answers
  // 500 `failed to get logs keys`, and so does anything else carrying `filter`, `order`
  // or `selectFields`. The o11y module resolves field keys against the databases
  // `o11y_metadata` / `o11y_metrics`, and neither EXISTS on the deployed datastore —
  // only `event` does, with the log rows in `event.log`. ClickHouse's own query log
  // confirms it. The unfiltered `raw` query over the same window returns real rows (5M
  // scanned), so the dialect and the transport are fine; the store is missing two
  // databases. It unblocks when those exist, or when the module is pointed at `event`.
  // Nothing here compensates for it: the correct query goes out, and a failure surfaces
  // as an honest error card naming /v1/o11y/query_range.
  logs: async (w: ApmWindow, limit = 200, service?: string): Promise<LogRow[]> => {
    const rows = normalizeLogs(await restPost<unknown>(u(COMPOSITE_QUERY_RANGE), listQueryPayload('logs', w, limit, service)))
    return service ? rows.filter((r) => !r.service || r.service === service) : rows
  },
  traceSearch: async (w: ApmWindow, limit = 200, service?: string): Promise<TraceSpan[]> => {
    const rows = normalizeSpans(await restPost<unknown>(u(COMPOSITE_QUERY_RANGE), listQueryPayload('traces', w, limit, service)))
    return service ? rows.filter((r) => !r.service || r.service === service) : rows
  },

  // ── Per-product service health (RED metrics for ONE product's OTel service) ──
  // Reads the org-scoped services list once and picks the row for the product's service
  // (trying each candidate name). Works for a customer too (o11y scopes by the bearer's
  // org), unlike the admin-only control-plane inventory. `null` → honest "no telemetry".
  serviceHealth: async (w: ApmWindow, ...candidates: (string | null | undefined)[]): Promise<ServiceHealth | null> =>
    serviceHealthOf(pickService(await ApmApi.services(w), candidates)),
}

/** The filter for GET /v1/o11y/errortracking/issues. */
export type IssuesQuery = {
  status?: IssueStatus | ''
  level?: string
  environment?: string
  serviceName?: string
  query?: string
  sort?: 'lastSeen' | 'firstSeen' | 'count'
  limit?: number
  offset?: number
}

/**
 * Error tracking (Issues) — the Errors tab's client. Reads/writes the o11y
 * errortracking module over the SAME version-less, IAM-scoped `/v1/o11y/*` BFF the
 * rest of ApmApi uses; org scope is server-enforced (never a client param).
 */
export const ErrorTrackingApi = {
  listIssues: async (q: IssuesQuery = {}): Promise<Issue[]> => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    const query = qs.toString()
    return normalizeIssues(await restGet<unknown>(u(`errortracking/issues${query ? `?${query}` : ''}`)))
  },
  getIssue: async (id: string): Promise<IssueDetail> =>
    normalizeIssueDetail(await restGet<unknown>(u(`errortracking/issues/${encodeURIComponent(id)}`))),
  updateIssue: async (id: string, patch: { status?: IssueStatus; assignee?: string }): Promise<Issue> =>
    normalizeIssue(unwrapData(await restPost<unknown>(u(`errortracking/issues/${encodeURIComponent(id)}`), patch))),
}
