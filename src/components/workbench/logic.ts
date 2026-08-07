/**
 * Workbench logic — the PURE half of the bottom Developers dock: where the cloud
 * shell's socket lives and what goes over it, how a response renders, and how an
 * id routes to the `/v1` read that explains it. No React/Gui/registry imports, so
 * every decision here is node-testable on its own.
 */

/** Pretty-print a shell response, bounded so a huge payload never wedges the DOM. */
export function renderOutput(value: unknown, maxChars = 20000): string {
  let text: string
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    text = String(value)
  }
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n… (${text.length - maxChars} more characters truncated)`
}

// ── Inspector — route an object id to its `/v1` GET ───────────────────────────

/** Path charset — segments and a query string; nothing that can smuggle a scheme/host. */
const PATH_OK = /^[A-Za-z0-9\-_./?=&%,:+]+$/

/** A resolved inspect target (a same-origin `/v1` GET) or an honest parse error. */
export type InspectTarget = { path: string; kind: string; label: string } | { error: string }

/** The `sk-` (secret) and `pk-` (publishable) credential prefixes — there is no
 *  GET-by-value, so they resolve to the account's key STATUS (never the secret). */
const KEY_PREFIXES = ['sk-', 'pk-']

/**
 * id-prefix → the `/v1` resource that owns it. The prefixes mirror the object ids
 * the platform mints (`agent_…`, `fn_…`, `flow_…`, `run_…`, `prompt_…`, `trace_…`);
 * each maps to the READ endpoint the console already speaks (agents/functions/
 * automations/prompts/o11y). One table, extended by adding a row — never a per-call
 * special case.
 */
const ID_ROUTES: { prefixes: string[]; kind: string; label: string; path: (id: string) => string }[] = [
  { prefixes: ['agent_', 'agt_'], kind: 'agent', label: 'Agent', path: (id) => `agents/${id}` },
  { prefixes: ['fn_', 'func_', 'function_'], kind: 'function', label: 'Function', path: (id) => `functions/${id}` },
  { prefixes: ['flow_'], kind: 'flow', label: 'Automation flow', path: (id) => `automations/flows/${id}` },
  { prefixes: ['run_'], kind: 'run', label: 'Automation run', path: (id) => `automations/runs/${id}` },
  { prefixes: ['prompt_', 'prm_'], kind: 'prompt', label: 'Prompt', path: (id) => `prompts/${id}` },
  { prefixes: ['trace_', 'tr_'], kind: 'trace', label: 'Trace', path: (id) => `o11y/traces/${id}` },
]

/**
 * Route an object id (or a bare `resource/name` path) to the same-origin `/v1` GET
 * that reads it. Recognizes the platform's id prefixes, the `sk-/pk-` key
 * prefixes (→ key status, never the secret), and a raw `resource/name` fallback so
 * any object addressable by path (`agents/my-agent`, `models/zen5`) is inspectable.
 * A URL or an unrecognized bare token is refused with an honest message — the
 * Inspector never guesses a wrong endpoint.
 */
export function inspectorRoute(input: string): InspectTarget {
  const id = input.trim()
  if (!id) return { error: 'Enter an object id — e.g. agent_… , fn_… , or a path like agents/<name>' }
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(id)) return { error: 'Enter an object id or a /v1 resource path — not a URL.' }
  const lower = id.toLowerCase()
  if (KEY_PREFIXES.some((p) => lower.startsWith(p))) return { path: 'iam/keys', kind: 'key', label: 'API key' }
  for (const r of ID_ROUTES) {
    if (r.prefixes.some((p) => lower.startsWith(p))) return { path: r.path(encodeURIComponent(id)), kind: r.kind, label: r.label }
  }
  // Fallback: a raw `resource/name` path (must contain a segment separator, be safe).
  const path = id.replace(/^\/+/, '').replace(/^v1\//, '')
  if (path.includes('/') && PATH_OK.test(path) && !path.includes('..') && !path.includes('//')) {
    return { path, kind: 'resource', label: 'Resource' }
  }
  return {
    error: 'Unrecognized id. Try agent_… , fn_… , flow_… , run_… , prompt_… , an sk-/pk- key, or a resource path like agents/<name>.',
  }
}

// ── Show code — the same read as curl / the Hanzo CLI ─────────────────────────

/** Normalize a workbench path (`/v1/x`, `v1/x`, `x`) to the bare resource `x`. */
const bareResource = (path: string): string => path.replace(/^\/+/, '').replace(/^v1\//, '')

/** The `curl` form of a `/v1` GET — the real request, keyed by the account's `sk-` key. */
export function curlFor(path: string, origin = 'https://api.hanzo.ai'): string {
  return `curl ${origin}/v1/${bareResource(path)} \\\n  -H "Authorization: Bearer $HANZO_API_KEY"`
}

// ── Events — project the usage ledger into a platform-event stream ────────────

/** One platform event, projected from a real charged ledger row (never fabricated). */
export type PlatformEvent = { id: string; type: string; object: string; at: number | null; status: string; cents: number }

/** The minimal ledger-row shape the event projection reads (a `UsageRecord` subset). */
type EventSource = { id: string; requestId: string; model: string; product: string; agent: string; status: string; cents: number; at: number | null }

/**
 * Project the org's real usage/billing ledger into a platform-event stream —
 * newest first. Each metered call IS a platform event: an agent invocation →
 * `agent.run.*`, a plain call → `request.*`, refined by the real charged status.
 * Honest by construction: no ledger rows → `[]` (an org with no activity), and the
 * fields are the row's own id/model/status/cost — never a synthesized delivery.
 */
export function eventsFrom(records: EventSource[]): PlatformEvent[] {
  return records
    .map((r) => {
      const failed = r.status !== '' && r.status !== 'success'
      const type = r.agent
        ? failed
          ? 'agent.run.failed'
          : 'agent.run.succeeded'
        : failed
          ? 'request.failed'
          : 'request.succeeded'
      return {
        id: r.requestId || r.id,
        type,
        object: r.model || r.product || '—',
        at: r.at,
        status: r.status || (failed ? 'error' : 'success'),
        cents: r.cents,
      }
    })
    .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity))
}

// ── Cloud shell — where the terminal is ──────────────────────────────────────

/**
 * The terminal's address on the API host.
 *
 * Cloud SERVES the terminal — emulator, socket, resize and reconnect, one
 * self-contained page — so a host that wants a shell frames this rather than
 * building one. It is the one address in the console that is not same-origin, and
 * that is forced rather than chosen: the same-origin `/v1` proxy is a Next route
 * handler, and a route handler forwards requests, not sockets and not frames.
 * What crosses instead of the session is the single-use ticket the proxy just
 * fetched, which is the only credential a URL can safely hold.
 *
 * `arg` names a tmux session, so reopening the dock reattaches to the shell it
 * left instead of opening a fresh one over the user's work.
 */
export function terminalFor(apiBase: string, id: string, ticket: string, session: string): string {
  const base = apiBase.trim().replace(/\/+$/, '')
  return (
    `${base}/v1/sandboxes/${encodeURIComponent(id)}/terminal` +
    `?ticket=${encodeURIComponent(ticket)}&arg=${encodeURIComponent(session)}`
  )
}
