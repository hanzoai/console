import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { AuthorsApi, normalizeOverview, normalizePayout, normalizeRepo, normalizeDeploy, normalizeConnect, normalizeVerifyRepo } from './authors'

/**
 * Authors API + pure normalizers. The client calls the cloud `/v1/authors`
 * contract through the console's `/v1` user-bearer proxy (`cloudProxyV1Url` →
 * `<origin>/v1/authors` — the live-ingress-safe form for a bearer-scoped
 * head; a bare `/v1/authors` 403s on the gateway). These tests pin (1) that each
 * call hits the EXACT `/v1/authors…` path, (2) the real store JSON shape
 * normalizes, and (3) a garbage/absent field degrades to a safe default.
 */
const ORIGIN = 'https://console.hanzo.ai'

describe('Authors normalizers — real cloud JSON shape, defensive', () => {
  it('normalizes the enrolled overview with all fields', () => {
    const o = normalizeOverview({
      isAuthor: true,
      id: 'auth_1',
      status: 'approved',
      githubLogin: 'octocat',
      verified: true,
      verifyCode: 'hz-abc123',
      verifyFile: 'hanzo.json',
      verifySnippet: '{"hanzo":"hz-abc123"}',
      shareBps: 500,
      badgeBase: 'https://hanzo.app',
      repos: [
        { repoUrl: 'https://github.com/octocat/a', verified: true, method: 'oauth', badgeMarkdown: '[![Deploy](x)](y)', verifiedAt: 10, createdAt: 5 },
        { repoUrl: 'https://github.com/octocat/b', verified: false, method: '', badgeMarkdown: '', verifiedAt: 0, createdAt: 6 },
      ],
      deploys: [{ repoUrl: 'https://github.com/octocat/a', project: 'proj', deployingOrg: 'acme', createdAt: 7 }],
      accruedCents: 4200,
      pendingCents: 1200,
      paidCents: 3000,
      payouts: [
        { id: 'apo_1', amountCents: 3000, method: 'credits', reference: 'x', txn: 'txn_9', createdAt: 5 },
        { id: 'apo_2', amountCents: 500, method: 'wire', reference: '', txn: '', createdAt: 6 },
      ],
    })
    expect(o).toMatchObject({
      isAuthor: true,
      id: 'auth_1',
      status: 'approved',
      githubLogin: 'octocat',
      verified: true,
      verifyCode: 'hz-abc123',
      verifyFile: 'hanzo.json',
      verifySnippet: '{"hanzo":"hz-abc123"}',
      shareBps: 500,
      badgeBase: 'https://hanzo.app',
      accruedCents: 4200,
      pendingCents: 1200,
      paidCents: 3000,
    })
    expect(o.repos.map((r) => r.repoUrl)).toEqual(['https://github.com/octocat/a', 'https://github.com/octocat/b'])
    expect(o.repos[0].method).toBe('oauth')
    expect(o.repos[0].badgeMarkdown).toBe('[![Deploy](x)](y)')
    expect(o.deploys.map((d) => d.deployingOrg)).toEqual(['acme'])
    expect(o.payouts.map((p) => p.id)).toEqual(['apo_1', 'apo_2'])
    expect(o.payouts[0].method).toBe('credits')
  })

  it('normalizes the NOT-enrolled shape (connect-form state)', () => {
    const o = normalizeOverview({ isAuthor: false, defaultShareBps: 500, badgeBase: 'https://hanzo.app' })
    expect(o.isAuthor).toBe(false)
    expect(o.defaultShareBps).toBe(500)
    expect(o.badgeBase).toBe('https://hanzo.app')
    expect(o.repos).toEqual([])
    expect(o.deploys).toEqual([])
    expect(o.payouts).toEqual([])
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const o = normalizeOverview(null)
    expect(o).toMatchObject({ isAuthor: false, githubLogin: '', accruedCents: 0, pendingCents: 0, paidCents: 0, verified: false })
    expect(o.defaultShareBps).toBe(2000) // sensible fallback when absent — the canonical 20%
    expect(o.badgeBase).toBe('https://hanzo.app') // sensible fallback when absent
    expect(o.verifyFile).toBe('hanzo.json') // the canonical file name
    expect(o.repos).toEqual([])
    expect(o.deploys).toEqual([])
    expect(o.payouts).toEqual([])
    // A repo row with no repoUrl is filtered out; verified array keeps real rows.
    expect(
      normalizeOverview({ repos: [null, 'x', { repoUrl: 'https://github.com/z/z', verified: true }] }).repos.map((r) => r.repoUrl),
    ).toEqual(['https://github.com/z/z'])
    // A deploy with no repoUrl is filtered out.
    expect(
      normalizeOverview({ deploys: [null, { deployingOrg: 'x' }, { repoUrl: 'https://github.com/z/z', deployingOrg: 'y' }] }).deploys.map((d) => d.deployingOrg),
    ).toEqual(['y'])
    // A payout row with no id is filtered out.
    expect(
      normalizeOverview({ payouts: [null, 'x', { id: 'apo_9', amountCents: 1 }] }).payouts.map((p) => p.id),
    ).toEqual(['apo_9'])
    // A row defaults status to connected.
    expect(normalizeOverview({ isAuthor: true }).status).toBe('connected')
    // Numeric coercion from strings.
    expect(normalizePayout({ id: 'p', amountCents: '1500' }).amountCents).toBe(1500)
    // A repo normalizes strict-boolean verified + defaulted method.
    expect(normalizeRepo({ repoUrl: 'r' })).toMatchObject({ repoUrl: 'r', verified: false, method: '', badgeMarkdown: '' })
    expect(normalizeDeploy({ repoUrl: 'r', createdAt: '9' }).createdAt).toBe(9)
  })

  it('normalizes connect + verify-repo results (strict-boolean created)', () => {
    expect(
      normalizeConnect({ id: 'auth_1', status: 'connected', githubLogin: 'octocat', verified: false, verifyCode: 'hz-1', verifyFile: 'hanzo.json', verifySnippet: '{}', shareBps: 500, created: true }),
    ).toEqual({
      id: 'auth_1',
      status: 'connected',
      githubLogin: 'octocat',
      verified: false,
      verifyCode: 'hz-1',
      verifyFile: 'hanzo.json',
      verifySnippet: '{}',
      shareBps: 500,
      created: true,
    })
    expect(normalizeConnect({ id: 'x' }).created).toBe(false)
    expect(normalizeConnect({ id: 'x' }).verifyFile).toBe('hanzo.json')
    const v = normalizeVerifyRepo({ repo: { repoUrl: 'https://github.com/z/z', verified: true, method: 'file', badgeMarkdown: 'md' }, created: true })
    expect(v.created).toBe(true)
    expect(v.repo).toMatchObject({ repoUrl: 'https://github.com/z/z', verified: true, method: 'file', badgeMarkdown: 'md' })
    expect(normalizeVerifyRepo({ repo: null }).created).toBe(false)
  })
})

describe('AuthorsApi — hits the /v1/authors bearer-proxy path', () => {
  const fetched: { url: string; method: string; body: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      const body = url.endsWith('/connect')
        ? { id: 'auth_1', status: 'connected', githubLogin: 'octocat', verified: false, verifyCode: 'hz-1', verifyFile: 'hanzo.json', verifySnippet: '{}', shareBps: 500, created: true }
        : url.endsWith('/repos/verify')
          ? { repo: { repoUrl: 'https://github.com/octocat/a', verified: true, method: 'file', badgeMarkdown: 'md' }, created: true }
          : { isAuthor: true, githubLogin: 'octocat', shareBps: 500, repos: [], deploys: [], payouts: [] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads the overview via the /v1 bearer BFF (prefix-free /v1, never a /cloud-prefixed or direct cloud-origin call)', async () => {
    const out = await AuthorsApi.overview()
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/authors`, method: 'GET', body: '' })
    expect(out.githubLogin).toBe('octocat')
  })

  it('connects with POST through the proxy (githubLogin in body)', async () => {
    const r = await AuthorsApi.connect('octocat')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/authors/connect`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('githubLogin')
    expect(fetched[0].body).toContain('octocat')
    expect(r.created).toBe(true)
  })

  it('verifies a repo with POST through the proxy (repoUrl in body)', async () => {
    const r = await AuthorsApi.verifyRepo('https://github.com/octocat/a')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/authors/repos/verify`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('repoUrl')
    expect(fetched[0].body).toContain('octocat/a')
    expect(r.repo.verified).toBe(true)
  })
})
