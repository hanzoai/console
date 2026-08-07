/**
 * Tools API — the unified tool plane (`GET /v1/tools`).
 *
 * ONE flat set of callable names spanning every source the org can reach —
 * connector actions, user functions, zap-service routes, agents, skills, and the
 * org's own external MCP servers — deduplicated by name with source precedence
 * applied server-side. It LISTS; dispatch is `POST /v1/tools/call` and belongs to
 * whatever runs the agent, not to a form.
 *
 * Called SAME-ORIGIN with no prefix (`originV1Url('tools')`), so it rides the
 * console's own user-bearer proxy: a short-lived user-bound IAM token is minted
 * server-side and the cloud plane scopes the listing to the caller's org and
 * project. No credential reaches the browser.
 *
 * An org with nothing activated gets `{"tools":[]}` — a REAL empty answer, not a
 * failure. The agent builder shows that honestly (the field stays typeable) rather
 * than inventing a tool that would 404 on the first invocation.
 */
import { restGet, originV1Url } from './client'

/** Where a tool came from — the plane dedupes across these by name. */
export type ToolSource = 'connector' | 'function' | 'zap-service' | 'agent' | 'skill' | 'mcp'

/** One callable tool as discovery reports it. */
export type Tool = {
  /** The dispatch name — exactly what an agent's `tools` list must carry. */
  name: string
  /** Which plane provides it. */
  source?: ToolSource
  /** One line on what it does, when the provider carries one. */
  description?: string
  /** Whether it is activated for this org+project (an inactive tool lists but won't run). */
  activated: boolean
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

/**
 * Defensive normalizer. The listing is read from whichever envelope key the plane
 * uses, and a row missing `name` is dropped — a nameless tool cannot be dispatched,
 * so surfacing it would offer the user something that cannot work.
 */
export function normalizeTools(payload: unknown): Tool[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).tools ??
         (payload as Record<string, unknown>).data ??
         (payload as Record<string, unknown>).items)
      : undefined
  if (!Array.isArray(rows)) return []
  const out: Tool[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = str(r.name)
    if (!name) continue
    out.push({
      name,
      source: str(r.source) as ToolSource | undefined,
      description: str(r.description),
      activated: r.activated === true,
    })
  }
  return out
}

/** The tool plane's read side. */
export const ToolsApi = {
  /**
   * Every tool the caller's org and project can reach, each flagged `activated`.
   * `activatedOnly` narrows to the callable set — the plane tests the raw query
   * against the literal string "true", so this sends that or nothing at all.
   */
  list: (activatedOnly = false): Promise<Tool[]> =>
    restGet<unknown>(originV1Url(activatedOnly ? 'tools?activated=true' : 'tools')).then(normalizeTools),
}
