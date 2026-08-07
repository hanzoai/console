/**
 * Agents API — Hanzo Agents (autonomous workers: a model + system prompt + tools
 * that run on Hanzo compute and call APIs on their own).
 *
 * The DOCUMENTED contract is `GET /v1/agents` on the unified cloud backend, called
 * SAME-ORIGIN with NO prefix (`originV1Url('agents')` → `<origin>/v1/agents`, the
 * CTO one-endpoint-form). `next.config.mjs` rewrites the `agents` head to the
 * console's OWN user-bearer proxy (`app/v1`), which mints a short-lived
 * user-bound IAM token server-side and forwards it; the cloud backend resolves the
 * org from the token's `owner` claim, so every read is org-scoped server-side and
 * no credential reaches the browser. This is the SAME per-tenant path Prompts +
 * Evals use (allow-listed in `proxy-allow.ts`).
 *
 * Until the `/v1/agents` route is bound the list 404s and callers render an honest
 * "not connected / create your first agent" state (`classifyBackend`) — NEVER a
 * fabricated agent, invocation, or cost. Everything the dashboard shows is either a
 * real returned row or DERIVED from real rows (`deriveAgentStats`, `healthBreakdown`,
 * `topByInvocations`, `deriveActivity`); a metric no row carries reads "—".
 *
 * Plain REST (raw JSON, real HTTP status) like the Functions + provisioning facades
 * — the `restGet/restPost/restDelete` transport, not the casibase envelope. Payloads
 * are normalized DEFENSIVELY: a field rename upstream degrades a cell to "—" rather
 * than throwing, and the list is read from whichever envelope key the backend uses
 * (`agents` / `data` / `items` / `rows`).
 */
import { restGet, restPost, restDelete, originV1Url } from './client'
import type { AgentConfig } from '~/components/agent-builder/types'

/** Inventory facade base path (same-origin `/v1/agents`). */
const BASE = 'agents'
const enc = encodeURIComponent

/**
 * Path for a SINGLE-agent route. The backend keys `GET|PATCH|DELETE /v1/agents/:name`
 * on the agent's org-unique NAME (its URL handle) — NOT the display `id` (`agent_…`).
 * Passing the id 404s ("agent not found"), which is exactly what silently broke the
 * detail-pane activity + the Delete button. Derived from the name in ONE place so the
 * contract can't drift again.
 */
const agentPath = (name: string): string => `${BASE}/${enc(name)}`

// ── Coercion helpers (defensive, functions.ts style) ────────────────────────
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** Pull the first array found under any of the common envelope keys (or the root). */
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

// ── Domain types ────────────────────────────────────────────────────────────

/** The four canonical lifecycle buckets the dashboard groups agents into. */
export type AgentStatus = 'active' | 'idle' | 'error' | 'draft'

/** The tabs across the agents table + the health-donut segments, in display order. */
export const AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'error', 'draft']

/** Display label for a canonical status. */
export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  error: 'Error',
  draft: 'Draft',
}

/**
 * Fold any free-form backend status string into one of the four canonical buckets.
 * Deployed/healthy → active; paused/stopped → idle; failing → error; not-yet-live →
 * draft. An unknown non-empty status is treated as `idle` (it exists but we can't
 * assert it is running); an absent status is `draft`. PURE.
 */
export function canonicalStatus(raw?: string): AgentStatus {
  const s = (raw ?? '').toLowerCase().trim()
  if (!s) return 'draft'
  if (['active', 'running', 'ready', 'online', 'deployed', 'live', 'healthy', 'ok', 'up', 'enabled'].includes(s)) return 'active'
  if (['idle', 'paused', 'stopped', 'sleeping', 'inactive', 'standby', 'disabled', 'suspended'].includes(s)) return 'idle'
  if (['error', 'failed', 'failing', 'crashed', 'unhealthy', 'degraded', 'errored'].includes(s)) return 'error'
  if (['draft', 'created', 'new', 'unpublished', 'pending', 'provisioning', 'building', 'deploying', 'init'].includes(s)) return 'draft'
  return 'idle'
}

/**
 * One agent in the registry. Most fields are optional: the backend may enrich with
 * runtime metrics (invocations / success / latency) a bare definition does not carry,
 * so the UI renders what is present and shows "—" for the rest.
 */
export type Agent = {
  id: string
  name: string
  description?: string
  /** Semver-ish version string as the backend reports it (e.g. `1.4.2`). */
  version?: string
  /** Backing model id, if the agent pins one. */
  model?: string
  /** Canonical lifecycle bucket (folded from the raw status). */
  status: AgentStatus
  /** The original backend status string (for the pill tooltip / honesty). */
  rawStatus?: string
  /** Invocation count over the trailing 30 days (runtime metric). */
  invocations30d?: number
  /** Success ratio 0..1 over the window (runtime metric). */
  successRate?: number
  /** Mean end-to-end latency in milliseconds (runtime metric). */
  avgLatencyMs?: number
  /** Error count over the trailing 30 days (runtime metric). */
  errors30d?: number
  /** Count of tools the agent is wired with (names/count only). */
  tools?: number
  lastInvocationAt?: string
  createdAt?: string
  updatedAt?: string
  // Per-agent resource rollup (optional — summed into the Resource Usage panel).
  cpuVcpuHours?: number
  memGbHours?: number
  storageIoBytes?: number
  costCents?: number
}

/** One line of the invocations-over-time chart (one per agent, or a single total). */
export type AgentSeriesLine = { key: string; points: { t: string; v: number }[] }

/** Resource consumption over the 30-day window (each field degrades to `null`). */
export type AgentResourceUsage = {
  /** Compute — vCPU-hours. */
  cpuVcpuHours: number | null
  /** Memory — GB-hours. */
  memGbHours: number | null
  /** Storage I/O — bytes. */
  storageIoBytes: number | null
  /** Spend over the window — USD cents. */
  costCents: number | null
}

/** Overview metrics that need a time-series source (chart + resource panel). */
export type AgentsMetrics = {
  /** Per-agent invocation series for the area chart. */
  series: AgentSeriesLine[]
  /** Compute/memory/storage/cost rollup for the Resource Usage panel. */
  resource: AgentResourceUsage
}

/** Kinds of events in the Recent Activity feed. */
export type AgentActivityKind = 'invoked' | 'updated' | 'failed' | 'scaled' | 'created' | 'deployed'

/** One event in the Recent Activity feed. */
export type AgentActivity = {
  id: string
  kind: AgentActivityKind
  /** The agent this event is about (name). */
  agent: string
  message?: string
  at?: string
}

/** Full agent detail — the row plus its recent activity. */
export type AgentDetail = Agent & { recentActivity: AgentActivity[] }

/** Time window for the invocations chart + resource rollups. */
export type MetricsRange = '24H' | '7D' | '30D'
export const METRICS_RANGES: MetricsRange[] = ['24H', '7D', '30D']

// ── Normalizers (pure — unit-tested) ────────────────────────────────────────

/** Normalize one registry record to an `Agent` (drops un-named / un-identified rows). */
export function normalizeAgent(raw: unknown): Agent | null {
  const r = asRecord(raw)
  const meta = asRecord(r.metadata)
  const spec = asRecord(r.spec)
  const metricsRec = asRecord(r.metrics ?? r.stats ?? r.runtime)
  const resourceRec = asRecord(r.resources ?? r.resource ?? r.usage)
  const id = str(r.id) ?? str(r.name) ?? str(meta.name) ?? str(r.slug) ?? str(r.agentId)
  const name = str(r.name) ?? str(meta.name) ?? str(r.displayName) ?? id
  if (!id || !name) return null
  const rawStatus = str(r.status) ?? str(asRecord(r.status).phase) ?? str(spec.status) ?? str(r.state)
  const toolsFrom = (v: unknown): number | undefined => {
    if (Array.isArray(v)) return v.length
    if (v && typeof v === 'object') return Object.keys(v as object).length
    return undefined
  }
  return {
    id,
    name,
    description: str(r.description) ?? str(r.summary) ?? str(spec.description) ?? str(meta.description),
    version: str(r.version) ?? str(r.rev) ?? str(spec.version) ?? str(meta.resourceVersion),
    model: str(r.model) ?? str(spec.model) ?? str(asRecord(spec.model).name) ?? str(r.modelName),
    status: canonicalStatus(rawStatus),
    rawStatus,
    invocations30d: num(r.invocations30d) ?? num(r.invocations) ?? num(metricsRec.invocations) ?? num(metricsRec.invocations30d) ?? num(r.runs) ?? num(r.invocationCount),
    successRate: normalizeRate(num(r.successRate) ?? num(r.success_rate) ?? num(metricsRec.successRate) ?? num(metricsRec.success_rate)),
    avgLatencyMs: num(r.avgLatencyMs) ?? num(r.latencyMs) ?? num(metricsRec.avgLatencyMs) ?? num(metricsRec.p50LatencyMs) ?? num(r.avgDurationMs),
    errors30d: num(r.errors30d) ?? num(r.errors) ?? num(metricsRec.errors) ?? num(r.errorCount),
    tools: toolsFrom(r.tools) ?? num(r.toolCount),
    lastInvocationAt: str(r.lastInvocationAt) ?? str(r.lastInvokedAt) ?? str(r.lastRunAt) ?? str(metricsRec.lastInvocationAt),
    createdAt: str(r.createdAt) ?? str(r.createdTime) ?? str(meta.creationTimestamp) ?? str(r.created_at),
    updatedAt: str(r.updatedAt) ?? str(r.updatedTime) ?? str(r.lastDeployedAt) ?? str(r.updated_at),
    cpuVcpuHours: num(resourceRec.cpuVcpuHours) ?? num(resourceRec.cpuHours) ?? num(resourceRec.vcpuHours),
    memGbHours: num(resourceRec.memGbHours) ?? num(resourceRec.memoryGbHours),
    storageIoBytes: num(resourceRec.storageIoBytes) ?? num(resourceRec.storageBytes) ?? num(resourceRec.ioBytes),
    costCents: centsOf(resourceRec) ?? centsOf(r),
  }
}

/** Coerce a rate that may arrive as 0..1 or 0..100 into a 0..1 ratio. */
function normalizeRate(v?: number): number | undefined {
  if (v === undefined) return undefined
  if (v < 0) return 0
  return v > 1 ? Math.min(1, v / 100) : v
}

/** Cents from a record that may report `costCents`/`cost_cents`, or a dollar `cost`. */
function centsOf(r: Record<string, unknown>): number | undefined {
  const c = num(r.costCents) ?? num(r.cost_cents) ?? num(r.cents)
  if (c !== undefined) return Math.round(c)
  const dollars = num(r.cost) ?? num(r.spend)
  return dollars !== undefined ? Math.round(dollars * 100) : undefined
}

/** Normalize an inventory payload to the list of agents. */
export function normalizeAgents(payload: unknown): Agent[] {
  return arrayUnder(payload, ['agents', 'data', 'items', 'rows'])
    .map(normalizeAgent)
    .filter((a): a is Agent => a !== null)
}

/** Normalize an activity payload to the Recent Activity feed. */
export function normalizeActivity(payload: unknown): AgentActivity[] {
  const kinds: AgentActivityKind[] = ['invoked', 'updated', 'failed', 'scaled', 'created', 'deployed']
  return arrayUnder(payload, ['activity', 'events', 'items', 'data', 'rows']).map((raw, i) => {
    const r = asRecord(raw)
    const k = (str(r.kind) ?? str(r.type) ?? str(r.event) ?? 'invoked').toLowerCase()
    const kind = (kinds.includes(k as AgentActivityKind) ? k : 'invoked') as AgentActivityKind
    return {
      id: str(r.id) ?? str(r.eventId) ?? `activity-${i}`,
      kind,
      agent: str(r.agent) ?? str(r.agentName) ?? str(r.name) ?? str(r.subject) ?? '—',
      message: str(r.message) ?? str(r.msg) ?? str(r.description),
      at: str(r.at) ?? str(r.time) ?? str(r.timestamp) ?? str(r.createdAt),
    }
  })
}

/** Normalize a metrics payload (invocation series + resource rollup) — degrades to empty. */
export function normalizeMetrics(payload: unknown): AgentsMetrics {
  const root = asRecord(payload)
  const series: AgentSeriesLine[] = arrayUnder(payload, ['series', 'lines', 'agents']).map((raw, i) => {
    const r = asRecord(raw)
    const points = arrayUnder(r, ['points', 'data', 'values']).map((p) => {
      const pr = asRecord(p)
      return { t: str(pr.t) ?? str(pr.time) ?? str(pr.timestamp) ?? '', v: num(pr.v) ?? num(pr.value) ?? num(pr.count) ?? 0 }
    })
    return { key: str(r.key) ?? str(r.name) ?? str(r.agent) ?? `series-${i}`, points }
  })
  const res = asRecord(root.resource ?? root.resources ?? root.usage)
  const resource: AgentResourceUsage = {
    cpuVcpuHours: num(res.cpuVcpuHours) ?? num(res.cpuHours) ?? num(res.vcpuHours) ?? null,
    memGbHours: num(res.memGbHours) ?? num(res.memoryGbHours) ?? null,
    storageIoBytes: num(res.storageIoBytes) ?? num(res.storageBytes) ?? num(res.ioBytes) ?? null,
    costCents: centsOf(res) ?? null,
  }
  return { series, resource }
}

/** Normalize a detail payload to an `AgentDetail` (row + recent activity). */
export function normalizeAgentDetail(payload: unknown): AgentDetail | null {
  const base = normalizeAgent(payload) ?? normalizeAgent(asRecord(payload).agent)
  if (!base) return null
  return { ...base, recentActivity: normalizeActivity(payload) }
}

// ── Derived rollups + filters (pure — unit-tested) ──────────────────────────

/** The five headline stats + the per-status counts, derived from real rows only. */
export type AgentStats = {
  total: number
  active: number
  idle: number
  error: number
  draft: number
  /** Sum of 30d invocations, or `null` when no row reports it. */
  invocations30d: number | null
  /** Invocation-weighted success ratio 0..1, or `null`. */
  successRate: number | null
  /** Invocation-weighted mean latency ms, or `null`. */
  avgLatencyMs: number | null
  /** Sum of 30d errors (or derived from invocations×(1-success)), or `null`. */
  errors30d: number | null
}

/**
 * Derive the headline stats from the agent rows — REAL aggregates, never fabricated.
 * Rates/latency are invocation-weighted when counts are present, else a simple mean
 * of the present values, else `null`. PURE.
 */
export function deriveAgentStats(agents: Agent[]): AgentStats {
  const h = healthBreakdown(agents)
  const invVals = agents.map((a) => a.invocations30d).filter((v): v is number => v !== undefined)
  const invocations30d = invVals.length ? invVals.reduce((a, b) => a + b, 0) : null

  const weighted = (pick: (a: Agent) => number | undefined): number | null => {
    let wSum = 0
    let vSum = 0
    const plain: number[] = []
    for (const a of agents) {
      const v = pick(a)
      if (v === undefined) continue
      plain.push(v)
      const w = a.invocations30d
      if (w !== undefined && w > 0) {
        wSum += w
        vSum += w * v
      }
    }
    if (wSum > 0) return vSum / wSum
    if (plain.length) return plain.reduce((a, b) => a + b, 0) / plain.length
    return null
  }

  const successRate = weighted((a) => a.successRate)
  const avgLatencyMs = weighted((a) => a.avgLatencyMs)

  const errVals = agents.map((a) => a.errors30d).filter((v): v is number => v !== undefined)
  let errors30d: number | null = errVals.length ? errVals.reduce((a, b) => a + b, 0) : null
  if (errors30d === null && invocations30d !== null && successRate !== null) {
    errors30d = Math.round(invocations30d * (1 - successRate))
  }

  return { total: agents.length, ...h, invocations30d, successRate, avgLatencyMs, errors30d }
}

/** Count of agents in each canonical status bucket (for the health donut). PURE. */
export function healthBreakdown(agents: Agent[]): { active: number; idle: number; error: number; draft: number } {
  const out = { active: 0, idle: 0, error: 0, draft: 0 }
  for (const a of agents) out[a.status] += 1
  return out
}

/** Agents with a real invocation count, sorted desc, top `n` (for the bar list). PURE. */
export function topByInvocations(agents: Agent[], n = 5): Agent[] {
  return agents
    .filter((a) => a.invocations30d !== undefined && a.invocations30d > 0)
    .sort((a, b) => (b.invocations30d ?? 0) - (a.invocations30d ?? 0))
    .slice(0, n)
}

/**
 * A best-effort Recent Activity feed DERIVED from the agents' own timestamps when the
 * backend has no dedicated activity endpoint: each agent's last-invocation → an
 * `invoked` event, its update → an `updated` event, an errored agent → a `failed`
 * event. Only events with a real timestamp are emitted, newest first, capped. PURE
 * (inject `now` for tests). This is REAL data (the agents' own timestamps), never
 * fabricated — an agent with no timestamps contributes nothing.
 */
export function deriveActivity(agents: Agent[], limit = 8): AgentActivity[] {
  const out: AgentActivity[] = []
  for (const a of agents) {
    if (a.lastInvocationAt) {
      out.push({
        id: `${a.id}:invoked`,
        kind: a.status === 'error' ? 'failed' : 'invoked',
        agent: a.name,
        message: a.status === 'error' ? 'Invocation failed' : 'Agent invoked',
        at: a.lastInvocationAt,
      })
    }
    if (a.updatedAt && a.updatedAt !== a.lastInvocationAt) {
      out.push({ id: `${a.id}:updated`, kind: 'updated', agent: a.name, message: `Updated${a.version ? ` to v${a.version.replace(/^v/, '')}` : ''}`, at: a.updatedAt })
    } else if (!a.updatedAt && a.createdAt && !a.lastInvocationAt) {
      out.push({ id: `${a.id}:created`, kind: 'created', agent: a.name, message: 'Agent created', at: a.createdAt })
    }
  }
  return out
    .filter((e) => e.at && !Number.isNaN(new Date(e.at).getTime()))
    .sort((a, b) => new Date(b.at as string).getTime() - new Date(a.at as string).getTime())
    .slice(0, limit)
}

/** Inventory filters — free-text search + canonical status (`'all'` = no filter). */
export type AgentFilter = { search?: string; status?: AgentStatus | 'all' }

/** Apply the search + status filters to the agent rows (pure). */
export function filterAgents(agents: Agent[], f: AgentFilter): Agent[] {
  const q = (f.search ?? '').trim().toLowerCase()
  const st = f.status && f.status !== 'all' ? f.status : undefined
  return agents.filter((a) => {
    if (st && a.status !== st) return false
    if (q) {
      const hay = `${a.name} ${a.description ?? ''} ${a.model ?? ''} ${a.version ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Clamp + slice a page of rows; returns the page rows and the clamped page/total. */
export function paginate<T>(rows: T[], page: number, size: number): { rows: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / size))
  const clamped = Math.min(Math.max(1, page), totalPages)
  const start = (clamped - 1) * size
  return { rows: rows.slice(start, start + size), page: clamped, totalPages }
}

/** Sum a multi-line series into per-bucket totals (aligned by point index). */
export function summedSeries(series: AgentSeriesLine[]): number[] {
  const n = Math.max(0, ...series.map((s) => s.points.length))
  const out = new Array<number>(n).fill(0)
  for (const s of series) s.points.forEach((p, i) => (out[i] += p.v))
  return out
}

/**
 * Trend of a series as the percent change of its second half vs its first half — a
 * REAL delta of real buckets. `null` when there is too little data (so the UI shows
 * no delta rather than a fabricated one). PURE.
 */
export function trendPct(values: number[]): number | null {
  if (values.length < 4) return null
  const mid = Math.floor(values.length / 2)
  const a = values.slice(0, mid).reduce((x, y) => x + y, 0)
  const b = values.slice(mid).reduce((x, y) => x + y, 0)
  if (a === 0) return null
  return ((b - a) / a) * 100
}

// ── Display formatters (pure — unit-tested) ─────────────────────────────────

const EM = '—'

/** Integer with thousands separators; em dash for missing. */
export const fmtInt = (n?: number | null): string =>
  n === undefined || n === null ? EM : Math.round(n).toLocaleString()

/** Compact count (1.23M / 12.4K); em dash for missing. */
export const fmtCompact = (n?: number | null): string => {
  if (n === undefined || n === null) return EM
  if (Math.abs(n) < 1000) return String(Math.round(n))
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
}

/** Ratio 0..1 as a percentage (99.2%); em dash for missing. */
export const fmtPct = (x?: number | null): string =>
  x === undefined || x === null ? EM : `${(x * 100).toFixed(x >= 0.9995 ? 0 : 1)}%`

/** Duration in ms as `142ms` / `1.24s`; em dash for missing. */
export const fmtDuration = (ms?: number | null): string => {
  if (ms === undefined || ms === null) return EM
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** USD from cents (`$1.23`); em dash for missing. */
export const fmtUsd = (cents?: number | null): string =>
  cents === undefined || cents === null ? EM : `$${(cents / 100).toFixed(2)}`

/** Bytes as `1.2 GB` / `340 MB`; em dash for missing. */
export const fmtBytes = (b?: number | null): string => {
  if (b === undefined || b === null) return EM
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let v = b
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** A normalized `vX.Y.Z` version label (adds the `v` prefix); em dash for missing. */
export const fmtVersion = (v?: string | null): string => {
  if (!v) return EM
  return /^v/i.test(v) ? v : `v${v}`
}

/** Absolute locale date-time; em dash for missing/invalid. */
export const fmtAbs = (iso?: string | null): string => {
  if (!iso) return EM
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** Relative "time ago"; `now` injectable for tests. Em dash for missing. */
export const fmtRelative = (iso?: string | null, now: number = Date.now()): string => {
  if (!iso) return EM
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

// ── Network methods (thin — forward-compatible against the documented contract) ─

/**
 * The body accepted by the New-Agent create flow — the canonical agent spec
 * (name · model · description · systemPrompt · tools). Every field but `name` is
 * optional so a bare definition (and the pruned body the shared builder produces)
 * posts cleanly; the backend stores what's present.
 */
export type NewAgentBody = {
  name: string
  model?: string
  description?: string
  systemPrompt?: string
  tools?: string[]
  /** Knowledge sources (vector-store / file ids); omitted when empty. */
  knowledge?: string[]
  /** Advanced generation config — only the knobs changed from default (pruned). */
  config?: Partial<AgentConfig>
}

/**
 * One recorded run of an agent — what `POST /v1/agents/:ref/run` answers with.
 *
 * Every run this carries reflects an execution that ACTUALLY happened: the backend
 * records a model failure as a run with `status: "error"` and its message, and
 * answers 502 with that same run as the body. So a caller reads the run either way,
 * and a failure is a fact about the run rather than a transport error to guess at.
 */
export type AgentRun = {
  id: string
  /** `ok` when the completion came back, `error` when it did not. */
  status: string
  /** The model actually used — a failover run reports the one it fell over to. */
  model: string
  /** The completion, when there was one. */
  output?: string
  /** The failure, when there was one. */
  error?: string
  durationMs?: number
}

/** Normalize a run payload defensively — a renamed field degrades, never throws. */
export function normalizeRun(payload: unknown): AgentRun {
  const r = asRecord(payload)
  return {
    id: str(r.id) ?? '',
    status: str(r.status) ?? '',
    model: str(r.model) ?? '',
    output: str(r.output),
    error: str(r.error),
    durationMs: num(r.durationMs),
  }
}

export const AgentsApi = {
  /** The agent registry (`GET /v1/agents`). Honest-empty/error until bound. */
  list: (): Promise<Agent[]> => restGet<unknown>(originV1Url(BASE)).then(normalizeAgents),

  /** One agent's detail (`GET /v1/agents/:name`) — facts + recent activity. Keyed by
   *  the agent's NAME (its backend handle), never the display `id`. */
  get: (name: string): Promise<AgentDetail | null> =>
    restGet<unknown>(originV1Url(agentPath(name))).then(normalizeAgentDetail),

  /** Invocations-over-time series + resource rollup (`GET /v1/agents/metrics?range=`). */
  metrics: (range: MetricsRange): Promise<AgentsMetrics> =>
    restGet<unknown>(originV1Url(`${BASE}/metrics?range=${range}`)).then(normalizeMetrics),

  /** The org's recent agent activity feed (`GET /v1/agents/activity`). */
  activity: (): Promise<AgentActivity[]> =>
    restGet<unknown>(originV1Url(`${BASE}/activity`)).then(normalizeActivity),

  /** Create an agent (`POST /v1/agents`) — only called when the backend is live. */
  create: (body: NewAgentBody): Promise<unknown> => restPost<unknown>(originV1Url(BASE), body),

  /**
   * Run an agent once (`POST /v1/agents/:ref/run`) and get the recorded run back.
   * `ref` is the agent's name or its `agent_…` id — either resolves the same agent.
   *
   * THIS MOVES MONEY: the backend authorizes the org's balance BEFORE any inference,
   * so an unfunded org gets 402 and no free compute. A model failure answers 502 with
   * the RUN as the body, whose `error` field the transport surfaces as the thrown
   * message — so a caller that shows `e.message` is already showing the run's own
   * reason, not a generic transport failure.
   */
  run: (ref: string, input: string): Promise<AgentRun> =>
    restPost<unknown>(originV1Url(`${agentPath(ref)}/run`), { input }).then(normalizeRun),

  /** Delete an agent (`DELETE /v1/agents/:name`) — keyed by the agent's NAME, never the
   *  display `id`. Only called when the backend is live. */
  remove: (name: string): Promise<void> => restDelete(originV1Url(agentPath(name))),
}
