import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { AdminAuthorsApi, normalizeAdminAuthor, normalizeAdminAuthors } from './admin-authors'

/**
 * Admin authors API + normalizers. The client hits the canonical API host
 * (`api.hanzo.ai/v1/admin/authors…`, `originV1Url` → `config.cloudUrl`) — named, not
 * inherited from whatever origin serves the page. These tests pin the exact
 * `/v1/admin/authors` paths (read + the mutations) and the optional-safe normalizers.
 */
// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://admin.hanzo.ai'
const API = 'https://api.hanzo.ai'

describe('Admin authors normalizers — envelope-safe', () => {
  it('normalizes the directory + summary', () => {
    const v = normalizeAdminAuthors({
      authors: [
        { id: 'auth_1', org: 'orgA', githubLogin: 'octocat', status: 'approved', verified: true, shareBps: 500, repoCount: 2, deployCount: 4, accruedCents: 4000, pendingCents: 1000, paidCents: 3000, createdAt: 1 },
        { id: 'auth_2', org: 'orgB', githubLogin: 'monalisa', status: 'connected', verified: false, shareBps: 500, repoCount: 0, deployCount: 0, createdAt: 2 },
      ],
      summary: { total: 2, connected: 1, approved: 1, suspended: 0, accruedCents: 4000, pendingCents: 1000, paidCents: 3000 },
    })
    expect(v.authors.map((a) => a.id)).toEqual(['auth_1', 'auth_2'])
    expect(v.authors[0]).toMatchObject({ org: 'orgA', githubLogin: 'octocat', status: 'approved', verified: true, repoCount: 2, deployCount: 4, pendingCents: 1000 })
    expect(v.summary).toMatchObject({ total: 2, approved: 1, connected: 1, accruedCents: 4000 })
  })

  it('degrades garbage to honest empties (never throws)', () => {
    const v = normalizeAdminAuthors(null)
    expect(v.authors).toEqual([])
    expect(v.summary).toEqual({ total: 0, connected: 0, approved: 0, suspended: 0, accruedCents: 0, pendingCents: 0, paidCents: 0 })
    // A row with no id is dropped.
    expect(normalizeAdminAuthors({ authors: [null, { id: 'auth_9', org: 'z' }] }).authors.map((a) => a.id)).toEqual(['auth_9'])
    // Numeric coercion from strings; strict-boolean verified.
    expect(normalizeAdminAuthor({ id: 'a', accruedCents: '500' }).accruedCents).toBe(500)
    expect(normalizeAdminAuthor({ id: 'a', repoCount: '3', verified: 'yes' })).toMatchObject({ repoCount: 3, verified: false })
  })
})

describe('AdminAuthorsApi — hits the canonical-API admin aggregate paths', () => {
  const fetched: { url: string; method: string; body: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'admin.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      const path = String(url)
      const data = path.endsWith('/sweep')
        ? { swept: 3, accrued: 1 }
        : /\/(approve|suspend|payout)$/.test(path)
          ? { author: { id: 'auth_1', org: 'orgA', githubLogin: 'octocat', status: 'approved', shareBps: 500 } }
          : { authors: [], summary: {} }
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', msg: '', data }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists via the canonical-API admin path', async () => {
    await AdminAuthorsApi.list()
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors`)
    expect(fetched[0].method).toBe('GET')
  })

  it('approves with an optional share override (POST, shareBps)', async () => {
    const a = await AdminAuthorsApi.approve('auth_1', 500)
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors/auth_1/approve`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('shareBps')
    expect(fetched[0].body).toContain('500')
    expect(a.status).toBe('approved')
  })

  it('approves with the default share when shareBps is omitted (empty body)', async () => {
    await AdminAuthorsApi.approve('auth_1')
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors/auth_1/approve`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).not.toContain('shareBps')
  })

  it('suspends (POST)', async () => {
    await AdminAuthorsApi.suspend('auth_1')
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors/auth_1/suspend`)
    expect(fetched[0].method).toBe('POST')
  })

  it('records a payout (POST, amount+method+reference)', async () => {
    await AdminAuthorsApi.payout('auth_1', { amountCents: 1200, method: 'credits', reference: 'ledger-1' })
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors/auth_1/payout`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('1200')
    expect(fetched[0].body).toContain('credits')
  })

  it('runs the accrual sweep (POST)', async () => {
    const r = await AdminAuthorsApi.sweep()
    expect(fetched[0].url).toBe(`${API}/v1/admin/authors/sweep`)
    expect(fetched[0].method).toBe('POST')
    expect(r).toEqual({ swept: 3, accrued: 1 })
  })
})
