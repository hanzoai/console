import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  AffiliatesApi,
  normalizeOverview,
  normalizePayout,
  normalizeApply,
  normalizeAttribute,
  normalizeEarnings,
  normalizeLinks,
  normalizeLeaderboard,
} from './affiliates'

/**
 * Affiliates API + pure normalizers. The client calls the cloud `/v1/affiliates`
 * contract on the canonical API host (`cloudProxyV1Url` = `originV1Url` →
 * `api.hanzo.ai/v1/affiliates`) — the host is named, never inherited from whatever
 * origin serves the page. These tests pin (1) that each call hits the EXACT
 * `/v1/affiliates…` path, (2) the real store JSON shape normalizes, and (3) a
 * garbage/absent field degrades to a safe default.
 */
// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://console.hanzo.ai'
const API = 'https://api.hanzo.ai'

describe('Affiliates normalizers — real cloud JSON shape, defensive', () => {
  it('normalizes the enrolled overview with all fields', () => {
    const o = normalizeOverview({
      isAffiliate: true,
      id: 'aff_1',
      status: 'approved',
      code: 'acme',
      requestedCode: 'acme',
      link: 'https://hanzo.ai/?aff=acme',
      rateBps: 2000,
      referredCount: 3,
      accruedCents: 4200,
      pendingCents: 1200,
      paidCents: 3000,
      payouts: [
        { id: 'apo_1', amountCents: 3000, method: 'credits', reference: 'x', txn: 'txn_9', createdAt: 5 },
        { id: 'apo_2', amountCents: 500, method: 'wire', reference: '', txn: '', createdAt: 6 },
      ],
    })
    expect(o).toMatchObject({
      isAffiliate: true,
      id: 'aff_1',
      status: 'approved',
      code: 'acme',
      link: 'https://hanzo.ai/?aff=acme',
      rateBps: 2000,
      referredCount: 3,
      accruedCents: 4200,
      pendingCents: 1200,
      paidCents: 3000,
    })
    expect(o.payouts.map((p) => p.id)).toEqual(['apo_1', 'apo_2'])
    expect(o.payouts[0].method).toBe('credits')
  })

  it('normalizes the NOT-enrolled shape (apply-form state)', () => {
    const o = normalizeOverview({ isAffiliate: false, defaultRateBps: 2000 })
    expect(o.isAffiliate).toBe(false)
    expect(o.defaultRateBps).toBe(2000)
    expect(o.payouts).toEqual([])
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const o = normalizeOverview(null)
    expect(o).toMatchObject({ isAffiliate: false, code: '', link: '', accruedCents: 0, pendingCents: 0, paidCents: 0 })
    expect(o.defaultRateBps).toBe(2000) // sensible fallback when absent
    expect(o.payouts).toEqual([])
    // A payout row with no id is filtered out.
    expect(
      normalizeOverview({ payouts: [null, 'x', { id: 'apo_9', amountCents: 1 }] }).payouts.map((p) => p.id),
    ).toEqual(['apo_9'])
    // A row defaults status to applied.
    expect(normalizeOverview({ isAffiliate: true }).status).toBe('applied')
    // Numeric coercion from strings.
    expect(normalizePayout({ id: 'p', amountCents: '1500' }).amountCents).toBe(1500)
  })

  it('normalizes apply + attribute results (strict-boolean created)', () => {
    expect(normalizeApply({ id: 'aff_1', status: 'applied', requestedCode: 'acme', rateBps: 2000, created: true })).toEqual({
      id: 'aff_1',
      status: 'applied',
      code: '',
      requestedCode: 'acme',
      rateBps: 2000,
      created: true,
    })
    expect(normalizeApply({ id: 'x' }).created).toBe(false)
    expect(normalizeAttribute({ id: 'afr_1', code: 'acme', created: true, createdAt: 9 })).toEqual({
      id: 'afr_1',
      code: 'acme',
      created: true,
      createdAt: 9,
    })
    expect(normalizeAttribute({ id: 'x' }).created).toBe(false)
  })
})

describe('AffiliatesApi — hits the /v1/affiliates path on the canonical API', () => {
  const fetched: { url: string; method: string; body: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      const body = url.endsWith('/apply')
        ? { id: 'aff_1', status: 'applied', code: '', requestedCode: 'acme', rateBps: 2000, created: true }
        : url.endsWith('/attribute')
          ? { id: 'afr_1', code: 'acme', created: true, createdAt: 1 }
          : { isAffiliate: true, code: 'acme', link: 'https://hanzo.ai/?aff=acme', payouts: [] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads the overview via GET /v1/affiliates (prefix-free /v1, never a /cloud-prefixed path)', async () => {
    const out = await AffiliatesApi.overview()
    expect(fetched[0]).toEqual({ url: `${API}/v1/affiliates`, method: 'GET', body: '' })
    expect(out.code).toBe('acme')
  })

  it('applies with POST /v1/affiliates/apply', async () => {
    const r = await AffiliatesApi.apply('acme')
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/apply`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('acme')
    expect(r.created).toBe(true)
  })

  it('attributes with POST /v1/affiliates/attribute', async () => {
    const r = await AffiliatesApi.attribute('acme')
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/attribute`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('acme')
    expect(r.created).toBe(true)
  })
})

describe('Affiliates dashboard normalizers — earnings, links, leaderboard', () => {
  it('normalizes earnings (period + per-referral share), filtering junk rows', () => {
    const e = normalizeEarnings({
      isAffiliate: true,
      marginBps: 4000,
      accruedCents: 800,
      pendingCents: 800,
      paidCents: 0,
      byPeriod: [
        { period: '2026-07', marginCents: 4000, commissionCents: 800 },
        { period: '', marginCents: 1, commissionCents: 1 }, // no period → filtered
      ],
      byReferredOrg: [{ referredOrg: 'orgX', commissionCents: 800 }, { commissionCents: 5 }],
    })
    expect(e.isAffiliate).toBe(true)
    expect(e.marginBps).toBe(4000)
    expect(e.byPeriod).toEqual([{ period: '2026-07', marginCents: 4000, commissionCents: 800 }])
    expect(e.byReferredOrg).toEqual([{ referredOrg: 'orgX', commissionCents: 800 }])
  })

  it('normalizes links with derived stats (maxLinks fallback)', () => {
    const v = normalizeLinks({
      isAffiliate: true,
      status: 'approved',
      links: [{ code: 'acme', label: 'primary', url: 'https://hanzo.ai/?aff=acme', clicks: 3, signups: 2, conversions: 1, createdAt: 5 }, { label: 'no-code' }],
    })
    expect(v.maxLinks).toBe(50) // fallback when absent
    expect(v.links).toHaveLength(1) // the code-less row is dropped
    expect(v.links[0]).toMatchObject({ code: 'acme', clicks: 3, signups: 2, conversions: 1 })
  })

  it('normalizes the leaderboard (you may be null; junk rows dropped)', () => {
    const lb = normalizeLeaderboard({
      leaders: [
        { rank: 1, handle: 'alice', accruedCents: 8000, referredCount: 2, isYou: true },
        { rank: 0, handle: 'bad' }, // rank 0 → dropped
      ],
      total: 3,
      you: { rank: 1, handle: 'alice', accruedCents: 8000, referredCount: 2, isYou: true },
    })
    expect(lb.leaders).toHaveLength(1)
    expect(lb.leaders[0]).toMatchObject({ rank: 1, handle: 'alice', isYou: true })
    expect(lb.total).toBe(3)
    expect(lb.you?.rank).toBe(1)
    expect(normalizeLeaderboard({ leaders: [] }).you).toBeNull()
  })
})

describe('AffiliatesApi dashboard — hits the exact /v1/affiliates paths', () => {
  const fetched: { url: string; method: string; body: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = { location: { origin: ORIGIN, hostname: 'console.hanzo.ai' } }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      fetched.push({ url, method, body: String(init?.body ?? '') })
      let body: unknown = {}
      if (url.endsWith('/me/earnings')) body = { isAffiliate: true, marginBps: 4000, byPeriod: [], byReferredOrg: [] }
      else if (url.endsWith('/me/links')) body = method === 'POST' ? { link: { code: 'xy', label: 'l', url: 'u' } } : { isAffiliate: true, status: 'approved', maxLinks: 50, links: [] }
      else if (url.endsWith('/me/handle')) body = { handle: 'alice' }
      else if (url.endsWith('/leaderboard')) body = { leaders: [], total: 0, you: null }
      else if (url.endsWith('/click')) body = { counted: true }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads earnings via GET /v1/affiliates/me/earnings', async () => {
    await AffiliatesApi.earnings()
    expect(fetched[0]).toEqual({ url: `${API}/v1/affiliates/me/earnings`, method: 'GET', body: '' })
  })
  it('reads links via GET /v1/affiliates/me/links', async () => {
    await AffiliatesApi.links()
    expect(fetched[0]).toEqual({ url: `${API}/v1/affiliates/me/links`, method: 'GET', body: '' })
  })
  it('creates a link via POST /v1/affiliates/me/links', async () => {
    const l = await AffiliatesApi.createLink('twitter')
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/me/links`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('twitter')
    expect(l.code).toBe('xy')
  })
  it('sets the handle via POST /v1/affiliates/me/handle', async () => {
    const h = await AffiliatesApi.setHandle('alice')
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/me/handle`)
    expect(fetched[0].method).toBe('POST')
    expect(h).toBe('alice')
  })
  it('reads the leaderboard via GET /v1/affiliates/leaderboard', async () => {
    await AffiliatesApi.leaderboard()
    expect(fetched[0]).toEqual({ url: `${API}/v1/affiliates/leaderboard`, method: 'GET', body: '' })
  })
  it('pings a click via POST /v1/affiliates/click', async () => {
    await AffiliatesApi.click('xy')
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/click`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('xy')
  })
})
