import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { AdminAffiliatesApi, normalizeAdminAffiliate, normalizeAdminAffiliates } from './admin-affiliates'

/**
 * Admin affiliates API + normalizers. The client hits the canonical API host
 * (`api.hanzo.ai/v1/admin/affiliates…`, `originV1Url` → `config.cloudUrl`) — named,
 * not inherited from whatever origin serves the page. These tests pin the exact
 * `/v1/admin/affiliates` paths (read + the mutations) and the optional-safe normalizers.
 */
// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://admin.hanzo.ai'
const API = 'https://api.hanzo.ai'

describe('Admin affiliates normalizers — envelope-safe', () => {
  it('normalizes the directory + summary', () => {
    const v = normalizeAdminAffiliates({
      affiliates: [
        { id: 'aff_1', org: 'orgA', code: 'acme', status: 'approved', rateBps: 2000, referredCount: 2, accruedCents: 4000, pendingCents: 1000, paidCents: 3000, createdAt: 1 },
        { id: 'aff_2', org: 'orgB', status: 'applied', requestedCode: 'bee', rateBps: 2000, referredCount: 0, createdAt: 2 },
      ],
      summary: { total: 2, applied: 1, approved: 1, suspended: 0, accruedCents: 4000, pendingCents: 1000, paidCents: 3000 },
    })
    expect(v.affiliates.map((a) => a.id)).toEqual(['aff_1', 'aff_2'])
    expect(v.affiliates[0]).toMatchObject({ org: 'orgA', code: 'acme', status: 'approved', referredCount: 2, pendingCents: 1000 })
    expect(v.summary).toMatchObject({ total: 2, approved: 1, applied: 1, accruedCents: 4000 })
  })

  it('degrades garbage to honest empties (never throws)', () => {
    const v = normalizeAdminAffiliates(null)
    expect(v.affiliates).toEqual([])
    expect(v.summary).toEqual({ total: 0, applied: 0, approved: 0, suspended: 0, accruedCents: 0, pendingCents: 0, paidCents: 0 })
    // A row with no id is dropped.
    expect(normalizeAdminAffiliates({ affiliates: [null, { id: 'aff_9', org: 'z' }] }).affiliates.map((a) => a.id)).toEqual(['aff_9'])
    // Numeric coercion from strings.
    expect(normalizeAdminAffiliate({ id: 'a', accruedCents: '500' }).accruedCents).toBe(500)
  })
})

describe('AdminAffiliatesApi — hits the canonical-API admin aggregate paths', () => {
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
        : /\/(approve|suspend|payout|rate)$/.test(path)
          ? { affiliate: { id: 'aff_1', org: 'orgA', code: 'acme', status: 'approved', rateBps: 2000 } }
          : { affiliates: [], summary: {} }
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
    await AdminAffiliatesApi.list()
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates`)
    expect(fetched[0].method).toBe('GET')
  })

  it('approves with an optional code override (POST)', async () => {
    const a = await AdminAffiliatesApi.approve('aff_1', 'acme')
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates/aff_1/approve`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('acme')
    expect(a.code).toBe('acme')
  })

  it('suspends (POST)', async () => {
    await AdminAffiliatesApi.suspend('aff_1')
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates/aff_1/suspend`)
    expect(fetched[0].method).toBe('POST')
  })

  it('records a payout (POST, amount+method+reference)', async () => {
    await AdminAffiliatesApi.payout('aff_1', { amountCents: 1200, method: 'credits', reference: 'ledger-1' })
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates/aff_1/payout`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('1200')
    expect(fetched[0].body).toContain('credits')
  })

  it('runs the accrual sweep (POST)', async () => {
    const r = await AdminAffiliatesApi.sweep()
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates/sweep`)
    expect(fetched[0].method).toBe('POST')
    expect(r).toEqual({ swept: 3, accrued: 1 })
  })

  it('sets the L1 rate (POST, rateBps)', async () => {
    const a = await AdminAffiliatesApi.setRate('aff_1', 2500)
    expect(fetched[0].url).toBe(`${API}/v1/admin/affiliates/aff_1/rate`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('2500')
    expect(a.id).toBe('aff_1')
  })
})
