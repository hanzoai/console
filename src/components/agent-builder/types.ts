/**
 * Canonical agent-builder contract — the ONE way to describe and build a Hanzo
 * agent, shared across every surface (console, chat, app, bot, team).
 *
 * This file has NO console2 coupling on purpose: it imports nothing from `~/lib`
 * or any host app. The builder takes its data + effects as INJECTED async
 * loaders (`AgentBuilderLoaders`) — the model catalog, the saved-prompt library,
 * a prompt body, and the create effect — so a surface wires it to whatever client
 * it already has, as long as that client speaks the ONE agent backend
 * (`POST /v1/agents`, org resolved server-side from the caller's bearer).
 * That is what makes the builder truly shareable (extractable to
 * `@hanzo/agent-builder`) rather than a console2 one-off.
 */

/**
 * Reasoning budget for models that expose one (maps to `reasoning_effort`). The
 * canonical Hanzo/Claude effort ladder, faster→smarter:
 *
 *   low · medium · high · xhigh · max · ultracode
 *
 * `ultracode` is the top tier — "xhigh + workflows" — and may use excessive tokens
 * (long responses / overthinking); use it sparingly for the hardest tasks. The
 * gateway maps each level onto the target model's native effort/thinking budget.
 * (Supersedes the old 3-level low/medium/high.)
 */
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultracode'

/**
 * The agent's generation config — the advanced knobs the hanzo.chat builder
 * exposes, folded into the canonical contract so ONE builder covers both the
 * simple (name·model·prompt·tools) and the power-user surface. Every field has a
 * sane default (`defaultConfig`); `toCreateBody` prunes anything left at default,
 * so a simple agent still posts a clean `{name,…}` with no `config` key.
 *
 * Field names mirror the cloud `/v1/agents` body (camelCase, like `systemPrompt`);
 * they correspond 1:1 to hanzo.chat's `temperature/top_p/top_k/stream/thinking/
 * use_tools/web_search_enabled/reasoning_effort`.
 */
export type AgentConfig = {
  /** Sampling temperature, 0–2 (clamped). Higher = more random. */
  temperature: number
  /** Nucleus sampling, 0–1 (clamped). */
  topP: number
  /** Top-k sampling; 0 = disabled. Non-negative integer (clamped). */
  topK: number
  /** Stream tokens as they generate. */
  stream: boolean
  /** Expose the model's thinking/reasoning trace. */
  thinking: boolean
  /** Let the agent call its tools during a turn. */
  useTools: boolean
  /** Enable the built-in web-search tool. */
  webSearch: boolean
  /** Reasoning budget, when the model supports it (omitted = model default). */
  reasoningEffort?: ReasoningEffort
}

/** The editable shape of an agent under construction (the form's state). */
export type AgentSpec = {
  /** Org-unique handle (also the URL segment). Required. */
  name: string
  /** Backing model id (a live catalog id or a custom one). */
  model: string
  /** One-line description of what the agent does. */
  description: string
  /** The system prompt — typed free-form OR loaded from a saved prompt. */
  systemPrompt: string
  /** Tool ids the agent may call (live catalog and/or custom). */
  tools: string[]
  /**
   * Knowledge sources (vector-store / file ids) the agent retrieves from.
   * Optional — absent until the user adds one; normalized + omitted when empty.
   */
  knowledge?: string[]
  /**
   * Advanced generation config. Optional — the builder binds it lazily
   * (`spec.config ?? defaultConfig()`), and `toCreateBody` includes only the
   * non-default knobs, so a simple agent never carries a `config` key.
   */
  config?: AgentConfig
}

/** One option in a live picker (model / prompt / tool). Mirrors the ComboBox option. */
export type BuilderOption = {
  /** The value committed to the spec when chosen. */
  value: string
  /** Display label (defaults to `value`). */
  label?: string
  /** Optional secondary text (provider, description) — shown + searched. */
  hint?: string
}

/**
 * A saved prompt as the builder needs it: a name to pick by, and — when the list
 * carries it — the body to fill the system prompt. When `body` is absent the
 * builder fetches it lazily via `loadPromptBody(name)`.
 */
export type BuilderPrompt = {
  name: string
  /** The prompt body, if the list row already carries it (else fetched on select). */
  body?: string
  /** Optional label (defaults to name) + hint (labels/type). */
  label?: string
  hint?: string
}

/**
 * The pruned wire body the builder emits for a create — `toCreateBody(spec)`. Every
 * field but `name` is optional and OMITTED when empty/default, so a simple agent
 * posts a clean `{name,…}` and a power-user agent posts exactly the knobs they set.
 * This is what the injected `createAgent` effect receives (NOT the raw form spec) —
 * so a host serializes nothing itself; the shared pure logic already did.
 */
export type AgentCreateBody = {
  name: string
  model?: string
  description?: string
  systemPrompt?: string
  tools?: string[]
  knowledge?: string[]
  config?: Partial<AgentConfig>
}

/**
 * The effects + data the builder needs, injected by the host surface. Every loader
 * is async and may reject; the builder renders honest loading/error states and
 * NEVER fabricates an option. All are optional except `createAgent`:
 *   - no `loadModels`  → the model field is a plain typeable input (still works).
 *   - no `loadPrompts` → the prompt selector is hidden (system prompt stays free-text).
 *   - no `loadTools`   → the tools field is typeable-only (no live options).
 */
export type AgentBuilderLoaders = {
  /** The live model catalog (ids the gateway accepts). Rejects → typeable fallback. */
  loadModels?: () => Promise<BuilderOption[]>
  /** The org's saved prompts (names + optional bodies). Rejects → selector hidden. */
  loadPrompts?: () => Promise<BuilderPrompt[]>
  /** Fetch ONE saved prompt's body by name (used when the list row lacks it). */
  loadPromptBody?: (name: string) => Promise<string>
  /** The live tool catalog. Rejects → typeable-only tools. */
  loadTools?: () => Promise<BuilderOption[]>
  /**
   * Draft a spec from a plain-English description — the quickstart's "describe your
   * agent" box. A model call, so it is an effect like the rest; the instruction and
   * the parse of the answer are pure (`draftInstruction`, `parseDraft`) and shared.
   * Absent → the quickstart still works: the description seeds the handle and the
   * description field, and the user writes the prompt. Rejects → the same fallback,
   * with the reason shown, so a drafting failure never blocks building an agent.
   */
  draftAgent?: (description: string) => Promise<Partial<AgentSpec>>
  /**
   * Run the agent once (`POST /v1/agents/:ref/run`) and return the RECORDED run.
   * The quickstart's third step — proving the thing that was just created actually
   * answers, which is the only step that can prove it. Absent → the step says so and
   * points at the endpoint instead of pretending. THIS SPENDS: the backend authorizes
   * the org's balance before any inference, so an unfunded org is refused rather than
   * given free compute.
   */
  runAgent?: (name: string, input: string) => Promise<AgentRunResult>
  /**
   * Create the agent from the pruned body (`toCreateBody(spec)`). This is the ONE
   * mutation — it MUST target the unified agent backend (`POST /v1/agents`), which
   * resolves the org from the caller's bearer server-side. Rejects with the backend
   * error (the builder classifies 404 as "not connected" honestly).
   */
  createAgent: (body: AgentCreateBody) => Promise<unknown>
}

/**
 * One recorded run, as the quickstart needs it. Deliberately the small half of the
 * backend's run view: what happened, which model did it, and what came out. A
 * `status` other than `ok` is a run that REALLY failed — the backend records the
 * failure as a run rather than hiding it — so `error` is a fact about the execution,
 * not a transport problem to guess at.
 */
export type AgentRunResult = {
  status: string
  model?: string
  output?: string
  error?: string
  durationMs?: number
}

/** The reason a create failed, distinguished so the UI reacts correctly. */
export type BuilderErrorKind =
  /** The `/v1/agents` route isn't bound on this deployment yet (404). */
  | 'unavailable'
  /** A real error (validation, auth, upstream) — show the message. */
  | 'error'

/** A classified builder error: a kind plus a human message. */
export type BuilderError = { kind: BuilderErrorKind; message: string }
