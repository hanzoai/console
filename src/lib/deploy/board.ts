/**
 * The deploy board — one row shape over the two things an org deploys.
 *
 * An APP is a container workload the operator reconciles (`/v1/platform/projects/
 * :project/apps`, `PaasApi`); a SITE is a static build served from object storage
 * (`/v1/platform/sites`, `PlatformSitesApi`). They are separate backends on
 * purpose, but a person reading "what have I shipped" wants ONE list, so this
 * module folds both into `DeployRow` and nothing downstream branches on which
 * store a row came from.
 *
 * Pure by construction: no React, no fetch, no clock. The panels do the I/O with
 * the existing typed clients and hand the results here, which is what makes the
 * mapping (form → create input, env text → env vars, app → row) testable without
 * a browser or a server.
 *
 * ORG SCOPING IS NOT DONE HERE, and that is deliberate. Every read/write goes
 * through the same-origin `/v1` bearer proxy, which resolves the org from the
 * token owner server-side. This module never sees, sends, or filters by an org —
 * a client-side filter would read like a boundary while being none.
 */
import { slugify } from '~/lib/framework/fields'
import type { PaasAppWithProject, PaasEnvVar, CreateAppInput } from '~/lib/api/paas'
import type { Site, CreateSiteInput } from '~/lib/api/platform-sites'

/** What a row deploys: a reconciled container workload, or a static build. */
export type DeployKind = 'app' | 'site'

/** One shipped thing, whichever store holds it. */
export type DeployRow = {
  kind: DeployKind
  id: string
  /** Backend key: an app's slug (unique within its project) or a site's slug. */
  slug: string
  name: string
  /** Owning project — apps only; a site is scoped to the org directly. */
  project?: string
  /** Primary public host, absent until one is bound — the board's Host column. */
  host?: string
  /**
   * EVERY host bound to this row, primary first. Kept alongside `host` because a
   * custom domain is usually the second entry (an app is born with its
   * `*.hanzo.app` host), so a Domains view built from `host` alone would hide
   * exactly the domain someone went to the trouble of binding.
   */
  hosts: string[]
  /** Backend lifecycle: draft | building | deploying | live | stopped | error. */
  status: string
  /** Operator reconciliation, read straight off the App CR. Apps only. */
  phase?: string
  health?: string
  updatedAt: number
}

/** Every non-blank bound host, order preserved. */
export const boundHosts = (domains?: string[]): string[] =>
  (domains ?? []).map((d) => d.trim()).filter((d) => d.length > 0)

/** The first bound host, or undefined — never a fabricated default. */
export const primaryHost = (domains?: string[]): string | undefined => boundHosts(domains)[0]

export function rowOfApp(app: PaasAppWithProject): DeployRow {
  const hosts = boundHosts(app.domains)
  return {
    kind: 'app',
    id: app.id,
    slug: app.slug,
    name: app.name || app.slug,
    project: app.project?.slug,
    host: hosts[0],
    hosts,
    status: app.status || 'draft',
    phase: app.phase,
    health: app.health,
    updatedAt: app.updatedAt ?? app.createdAt ?? 0,
  }
}

export function rowOfSite(site: Site): DeployRow {
  // A site reports ONE public host (its live URL); custom hosts are bound through
  // the site's own domains endpoint, which this board does not read per row.
  const host = site.liveUrl ? hostOf(site.liveUrl) : undefined
  return {
    kind: 'site',
    id: site.id,
    slug: site.slug,
    name: site.name || site.slug,
    host,
    hosts: host ? [host] : [],
    status: site.status || 'draft',
    updatedAt: site.updatedAt ?? site.createdAt ?? 0,
  }
}

/** Hostname out of a URL; the input unchanged when it isn't one. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Newest first — the order a deploy board is read in. */
export const byRecency = (rows: DeployRow[]): DeployRow[] =>
  [...rows].sort((a, b) => b.updatedAt - a.updatedAt)

/**
 * The sentence for a board that loaded only part of itself, or null when it is
 * whole. Named per source, because "some data is missing" leaves a reader unable
 * to tell which number on the screen is now a lie.
 */
export function partialNote(incomplete: readonly DeployKind[]): string | null {
  const apps = incomplete.includes('app')
  const sites = incomplete.includes('site')
  if (apps && sites) return 'Apps and sites could not be fully loaded — this list is incomplete.'
  if (apps) return 'Apps could not be fully loaded — this list is incomplete.'
  if (sites) return 'Sites could not be fully loaded — this list is incomplete.'
  return null
}

/** Board headline counts. `live` is the backend's own word, never inferred. */
export function summarize(rows: DeployRow[]): { total: number; live: number; apps: number; sites: number } {
  return {
    total: rows.length,
    live: rows.filter((r) => r.status === 'live').length,
    apps: rows.filter((r) => r.kind === 'app').length,
    sites: rows.filter((r) => r.kind === 'site').length,
  }
}

/** One published host, and the app or site it belongs to. */
export type HostRow = { host: string; owner: string; kind: DeployKind; status: string }

/**
 * Every host on the board, one row each — EXPANDED over `hosts`, not folded to
 * the primary. An app is born with its `*.hanzo.app` host, so a custom domain is
 * the second entry; listing only the primary would hide exactly the domain
 * someone bound on purpose.
 */
export function hostRows(rows: DeployRow[]): HostRow[] {
  return rows
    .flatMap((r) => r.hosts.map((host) => ({ host, owner: r.name, kind: r.kind, status: r.status })))
    .sort((a, b) => a.host.localeCompare(b.host))
}

// ── Deploy form → backend create input ───────────────────────────────────────

/**
 * Default app/site name from a repo URL: the last path segment, `.git` dropped.
 * `https://git.hanzo.ai/hanzoai/console.git` → `console`. Empty when the URL has
 * no usable segment, so the form asks rather than inventing a name.
 */
export function repoName(url: string): string {
  const last = url.trim().replace(/\/+$/, '').split('/').pop() ?? ''
  return slugify(last.replace(/\.git$/i, ''))
}

/**
 * `KEY=VALUE` lines → env vars. Blank lines and `#` comments are skipped, the
 * first `=` splits (so a value may contain `=`), and a line without one is
 * dropped rather than stored as a key with an empty value.
 *
 * EVERY variable is secret unless its key appears in `publicKeys` — an explicit
 * choice the person deploying makes per variable. This replaced a key-NAME regex
 * (`/SECRET|TOKEN|KEY|…/`) that guessed, and guessed wrong in both directions:
 * `STRIPE_SK`, `GH_PAT` and `DB_PASS` all name credentials and all escaped it, while
 * the form's own help text promised they would be sealed. A default that fails
 * open under a promise of safety is worse than no default, so the default is now
 * sealed and the exceptions are named.
 *
 * Values are passed through verbatim — no trimming beyond surrounding
 * whitespace, no unquoting, no expansion. Interpreting `$VAR` or stripping
 * quotes here would silently change a credential.
 */
export function parseEnv(text: string, publicKeys: ReadonlySet<string> = new Set()): PaasEnvVar[] {
  const out: PaasEnvVar[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!key) continue
    out.push({ key, value: line.slice(eq + 1).trim(), secret: !publicKeys.has(key) })
  }
  return out
}

/**
 * The env-key rule the platform enforces (`^[A-Za-z_][A-Za-z0-9_]*$`). Checked here
 * so a stray `MY-KEY` is named in the form instead of coming back as a bare 400.
 */
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Message naming the first key the backend would reject, else null. */
export function envError(text: string): string | null {
  const bad = parseEnv(text).find((e) => !ENV_KEY.test(e.key))
  return bad ? `"${bad.key}" is not a valid env name — letters, digits, and _ only, not starting with a digit.` : null
}

/** A hostname is 1–253 chars of dot-separated LDH labels; no scheme, port, or path. */
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/**
 * Message when `host` is not a bindable hostname, else null.
 *
 * UX validation only. The server is the authority on whether this org may bind
 * this host (it demands ownership verification and 409s a host another org
 * holds); this only stops an obviously malformed value from becoming a request.
 */
export function hostError(host: string): string | null {
  const v = host.trim()
  if (!v) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return 'Hostname only — drop the https:// prefix.'
  if (v.includes('/')) return 'Hostname only — no path.'
  if (v.includes(':')) return 'Hostname only — no port.'
  if (!HOST.test(v.toLowerCase())) return 'Not a valid hostname (e.g. app.example.com).'
  return null
}

/** What the deploy form collects, before it is shaped for either backend. */
export type DeployForm = {
  kind: DeployKind
  name: string
  /** Git URL to build from; a site always builds from git. */
  repo: string
  branch?: string
  /** Custom host to bind. Optional — every app is born with a default host. */
  host?: string
  /** Raw `KEY=VALUE` lines from the textarea. Apps only. */
  env?: string
  /**
   * Keys the person explicitly marked PUBLIC. Everything else is sealed — the
   * list names the exceptions, so forgetting to touch a variable leaves it safe.
   */
  publicKeys?: string[]
  framework?: string
}

/** The variables a form will send, each carrying its sealed/public choice. */
export const envVars = (form: DeployForm): PaasEnvVar[] =>
  parseEnv(form.env ?? '', new Set(form.publicKeys ?? []))

/**
 * The public marks that still have a variable, given the current env text.
 *
 * A mark must not outlive the line it was made on. Without this, deleting
 * `DATABASE_URL=postgres://safe` (marked Public) and later typing a new
 * `DATABASE_URL=` carrying a password would silently inherit the old mark and
 * ship the credential unsealed — the mark would be a property of a NAME rather
 * than of the variable someone actually looked at.
 *
 * Matching is exact, so `db_url` never inherits `DB_URL`'s mark: a case twin is a
 * different key to the backend, and failing closed on the ambiguity is correct.
 */
export function prunePublicKeys(env: string, publicKeys: readonly string[]): string[] {
  const present = new Set(parseEnv(env).map((e) => e.key))
  return publicKeys.filter((k) => present.has(k))
}

/** The app create body (`POST /v1/platform/projects/:project/apps`). */
export function toAppInput(form: DeployForm): CreateAppInput {
  const host = form.host?.trim().toLowerCase()
  const env = envVars(form)
  return {
    name: form.name.trim(),
    source: 'git',
    repo: { url: form.repo.trim(), ...(form.branch?.trim() ? { branch: form.branch.trim() } : {}) },
    ...(env.length ? { env } : {}),
    ...(host ? { domains: [host] } : {}),
  }
}

/** The site create body (`POST /v1/platform/sites`). */
export function toSiteInput(form: DeployForm): CreateSiteInput {
  const repo = form.repo.trim()
  return {
    name: form.name.trim(),
    framework: form.framework || 'static',
    ...(repo ? { repo: { url: repo, ...(form.branch?.trim() ? { branch: form.branch.trim() } : {}) } } : {}),
  }
}

/** Message when the form cannot be submitted yet, else null. */
export function formError(form: DeployForm, project: string | null): string | null {
  if (!form.name.trim()) return 'Name is required.'
  if (form.kind === 'app' && !project) return 'Pick a project.'
  if (form.kind === 'app' && !form.repo.trim()) return 'Repository URL is required.'
  const env = form.env ? envError(form.env) : null
  if (env) return env
  return form.host ? hostError(form.host) : null
}
