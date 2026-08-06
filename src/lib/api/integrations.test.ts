import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  IntegrationsApi,
  GitHubApi,
  normalizeConnection,
  normalizeProvider,
  normalizeProviders,
  normalizeConnectResult,
  normalizeGitHubRepo,
  normalizeGitHubRepos,
} from './integrations'

/**
 * Integrations API + pure normalizers. The module calls the DOCUMENTED cloud
 * `/v1/integrations` contract keyless and prefix-free (`originV1Url` →
 * `<api>/v1/integrations`), resolved against the CANONICAL API host rather than
 * whatever origin serves the page. These tests pin (1) that each call hits the EXACT
 * `/v1/integrations` path on that host with the right verb (the canonical Agents/CRM
 * form), (2) that the real Provider JSON shape (the CONNECTORS_CONTRACT tags)
 * normalizes, (3) the list reads any envelope key, and (4) a garbage/absent field
 * degrades to a safe default — never throws.
 */
/** The PAGE origin — where the SPA is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The canonical API host every `/v1` call resolves against, whatever origin serves the page. */
const API = 'https://api.hanzo.ai'

describe('Integrations normalizers — contract Provider shape, defensive', () => {
  it('normalizes a connected provider with all fields', () => {
    const p = normalizeProvider({
      id: 'slack',
      name: 'Slack',
      description: 'Post + read messages',
      category: 'Communication',
      available: true,
      connected: true,
      connection: {
        account: 'Acme HQ',
        externalId: 'T0123',
        scopes: ['chat:write', 'users:read'],
        connectedAt: '2026-07-01T10:00:00Z',
      },
    })
    expect(p).toMatchObject({
      id: 'slack', name: 'Slack', category: 'Communication', available: true, connected: true,
    })
    expect(p.connection).toEqual({
      account: 'Acme HQ', externalId: 'T0123', scopes: ['chat:write', 'users:read'], connectedAt: '2026-07-01T10:00:00Z',
    })
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const p = normalizeProvider({ id: 'github' })
    expect(p).toMatchObject({
      id: 'github', name: 'github', description: '', category: '', available: false, connected: false, connection: null,
    })
    // A non-object degrades to an empty (id-less) record, filtered out of lists.
    expect(normalizeProvider(null).id).toBe('')
    expect(normalizeProviders({ providers: [null, 'x', { id: 'slack', name: 'Slack' }] }).map((r) => r.id)).toEqual(['slack'])
  })

  it('reads snake_case connection keys and derives connected from the object', () => {
    const c = normalizeConnection({ account_label: 'Acme', external_id: 'T9', scopes: ['a'], connected_at: 'ts' })
    expect(c).toEqual({ account: 'Acme', externalId: 'T9', scopes: ['a'], connectedAt: 'ts' })
    // A connection object present but no explicit `connected` flag → still connected.
    const p = normalizeProvider({ id: 'slack', connection: { account: 'Acme' } })
    expect(p.connected).toBe(true)
    expect(p.connection?.account).toBe('Acme')
  })

  it('reads the provider list from any envelope key or a bare array', () => {
    expect(normalizeProviders([{ id: 'a' }, { id: 'b' }]).length).toBe(2)
    expect(normalizeProviders({ data: [{ id: 'slack' }] }).length).toBe(1)
    expect(normalizeProviders({ items: [{ id: 'github' }] }).length).toBe(1)
    expect(normalizeProviders('garbage')).toEqual([])
  })

  it('normalizes the connect result (tolerates authorize_url / url; empty → "")', () => {
    expect(normalizeConnectResult({ authorizeUrl: 'https://slack.com/oauth' }).authorizeUrl).toBe('https://slack.com/oauth')
    expect(normalizeConnectResult({ authorize_url: 'https://x' }).authorizeUrl).toBe('https://x')
    expect(normalizeConnectResult({ url: 'https://y' }).authorizeUrl).toBe('https://y')
    expect(normalizeConnectResult({}).authorizeUrl).toBe('')
    expect(normalizeConnectResult(null).authorizeUrl).toBe('')
  })
})

describe('IntegrationsApi — hits the canonical-API /v1/integrations contract', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.endsWith('/connect')
        ? { authorizeUrl: 'https://slack.com/oauth/v2/authorize?x=1' }
        : url.endsWith('/disconnect')
          ? { disconnected: true }
          : url.endsWith('/integrations/slack')
            ? { id: 'slack', name: 'Slack', available: true, connected: false }
            : { providers: [{ id: 'slack', name: 'Slack' }, { id: 'github', name: 'GitHub' }] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists providers via GET the canonical /v1/integrations path', async () => {
    const out = await IntegrationsApi.list()
    expect(fetched[0]).toEqual({ url: `${API}/v1/integrations`, method: 'GET' })
    expect(out.map((p) => p.id)).toEqual(['slack', 'github'])
  })

  it('gets one provider by id', async () => {
    const p = await IntegrationsApi.get('slack')
    expect(fetched[0]).toEqual({ url: `${API}/v1/integrations/slack`, method: 'GET' })
    expect(p.id).toBe('slack')
  })

  it('connects with POST and returns the authorizeUrl', async () => {
    const { authorizeUrl } = await IntegrationsApi.connect('slack')
    expect(fetched[0]).toEqual({ url: `${API}/v1/integrations/slack/connect`, method: 'POST' })
    expect(authorizeUrl).toBe('https://slack.com/oauth/v2/authorize?x=1')
  })

  it('disconnects with POST', async () => {
    await IntegrationsApi.disconnect('slack')
    expect(fetched[0]).toEqual({ url: `${API}/v1/integrations/slack/disconnect`, method: 'POST' })
  })
})

describe('GitHub repo normalizers — defensive, snake_case tolerant', () => {
  it('normalizes a full repo (camelCase)', () => {
    const r = normalizeGitHubRepo({
      name: 'widgets', fullName: 'acme/widgets', private: true, defaultBranch: 'main',
      imported: true, syncStatus: 'synced', lastSyncedAt: '2026-07-01T00:00:00Z', htmlUrl: 'https://github.com/acme/widgets',
    })
    expect(r).toEqual({
      name: 'widgets', fullName: 'acme/widgets', private: true, defaultBranch: 'main',
      imported: true, syncStatus: 'synced', lastSyncedAt: '2026-07-01T00:00:00Z', htmlUrl: 'https://github.com/acme/widgets',
    })
  })

  it('reads snake_case + clamps an unknown syncStatus to "" and defaults the rest', () => {
    const r = normalizeGitHubRepo({ name: 'x', full_name: 'o/x', default_branch: 'trunk', sync_status: 'weird' })
    expect(r.fullName).toBe('o/x')
    expect(r.defaultBranch).toBe('trunk')
    expect(r.syncStatus).toBe('') // unknown value is not trusted
    expect(r.imported).toBe(false)
    expect(r.private).toBe(false)
    // conflict is preserved.
    expect(normalizeGitHubRepo({ name: 'y', imported: true, syncStatus: 'conflict' }).syncStatus).toBe('conflict')
  })

  it('reads the list from any envelope key and drops no-name rows', () => {
    expect(normalizeGitHubRepos({ repos: [{ name: 'a' }, { name: '' }, 'junk'] }).map((r) => r.name)).toEqual(['a'])
    expect(normalizeGitHubRepos({ data: [{ name: 'b' }] }).length).toBe(1)
    expect(normalizeGitHubRepos([{ name: 'c' }]).length).toBe(1)
    expect(normalizeGitHubRepos('garbage')).toEqual([])
  })
})

describe('GitHubApi — hits the canonical-API /v1/integrations/github contract', () => {
  const fetched: { url: string; method: string; body?: unknown }[] = []
  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = { location: { origin: ORIGIN, hostname: 'console.hanzo.ai' } }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const body = url.endsWith('/import')
        ? { queued: 1, repos: ['widgets'] }
        : { repos: [{ name: 'widgets', full_name: 'acme/widgets', imported: true, syncStatus: 'synced' }] }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists repos via GET the canonical github/repos path', async () => {
    const out = await GitHubApi.listRepos()
    expect(fetched[0]).toMatchObject({ url: `${API}/v1/integrations/github/repos`, method: 'GET' })
    expect(out.map((r) => r.name)).toEqual(['widgets'])
    expect(out[0].imported).toBe(true)
  })

  it('imports selected repos via POST with the {repos} body', async () => {
    const res = await GitHubApi.importRepos({ repos: ['widgets'] })
    expect(fetched[0]).toMatchObject({ url: `${API}/v1/integrations/github/repos/import`, method: 'POST', body: { repos: ['widgets'] } })
    expect(res).toEqual({ queued: 1, repos: ['widgets'] })
  })

  it('imports all via POST with the {all:true} body', async () => {
    await GitHubApi.importRepos({ all: true })
    expect(fetched[0]).toMatchObject({ url: `${API}/v1/integrations/github/repos/import`, method: 'POST', body: { all: true } })
  })
})
