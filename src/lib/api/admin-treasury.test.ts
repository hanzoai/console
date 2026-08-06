import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { AdminTreasuryApi, normalizeTreasury } from './admin-treasury'

/**
 * Admin treasury API + normalizers. The client hits the canonical API host
 * (`api.hanzo.ai/v1/admin/treasury…`, `originV1Url` → `config.cloudUrl`) — named, not
 * inherited from whatever origin serves the page. These tests pin the exact
 * `/v1/admin/treasury` paths (read + the four mutations) and the OPTIONAL-SAFE normalizer:
 * garbage/empty degrades to honest zeros/[]/false (never a fabricated ledger or a
 * faked "anchored" state), and a full valid payload parses correctly.
 */
// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://admin.hanzo.ai'
const API = 'https://api.hanzo.ai'

describe('normalizeTreasury — optional-safe (honest empties, never fabricated)', () => {
  it('degrades null/garbage to real zeros/[]/false (never throws)', () => {
    const v = normalizeTreasury(null)
    expect(v.report).toEqual({
      reserveCents: 0,
      accruedCents: 0,
      paidCents: 0,
      byProgramCents: { referral: 0, affiliate: 0, author: 0 },
      policy: { revenueShareBps: 0, updatedAt: 0 },
      solventForPayout: false,
    })
    expect(v.journal).toEqual([])
    expect(v.anchor).toMatchObject({
      chainId: 0,
      rpcConfigured: false,
      signerConfigured: false,
      contract: '',
      currentRoot: '',
      entryCount: 0,
      status: 'pending', // honest default, never faked "anchored"
      synced: false,
      lastBlock: 0,
      lastAt: 0,
    })
    // Total garbage shapes still yield the honest-empty view.
    expect(normalizeTreasury(42).journal).toEqual([])
    expect(normalizeTreasury('nope').report.reserveCents).toBe(0)
    // A journal entry with no id is dropped (honest — no phantom rows).
    expect(normalizeTreasury({ journal: [null, { kind: 'seed' }, { id: 'j1', kind: 'seed' }] }).journal.map((e) => e.id)).toEqual(['j1'])
  })

  it('parses a full valid payload — report + journal with signed postings + anchor', () => {
    const v = normalizeTreasury({
      report: {
        reserveCents: 250000,
        accruedCents: 400000,
        paidCents: 150000,
        byProgramCents: { referral: 50000, affiliate: 60000, author: 40000 },
        policy: { revenueShareBps: 500, updatedAt: 1_700_000_000 },
        solventForPayout: true,
      },
      journal: [
        {
          id: 'j2',
          kind: 'payout',
          program: 'referral',
          ref: 'pay_9',
          memo: 'Referral payout',
          amountCents: 5000,
          createdAt: 1_700_000_500,
          postings: [
            { account: 'reserve', amount: -5000 },
            { account: 'payable:referral', amount: 5000 },
          ],
        },
        {
          id: 'j1',
          kind: 'accrual',
          program: '',
          ref: '2026-07',
          memo: 'Revenue-share sweep',
          amountCents: 12500,
          createdAt: '1700000000', // string coercion
          postings: [
            { account: 'revenue', amount: -12500 },
            { account: 'reserve', amount: 12500 },
          ],
        },
      ],
      anchor: {
        chainId: 36963,
        rpcConfigured: true,
        signerConfigured: true,
        contract: '0xC0FFEE0000000000000000000000000000000000',
        currentRoot: '0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890',
        entryCount: 2,
        status: 'anchored',
        note: 'anchored on Hanzo L1',
        lastRoot: '0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890',
        lastTxHash: '0xdeadbeef',
        lastBlock: 4242,
        lastAt: 1_700_000_600,
        synced: true,
      },
    })

    expect(v.report).toMatchObject({
      reserveCents: 250000,
      accruedCents: 400000,
      paidCents: 150000,
      byProgramCents: { referral: 50000, affiliate: 60000, author: 40000 },
      policy: { revenueShareBps: 500, updatedAt: 1_700_000_000 },
      solventForPayout: true,
    })
    // Journal preserved order, ids intact, postings parsed with signed amounts.
    expect(v.journal.map((e) => e.id)).toEqual(['j2', 'j1'])
    expect(v.journal[0].postings).toEqual([
      { account: 'reserve', amount: -5000 },
      { account: 'payable:referral', amount: 5000 },
    ])
    // Signed postings net to zero (double-entry invariant).
    for (const e of v.journal) {
      expect(e.postings.reduce((s, p) => s + p.amount, 0)).toBe(0)
    }
    // String createdAt coerced to an int.
    expect(v.journal[1].createdAt).toBe(1_700_000_000)
    expect(v.anchor).toMatchObject({
      chainId: 36963,
      rpcConfigured: true,
      signerConfigured: true,
      entryCount: 2,
      status: 'anchored',
      lastBlock: 4242,
      synced: true,
    })
    expect(v.anchor.currentRoot).toContain('0xabc123')
  })
})

describe('AdminTreasuryApi — hits the canonical-API admin aggregate paths', () => {
  const fetched: { url: string; method: string; body: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'admin.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url: String(url), method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      const path = String(url)
      let data: unknown
      if (path.endsWith('/treasury/policy')) data = { policy: { revenueShareBps: 750, updatedAt: 123 } }
      else if (path.endsWith('/treasury/sweep')) data = { period: '2026-07', revenueCents: 100000, accruedCents: 5000, created: true, reserveCents: 255000 }
      else if (path.endsWith('/treasury/seed')) data = { entry: { id: 's1', kind: 'seed', amountCents: 10000 }, created: true, reserveCents: 260000 }
      else if (path.endsWith('/treasury/anchor')) data = { anchor: { chainId: 36963, status: 'anchored', synced: true, entryCount: 3 } }
      else data = { report: {}, journal: [], anchor: {} }
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

  it('reads via the canonical-API admin path', async () => {
    await AdminTreasuryApi.get()
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury`)
    expect(fetched[0].method).toBe('GET')
  })

  it('sets the revenue-share policy (POST, revenueShareBps)', async () => {
    const p = await AdminTreasuryApi.setPolicy(750)
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury/policy`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('revenueShareBps')
    expect(fetched[0].body).toContain('750')
    expect(p).toEqual({ revenueShareBps: 750, updatedAt: 123 })
  })

  it('sweeps revenue-share with an optional period (POST)', async () => {
    const r = await AdminTreasuryApi.sweep(100000, '2026-07')
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury/sweep`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('100000')
    expect(fetched[0].body).toContain('2026-07')
    expect(r).toMatchObject({ period: '2026-07', accruedCents: 5000, created: true, reserveCents: 255000 })
  })

  it('sweeps without a period when none is given (no period key)', async () => {
    await AdminTreasuryApi.sweep(100000)
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury/sweep`)
    expect(fetched[0].body).not.toContain('period')
  })

  it('seeds the reserve (POST, amount+memo)', async () => {
    const r = await AdminTreasuryApi.seed(10000, 'Q3 capitalization')
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury/seed`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('10000')
    expect(fetched[0].body).toContain('Q3 capitalization')
    expect(r).toMatchObject({ created: true, reserveCents: 260000 })
    expect(r.entry.id).toBe('s1')
  })

  it('anchors the current journal root on the Hanzo L1 (POST)', async () => {
    const a = await AdminTreasuryApi.anchor()
    expect(fetched[0].url).toBe(`${API}/v1/admin/treasury/anchor`)
    expect(fetched[0].method).toBe('POST')
    expect(a).toMatchObject({ chainId: 36963, status: 'anchored', synced: true, entryCount: 3 })
  })
})
