import { describe, it, expect, afterEach, vi } from 'vitest'
import { UsageSummaryApi, normalizeSummary } from './usage-summary'

/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

function stubJson(body: unknown, status = 200): { url: string } {
  const captured = { url: '' }
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  vi.stubGlobal('fetch', (url: string) => {
    captured.url = String(url)
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
  })
  return captured
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

describe('normalizeSummary — defensive, never throws', () => {
  it('maps a full backend payload (scope.org, spend, llm, sources)', () => {
    const s = normalizeSummary({
      range: '30d', start: 'A', end: 'B', interval: 'day', scope: { org: 'maxpower' },
      spend: {
        available: true, totalCents: 650, mtdCents: 5000, overageCents: 100,
        balanceCents: 20000, availableCents: 15000,
        byCategory: [{ category: 'GPU', cents: 450, count: 2 }, { category: 'LLM', cents: 200, count: 1 }],
        series: [{ t: 'T1', cents: 500 }, { t: 'T2', cents: 150 }],
      },
      llm: { available: true, requests: 12, tokens: 3400, promptTokens: 3000, completionTokens: 400, costCents: 87, models: 3 },
      sources: { commerce: true, warehouse: false },
    })
    expect(s.org).toBe('maxpower')
    expect(s.spend.totalCents).toBe(650)
    expect(s.spend.availableCents).toBe(15000)
    expect(s.spend.byCategory).toHaveLength(2)
    expect(s.spend.byCategory[0]).toEqual({ category: 'GPU', cents: 450, count: 2 })
    expect(s.spend.series[0]).toEqual({ t: 'T1', cents: 500 })
    expect(s.llm.tokens).toBe(3400)
    expect(s.sources).toEqual({ commerce: true, warehouse: false })
  })

  it('degrades a garbage/empty payload to honest zeros + empty arrays', () => {
    const s = normalizeSummary(null)
    expect(s.spend.available).toBe(false)
    expect(s.spend.totalCents).toBe(0)
    expect(s.spend.byCategory).toEqual([])
    expect(s.spend.series).toEqual([])
    expect(s.llm.available).toBe(false)
    expect(s.sources).toEqual({ commerce: false, warehouse: false })
  })

  it('coerces string-number cells and ignores non-object array entries', () => {
    const s = normalizeSummary({ spend: { totalCents: '999', byCategory: [null, { category: 'X', cents: '5' }, 3] } })
    expect(s.spend.totalCents).toBe(999)
    expect(s.spend.byCategory).toEqual([{ category: 'X', cents: 5, count: 0 }])
  })
})

describe('UsageSummaryApi.summary — /v1/usage/summary on the canonical API host', () => {
  it('GETs the clean canonical URL with the range and decodes the payload', async () => {
    const cap = stubJson({ scope: { org: 'maxpower' }, spend: { available: true, totalCents: 42 }, sources: { commerce: true } })
    const s = await UsageSummaryApi.summary('7d')
    expect(cap.url).toBe(`${API}/v1/usage/summary?range=7d`)
    expect(s.org).toBe('maxpower')
    expect(s.spend.totalCents).toBe(42)
  })

  it('passes custom start/end through', async () => {
    const cap = stubJson({})
    await UsageSummaryApi.summary('30d', { start: '2026-07-01', end: '2026-07-03' })
    expect(cap.url).toContain('range=30d')
    expect(cap.url).toContain('start=2026-07-01')
    expect(cap.url).toContain('end=2026-07-03')
  })
})
