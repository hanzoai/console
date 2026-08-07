/**
 * Guide API — the Business AI Guide (cloud `clients/guide`, `/v1/guide/*`): an
 * interactive launch checklist every org completes on-site. A machine-readable
 * curriculum drives the steps (id · title · why · how-on-hanzo · done · deps ·
 * signal · tool); per-org progress tracks a state per step; auto-detect completes a
 * step from real org state; and the Business AI executes a step for you through the
 * per-principal MCP plane.
 *
 * Same-origin, keyless, prefix-free (`originV1Url('guide/...')` → `<origin>/v1/guide/...`
 * — NOTHING before `/v1/`, the CTO one-endpoint form). The standalone console's own
 * `app/v1` user-bearer BFF serves the `guide` head (mints a short-lived user token,
 * org resolved SERVER-SIDE from the token owner claim; a cookie-only call 403s); the
 * go:embed console calls cloud's `/v1/guide` directly under the session cookie. Both
 * work off the same client URL. `guide` is allow-listed in `proxy-allow.ts` CLOUD_HEADS.
 *
 * Routes (from cloud `clients/guide/guide.go`):
 *   GET                 /v1/guide                     overview (curriculum + progress + steps)
 *   GET/PUT/DELETE      /v1/guide/curriculum          get / replace (org-custom) / revert to default
 *   POST                /v1/guide/steps/:id/start     mark in_progress
 *   POST                /v1/guide/steps/:id/done       mark done
 *   POST                /v1/guide/steps/:id/skip       skip
 *   POST                /v1/guide/steps/:id/reset      back to todo
 *   POST                /v1/guide/steps/:id/do         "do it for me" (JSON or SSE stream)
 *   GET                 /v1/guide/actions              the Business AI action ledger
 *
 * Bare JSON (real HTTP status). Payloads are normalized DEFENSIVELY, so a field
 * rename upstream degrades a cell rather than throwing. Pure normalizers are
 * unit-tested (guide.test.ts).
 */
import { restGet, restPost, restDelete, restPut, restStream, originV1Url } from './client'

const BASE = 'guide'

// ── Coercion helpers (defensive; crm.ts style) ──────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return 0
}
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s) => s.length > 0) : []
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

// ── Domain types (mirror cloud clients/guide JSON tags) ─────────────────────

/** A step's per-org lifecycle state. */
export type StepState = 'todo' | 'in_progress' | 'done' | 'skipped'

/** One checklist step + its per-org progress (the overview `stepView`). */
export type GuideStep = {
  id: string
  title: string
  why: string
  how: string
  done: string
  dependencies: string[]
  signal: string
  tool: string
  /** whether the Business AI can run this step (`tool` is bound). */
  automatable: boolean
  state: StepState
  /** manual | agent | auto (how the state was last set). */
  source: string
  /** every dependency satisfied (done/skipped). */
  available: boolean
  /** the dependencies still blocking this step. */
  blockedBy: string[]
}

export type GuideProgress = {
  done: number
  total: number
  percent: number
  /** the step id the org should tackle next ('' when nothing is actionable). */
  next: string
}

export type GuideOverview = {
  version: string
  title: string
  /** an org-custom curriculum is active (vs the built-in default). */
  custom: boolean
  progress: GuideProgress
  steps: GuideStep[]
}

/** One Business AI action-ledger row. */
export type GuideAction = {
  id: string
  stepId: string
  tool: string
  args: string
  result: string
  ok: boolean
  err: string
  createdAt: number
}

/** One streamed step the Business AI takes (SSE frame, or JSON `events[]`). */
export type GuideEvent = {
  type: 'plan' | 'draft' | 'action' | 'result' | 'state' | 'error' | 'end' | (string & {})
  step?: string
  tool?: string
  text?: string
  args?: Record<string, unknown>
  result?: unknown
  state?: StepState
  error?: string
}

/** The org's top-of-funnel (guide gtm.go Funnel) — the analytics lens suggest/chat ground on. */
export type GuideFunnel = {
  available: boolean
  windowDays: number
  pageviews: number
  visitors: number
  signups: number
  orders: number
  revenue: number
}

/** One dynamically-ranked next-best quest (guide suggest.go). */
export type GuideSuggestion = {
  stepId: string
  title: string
  why: string
  /** the grounded reason this is a good next move (leverage + AI-ready). */
  rationale: string
  /** whether the Business AI can run this quest. */
  automatable: boolean
  /** how many downstream quests completing this immediately unblocks. */
  unlocks: number
}

/** GET /v1/guide/suggest — the dynamic next-best quests + a grounded AI narrative. */
export type GuideSuggest = {
  /** the single best next step id ('' when the journey is complete). */
  next: string
  suggestions: GuideSuggestion[]
  /** the Business AI's "what to do next" prose (best-effort; '' when the AI plane is down). */
  narrative: string
  funnel: GuideFunnel
  /** the funnel-derived GTM recommendations (always present). */
  recommendations: string[]
}

/** POST /v1/guide/chat — the Business AI's grounded reply + the current candidate quests. */
export type GuideChat = {
  reply: string
  suggestions: GuideSuggestion[]
  funnel: GuideFunnel
}

// ── Normalizers ─────────────────────────────────────────────────────────────

const STATES: StepState[] = ['todo', 'in_progress', 'done', 'skipped']
const asState = (v: unknown): StepState => {
  const s = str(v)
  return (STATES as string[]).includes(s) ? (s as StepState) : 'todo'
}

function normalizeStep(raw: unknown): GuideStep {
  const r = asRecord(raw)
  return {
    id: str(r.id),
    title: str(r.title),
    why: str(r.why),
    how: str(r.how),
    done: str(r.done),
    dependencies: strArray(r.dependencies),
    signal: str(r.signal),
    tool: str(r.tool),
    automatable: bool(r.automatable),
    state: asState(r.state),
    source: str(r.source),
    available: bool(r.available),
    blockedBy: strArray(r.blockedBy),
  }
}

function normalizeProgress(raw: unknown): GuideProgress {
  const r = asRecord(raw)
  return { done: num(r.done), total: num(r.total), percent: num(r.percent), next: str(r.next) }
}

export function normalizeOverview(raw: unknown): GuideOverview {
  const r = asRecord(raw)
  return {
    version: str(r.version),
    title: str(r.title),
    custom: bool(r.custom),
    progress: normalizeProgress(r.progress),
    steps: arrayUnder(r.steps, ['steps', 'data']).map(normalizeStep),
  }
}

function normalizeAction(raw: unknown): GuideAction {
  const r = asRecord(raw)
  return {
    id: str(r.id),
    stepId: str(r.stepId),
    tool: str(r.tool),
    args: str(r.args),
    result: str(r.result),
    ok: bool(r.ok),
    err: str(r.err),
    createdAt: num(r.createdAt),
  }
}

function normalizeFunnel(raw: unknown): GuideFunnel {
  const r = asRecord(raw)
  return {
    available: bool(r.available),
    windowDays: num(r.windowDays),
    pageviews: num(r.pageviews),
    visitors: num(r.visitors),
    signups: num(r.signups),
    orders: num(r.orders),
    revenue: num(r.revenue),
  }
}

function normalizeSuggestion(raw: unknown): GuideSuggestion {
  const r = asRecord(raw)
  return {
    stepId: str(r.stepId),
    title: str(r.title),
    why: str(r.why),
    rationale: str(r.rationale),
    automatable: bool(r.automatable),
    unlocks: num(r.unlocks),
  }
}

export function normalizeSuggest(raw: unknown): GuideSuggest {
  const r = asRecord(raw)
  return {
    next: str(r.next),
    suggestions: arrayUnder(r.suggestions, ['suggestions', 'data']).map(normalizeSuggestion),
    narrative: str(r.narrative),
    funnel: normalizeFunnel(r.funnel),
    recommendations: strArray(r.recommendations),
  }
}

export function normalizeChat(raw: unknown): GuideChat {
  const r = asRecord(raw)
  return {
    reply: str(r.reply),
    suggestions: arrayUnder(r.suggestions, ['suggestions', 'data']).map(normalizeSuggestion),
    funnel: normalizeFunnel(r.funnel),
  }
}

// ── Client ──────────────────────────────────────────────────────────────────

export const GuideApi = {
  overview: async (): Promise<GuideOverview> => normalizeOverview(await restGet(originV1Url(BASE))),

  start: async (id: string): Promise<GuideOverview> =>
    normalizeOverview(await restPost(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/start`))),
  markDone: async (id: string): Promise<GuideOverview> =>
    normalizeOverview(await restPost(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/done`))),
  skip: async (id: string): Promise<GuideOverview> =>
    normalizeOverview(await restPost(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/skip`))),
  reset: async (id: string): Promise<GuideOverview> =>
    normalizeOverview(await restPost(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/reset`))),

  actions: async (): Promise<GuideAction[]> => {
    const res = await restGet(originV1Url(`${BASE}/actions`))
    return arrayUnder(res, ['data', 'items', 'rows']).map(normalizeAction)
  },

  /**
   * The Business AI's DYNAMIC next-best quests, grounded in the org's real progress
   * + analytics funnel (guide `suggest.go`). Read-only — surfacing a quest never runs
   * it (the UI calls `do`/`streamDo` for that).
   */
  suggest: async (): Promise<GuideSuggest> => normalizeSuggest(await restGet(originV1Url(`${BASE}/suggest`))),

  /**
   * Ask the Business AI about the launch journey. Returns a grounded reply + the
   * current candidate quests (so the UI can offer "Do it for me" on the AI-ready
   * ones). Chat NEVER executes a step — the ONLY action path is `do`/`streamDo`,
   * which is dependency-gated, audited, and metered server-side.
   */
  chat: async (message: string): Promise<GuideChat> =>
    normalizeChat(await restPost(originV1Url(`${BASE}/chat`), { message })),

  /**
   * Replace the org's curriculum with a custom one. Takes a PARSED object (the
   * transport JSON-encodes it once); the cloud Parse accepts JSON, so a plain
   * object round-trips correctly. Passing a pre-serialized string would
   * double-encode into a quoted blob the backend can't parse.
   */
  putCurriculum: async (doc: unknown): Promise<GuideOverview> => {
    const res = await restPut<{ curriculum?: unknown }>(originV1Url(`${BASE}/curriculum`), doc)
    return normalizeOverview(asRecord(res).curriculum)
  },
  /** Revert to the built-in default curriculum. */
  resetCurriculum: async (): Promise<void> => restDelete(originV1Url(`${BASE}/curriculum`)),

  /**
   * "Do it for me" without streaming — runs the Business AI on a step and returns
   * the full action log. Use `streamDo` for a live event stream.
   */
  do: async (id: string): Promise<{ state: StepState; events: GuideEvent[] }> => {
    const res = asRecord(await restPost(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/do`)))
    const events = Array.isArray(res.events) ? (res.events as GuideEvent[]) : []
    return { state: asState(res.state), events }
  },
}

/**
 * streamDo runs the Business AI on a step and streams each action as it happens
 * (SSE: plan → draft → action → result → state → end). It POSTs with
 * `Accept: text/event-stream` through `restStream` and reads `res.body` with a small
 * SSE splitter — the same transport as the chat stream, and the same reason it is not
 * EventSource, which can neither POST nor carry a credential. onEvent fires per frame;
 * it resolves when the stream ends. A backend that answers plain JSON (no stream) is
 * handled by the caller falling back to `GuideApi.do`.
 */
export async function streamDo(
  id: string,
  onEvent: (e: GuideEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await restStream(originV1Url(`${BASE}/steps/${encodeURIComponent(id)}/do`), undefined, {
    headers: { Accept: 'text/event-stream' },
    signal,
  })
  if (!res.ok || !res.body) {
    throw Object.assign(new Error(`guide do failed: ${res.status}`), { status: res.status })
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const flush = (chunk: string) => {
    buf += chunk
    const parts = buf.split(/\r?\n\r?\n/)
    buf = parts.pop() ?? ''
    for (const frame of parts) {
      if (!frame.trim() || frame.startsWith(':')) continue // comment/keepalive
      const data = dataLine(frame)
      if (!data) continue
      const ev = parseEvent(data)
      if (ev) onEvent(ev)
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    flush(decoder.decode(value, { stream: true }))
  }
  flush(decoder.decode())
  const tail = dataLine(buf)
  if (tail) {
    const ev = parseEvent(tail)
    if (ev) onEvent(ev)
  }
}

/** Join the `data:` lines of one SSE frame into its payload (null if none). */
function dataLine(frame: string): string | null {
  const data = frame
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).replace(/^ /, ''))
    .join('\n')
  return data.length > 0 ? data : null
}

function parseEvent(data: string): GuideEvent | null {
  try {
    const o = JSON.parse(data)
    if (o && typeof o === 'object') return o as GuideEvent
  } catch {
    /* skip a malformed frame, keep the stream alive */
  }
  return null
}
