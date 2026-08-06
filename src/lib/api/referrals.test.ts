import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ReferralsApi, normalizeOverview, normalizeMyReferral, normalizeClaim } from './referrals'

/**
 * Referrals API + pure normalizers. The client calls the cloud `/v1/referrals`
 * contract on the CANONICAL API host (`cloudProxyV1Url` → `originV1Url` →
 * `config.cloudUrl` = api.hanzo.ai) — the host is NAMED, not inherited from
 * wherever the bundle is served, so the page origin below is irrelevant to it.
 * These tests pin (1) that each call hits the EXACT `/v1/referrals` path on that
 * host, (2) the real store JSON shape normalizes, and (3) a garbage/absent field
 * degrades to a safe default.
 */
/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

describe('Referrals normalizers — real cloud JSON shape, defensive', () => {
  it('normalizes the overview with all fields', () => {
    const o = normalizeOverview({
      code: 'ABC123XY',
      link: 'https://hanzo.ai/?ref=ABC123XY',
      referrerBonusCents: 1000,
      refereeBonusCents: 500,
      creditsEarnedCents: 2000,
      counts: { total: 3, signup: 1, qualified: 0, credited: 2 },
      referrals: [
        { id: 'ref_1', referee: 'orgB', status: 'credited', creditsCents: 1000, createdAt: 5, qualifiedAt: 6, creditedAt: 6 },
        { id: 'ref_2', referee: 'orgC', status: 'signup', creditsCents: 0, createdAt: 7, qualifiedAt: 0, creditedAt: 0 },
      ],
    })
    expect(o).toMatchObject({
      code: 'ABC123XY',
      link: 'https://hanzo.ai/?ref=ABC123XY',
      referrerBonusCents: 1000,
      refereeBonusCents: 500,
      creditsEarnedCents: 2000,
      counts: { total: 3, signup: 1, qualified: 0, credited: 2 },
    })
    expect(o.referrals.map((r) => r.id)).toEqual(['ref_1', 'ref_2'])
    expect(o.referrals[0].status).toBe('credited')
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const o = normalizeOverview(null)
    expect(o).toMatchObject({ code: '', link: '', creditsEarnedCents: 0 })
    expect(o.counts).toEqual({ total: 0, signup: 0, qualified: 0, credited: 0 })
    expect(o.referrals).toEqual([])
    // A row with no id is filtered out of the list.
    expect(normalizeOverview({ referrals: [null, 'x', { id: 'ref_9', referee: 'z' }] }).referrals.map((r) => r.id)).toEqual([
      'ref_9',
    ])
    // A row defaults status to signup.
    expect(normalizeMyReferral({ id: 'ref_x' }).status).toBe('signup')
    // Numeric coercion from strings.
    expect(normalizeMyReferral({ id: 'r', creditsCents: '1500' }).creditsCents).toBe(1500)
  })

  it('normalizes a claim result', () => {
    expect(normalizeClaim({ id: 'ref_1', code: 'ABC', status: 'signup', created: true, createdAt: 9 })).toEqual({
      id: 'ref_1',
      code: 'ABC',
      status: 'signup',
      created: true,
      createdAt: 9,
    })
    // created is strict-boolean; a missing field → false.
    expect(normalizeClaim({ id: 'r' }).created).toBe(false)
  })
})

describe('ReferralsApi — hits /v1/referrals on the canonical API host', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.endsWith('/claim')
        ? { id: 'ref_1', code: 'ABC', status: 'signup', created: true, createdAt: 1 }
        : { code: 'ABC', link: 'https://hanzo.ai/?ref=ABC', counts: {}, referrals: [] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads the overview at /v1/referrals on the canonical API host (prefix-free /v1, never a /cloud-prefixed call)', async () => {
    const out = await ReferralsApi.overview()
    expect(fetched[0]).toEqual({ url: `${API}/v1/referrals`, method: 'GET' })
    expect(out.code).toBe('ABC')
  })

  it('claims a referral with POST to the same host', async () => {
    const r = await ReferralsApi.claim('ABC')
    expect(fetched[0]).toEqual({ url: `${API}/v1/referrals/claim`, method: 'POST' })
    expect(r.created).toBe(true)
  })
})
