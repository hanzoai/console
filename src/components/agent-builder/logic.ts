/**
 * Agent-builder pure logic — the decisions the form makes, with no React and no
 * network, so they are unit-tested in isolation (the UI just renders these).
 *
 * The create body is trimmed + pruned here: empty optional fields are dropped so
 * the backend stores clean values, and only a non-empty `name` makes a spec valid.
 * A saved-prompt pick fills the system prompt; the tools list is de-duplicated and
 * blank-stripped. Everything here is a value transform — no side effects.
 */
import type { AgentConfig, AgentCreateBody, AgentSpec, BuilderError, BuilderOption, BuilderPrompt } from './types'

/** A fresh, empty spec (the New-Agent form's initial state). PURE. */
export function emptySpec(): AgentSpec {
  return { name: '', model: '', description: '', systemPrompt: '', tools: [] }
}

/**
 * The default generation config — the value the advanced controls bind to until
 * the user changes something. Kept in ONE place so `pruneConfig` can drop knobs
 * still at their default (a simple agent posts no `config`). PURE.
 */
export function defaultConfig(): AgentConfig {
  return { temperature: 0.7, topP: 1, topK: 0, stream: true, thinking: false, useTools: true, webSearch: false }
}

/** The Zen text model to preselect when the catalog offers it. */
const ZEN_DEFAULT = 'zen5'

/**
 * Pick a sensible default model from a live catalog: the Zen default if present,
 * else another model from the Zen TEXT family, else the first catalog id, else ''
 * (nothing to default to — the field stays empty/typeable). PURE. Never invents an
 * id — only returns one the catalog actually lists.
 *
 * The text-family test is `zen5…`, and that specificity is load-bearing. Zen's naming
 * splits cleanly: `zen5`, `zen5-mini`, `zen5-flash`, `zen5-coder`, `zen5-pro` are the
 * text models, while `zen-<noun>` names a MODALITY — zen-embedding, zen-image,
 * zen-video, zen-rerank, zen-voice, zen-vl. A looser `^zen[-.]` test matched both, and
 * since a catalog arrives sorted it selected `zen-embedding`: every agent created
 * without touching the model field was pointed at an embeddings SKU that cannot hold a
 * conversation. (It went unnoticed because the exact-match arm named `zen-omni`, which
 * the live catalog does not carry, so the fallback was always the arm that ran.)
 */
export function defaultModel(options: BuilderOption[]): string {
  if (options.length === 0) return ''
  const exact = options.find((o) => o.value === ZEN_DEFAULT)
  if (exact) return exact.value
  const zenText = options.find((o) => /^zen\d/i.test(o.value))
  return (zenText ?? options[0]).value
}

/** True iff the spec can be submitted (a non-empty trimmed name is the only requirement). */
export function canSubmit(spec: AgentSpec): boolean {
  return spec.name.trim().length > 0
}

/** De-duplicate + blank-strip a string list, preserving first-seen order. PURE. */
export function normalizeList(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const t = raw.trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

/** De-duplicate + blank-strip a tool list, preserving first-seen order. PURE. */
export function normalizeTools(tools: string[]): string[] {
  return normalizeList(tools)
}

/** De-duplicate + blank-strip a knowledge-source list. PURE. */
export function normalizeKnowledge(sources: string[]): string[] {
  return normalizeList(sources)
}

/**
 * Clamp a number into [min,max]. NaN (garbage) → min; ±∞ clamp to the nearest
 * bound naturally (dragging a slider to the top lands on max, not min). PURE.
 */
function clampNum(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.min(max, Math.max(min, v))
}

/**
 * Clamp a config into valid ranges (temperature 0–2, topP 0–1, topK a
 * non-negative integer) so a bad slider/typed value can never post an
 * out-of-range generation param. PURE.
 */
export function clampConfig(c: AgentConfig): AgentConfig {
  return {
    ...c,
    temperature: clampNum(c.temperature, 0, 2),
    topP: clampNum(c.topP, 0, 1),
    topK: Math.max(0, Math.floor(Number.isFinite(c.topK) ? c.topK : 0)),
  }
}

/**
 * Reduce a config to only the knobs that DIFFER from the default — so a simple
 * agent (all defaults) yields `undefined` (no `config` key posted) while a
 * power-user agent posts exactly what they changed. Clamps first. PURE.
 */
export function pruneConfig(c: AgentConfig): Partial<AgentConfig> | undefined {
  const def = defaultConfig()
  const cur = clampConfig(c)
  const out: Partial<AgentConfig> = {}
  ;(Object.keys(def) as (keyof AgentConfig)[]).forEach((k) => {
    if (cur[k] !== def[k]) (out as Record<string, unknown>)[k] = cur[k]
  })
  if (cur.reasoningEffort) out.reasoningEffort = cur.reasoningEffort
  return Object.keys(out).length ? out : undefined
}

/**
 * The clean create body for `POST /v1/agents`: name is trimmed (required);
 * every other field is trimmed and OMITTED when empty, and tools are normalized —
 * so the backend never stores a blank model/description/prompt or a `[]` tools
 * key it didn't need. PURE.
 */
export function toCreateBody(spec: AgentSpec): AgentCreateBody {
  const name = spec.name.trim()
  const model = spec.model.trim()
  const description = spec.description.trim()
  const systemPrompt = spec.systemPrompt.trim()
  const tools = normalizeTools(spec.tools)
  const knowledge = normalizeKnowledge(spec.knowledge ?? [])
  const config = spec.config ? pruneConfig(spec.config) : undefined
  return {
    name,
    ...(model ? { model } : {}),
    ...(description ? { description } : {}),
    ...(systemPrompt ? { systemPrompt } : {}),
    ...(tools.length ? { tools } : {}),
    ...(knowledge.length ? { knowledge } : {}),
    ...(config ? { config } : {}),
  }
}

/**
 * Resolve the body a saved-prompt pick should put into `systemPrompt`: the row's
 * own `body` when present, else null (the caller must `loadPromptBody(name)`).
 * PURE — no fetch here.
 */
export function promptBodyFromRow(prompts: BuilderPrompt[], name: string): string | null {
  const row = prompts.find((p) => p.name === name)
  return row?.body != null ? row.body : null
}

/** Map saved prompts to picker rows (label = name, hint = any provided hint). PURE. */
export function promptOptions(prompts: BuilderPrompt[]): BuilderOption[] {
  return prompts.map((p) => ({ value: p.name, label: p.label ?? p.name, hint: p.hint }))
}

// ── Drafting an agent from a sentence ───────────────────────────────────────
//
// The quickstart lets someone describe an agent in their own words. That is a
// model call, so the EFFECT is an injected loader (`draftAgent`) like every other;
// what lives here is the pure half — the instruction we send, and the parse of what
// comes back. Both are pure so the fragile part (reading a model's JSON) is tested
// against real malformed answers rather than trusted.

/**
 * The instruction that turns a description into a spec. It asks for the three
 * fields a person would otherwise type and NOTHING else — deliberately not `model`
 * or `tools`: a model id must exist in the org's live catalog and a tool must exist
 * in its tool plane, and a model asked to name one will happily invent it. Those two
 * fields stay with the pickers that know the real answers. PURE.
 */
export function draftInstruction(): string {
  return [
    'You turn a description of an agent into its definition.',
    '',
    'Reply with ONE JSON object and nothing else — no prose, no code fence. Keys:',
    '  "name"         a short lowercase handle, words joined by hyphens (e.g. support-triage)',
    '  "description"  one sentence on what the agent does',
    '  "systemPrompt" the agent\'s own instructions, written in the second person',
    '',
    'The system prompt is the real work: state what the agent does, what it must not do,',
    'and how it should behave when it is unsure. Write it as instructions to the agent,',
    'not as a description of it.',
  ].join('\n')
}

/** Stop-words that carry no meaning in a handle. */
const NOISE = new Set(['a', 'an', 'the', 'that', 'this', 'my', 'our', 'for', 'to', 'of', 'and', 'is', 'it', 'agent'])

/**
 * Put any string into handle FORM: lowercase, letters and digits kept, everything
 * else a hyphen, no repeated or trailing hyphens, capped. It reshapes and never
 * re-words — `support-agent` stays `support-agent`. PURE.
 */
export function toHandle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '')
}

/**
 * A handle proposed from PROSE — the user's own sentence — so the form is never left
 * with an empty required field even when the draft call fails. Drops the words that
 * carry no meaning in a handle, keeps the first three that do, and puts the result in
 * handle form. Returns '' when the text carries nothing usable.
 *
 * Distinct from `toHandle` on purpose, and the two must not be confused: this one
 * REWORDS, which is right for a sentence and wrong for a handle. Running it over an
 * already-formed handle silently renames it — `support-agent` would come back as
 * `support`, because "agent" is noise in a sentence and load-bearing in a name. PURE.
 */
export function proposeName(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
  return toHandle(words.slice(0, 3).join('-'))
}

/**
 * Read a drafted spec out of a model's answer. Tolerant of the two things models
 * actually do — wrapping the object in a ```json fence, and adding a sentence before
 * or after it — by taking the outermost braces. Every field is validated and
 * anything unrecognized is DROPPED, so a creative answer can only ever produce less
 * than asked, never a field the builder does not understand. Returns null when there
 * is no object at all. PURE.
 */
export function parseDraft(answer: string): Partial<AgentSpec> | null {
  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let raw: unknown
  try {
    raw = JSON.parse(answer.slice(start, end + 1))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

  const out: Partial<AgentSpec> = {}
  const name = text(r.name)
  // A handle the backend would refuse is worse than none, so reshape it — but with
  // `toHandle`, which only changes the FORM. `proposeName` would also re-word it, and
  // the model was asked for a handle, not a sentence.
  if (name) {
    const handle = toHandle(name)
    if (handle) out.name = handle
  }
  const description = text(r.description)
  if (description) out.description = description
  const systemPrompt = text(r.systemPrompt) ?? text(r.system_prompt) ?? text(r.prompt)
  if (systemPrompt) out.systemPrompt = systemPrompt
  return Object.keys(out).length ? out : null
}

/**
 * Classify a create failure. A 404 (or an explicit "unavailable" BackendState kind)
 * means the `/v1/agents` route isn't bound on this deployment — an honest "not
 * connected, use the CLI" state, NOT a scary error. Anything else is a real error
 * whose message is surfaced. PURE (reads status/kind/message off the error object).
 */
export function classifyBuilderError(e: unknown): BuilderError {
  const status = statusOf(e)
  const kind = kindOf(e)
  if (status === 404 || status === 501 || kind === 'unavailable') {
    return { kind: 'unavailable', message: 'The agents API is not connected on this deployment yet.' }
  }
  return { kind: 'error', message: messageOf(e) }
}

// ── error-shape readers (defensive; the builder is client-agnostic) ──────────

function statusOf(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}

function kindOf(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'kind' in e) {
    const k = (e as { kind?: unknown }).kind
    if (typeof k === 'string') return k
  }
  return undefined
}

function messageOf(e: unknown): string {
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return 'Could not create the agent.'
}
