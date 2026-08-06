import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  normalizeFunctions,
  normalizeFunction,
  normalizeTriggers,
  normalizeInvocations,
  normalizeFunctionDetail,
  normalizeMetrics,
  deriveOverview,
  namespacesOf,
  filterFunctions,
  paginate,
  summedSeries,
  trendPct,
  fmtInt,
  fmtCompact,
  fmtPct,
  fmtDuration,
  fmtUsd,
  fmtRelative,
  fmtAbs,
  FunctionsApi,
  type ServerlessFunction,
} from './functions'

/**
 * Functions API + pure logic. The page is wired to the DOCUMENTED contract
 * (`GET /v1/functions` on the canonical API host); these tests pin (1) that the
 * inventory call hits that exact path (not a fabricated endpoint), (2) that both the
 * enriched gateway shape and the raw Fission CRD shape normalize, and (3) that every
 * Overview metric is DERIVED from real rows and degrades to `null` (never invented)
 * when absent.
 */
/** The PAGE origin — where the console is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The API host — where it calls, whatever origin it was served from. */
const API = 'https://api.hanzo.ai'

const fn = (over: Partial<ServerlessFunction> = {}): ServerlessFunction => ({
  name: 'fn',
  namespace: 'default',
  status: 'ready',
  ...over,
})

describe('normalizeFunctions', () => {
  it('reads the enriched gateway shape ({ functions: [...] })', () => {
    const out = normalizeFunctions({
      functions: [
        { name: 'resize', namespace: 'media', image: 'ghcr.io/x/resize:1', invocationCount: 1200, successRate: 0.99, avgDurationMs: 142, status: 'ready' },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'resize', namespace: 'media', invocations7d: 1200, successRate: 0.99, avgDurationMs: 142 })
  })

  it('reads the raw Fission CRD list shape ({ items: [{ metadata, spec }] })', () => {
    const out = normalizeFunctions({
      items: [
        { metadata: { name: 'thumb', namespace: 'media', creationTimestamp: '2026-06-01T00:00:00Z' }, spec: { environment: { name: 'node' }, functionTimeout: 60, minScale: 1, maxScale: 4 } },
      ],
    })
    expect(out[0]).toMatchObject({ name: 'thumb', namespace: 'media', environment: 'node', timeoutSec: 60, minReplicas: 1, maxReplicas: 4 })
    expect(out[0].createdAt).toBe('2026-06-01T00:00:00Z')
  })

  it('drops rows without a name and tolerates junk', () => {
    expect(normalizeFunctions({ functions: [{ namespace: 'x' }, null, 42] })).toEqual([])
    expect(normalizeFunctions(undefined)).toEqual([])
    expect(normalizeFunctions({})).toEqual([])
  })

  it('counts env vars without reading their values', () => {
    expect(normalizeFunction({ name: 'a', env: { FOO: 'secret', BAR: 'secret2' } })?.envCount).toBe(2)
    expect(normalizeFunction({ name: 'a', env: ['FOO', 'BAR', 'BAZ'] })?.envCount).toBe(3)
  })
})

describe('normalizeTriggers / normalizeInvocations / detail', () => {
  it('normalizes triggers across shapes', () => {
    const out = normalizeTriggers({ triggers: [{ name: 'http-1', type: 'HTTP', enabled: true, route: '/resize' }] })
    expect(out[0]).toMatchObject({ name: 'http-1', type: 'HTTP', enabled: true })
  })

  it('defaults a CRD trigger to enabled unless spec.disabled', () => {
    const out = normalizeTriggers({ items: [{ metadata: { name: 't' }, spec: { relativeurl: '/x', disabled: true } }] })
    expect(out[0].enabled).toBe(false)
    expect(out[0].target).toBe('/x')
  })

  it('normalizes recent invocations', () => {
    const out = normalizeInvocations({ invocations: [{ id: 'r1', statusCode: 200, method: 'POST', durationMs: 42, time: '2026-06-29T00:00:00Z' }] })
    expect(out[0]).toMatchObject({ statusCode: 200, method: 'POST', durationMs: 42 })
  })

  it('builds detail = function + triggers + invocations', () => {
    const d = normalizeFunctionDetail({ name: 'resize', namespace: 'media', triggers: [{ name: 'h' }], invocations: [{ id: 'r1', statusCode: 200 }] })
    expect(d?.name).toBe('resize')
    expect(d?.triggers).toHaveLength(1)
    expect(d?.recentInvocations).toHaveLength(1)
  })
})

describe('normalizeMetrics', () => {
  it('reads series + status + cost, degrading missing to empty/null', () => {
    const m = normalizeMetrics({ series: [{ key: 'resize', points: [{ t: '1', v: 5 }, { t: '2', value: 7 }] }], status: { success: 90, timeout: 2, error: 8 }, costCents: 1234 })
    expect(m.series[0].key).toBe('resize')
    expect(m.series[0].points).toEqual([{ t: '1', v: 5 }, { t: '2', v: 7 }])
    expect(m.status).toEqual({ success: 90, timeout: 2, error: 8 })
    expect(m.costCents).toBe(1234)
  })

  it('returns empty/zero/null on an empty payload (no fabrication)', () => {
    const m = normalizeMetrics({})
    expect(m.series).toEqual([])
    expect(m.status).toEqual({ success: 0, timeout: 0, error: 0 })
    expect(m.costCents).toBeNull()
  })
})

describe('deriveOverview — real aggregates, honest null', () => {
  it('sums invocations and weights rates by invocation count', () => {
    const o = deriveOverview([
      fn({ invocations7d: 100, successRate: 1.0, avgDurationMs: 100 }),
      fn({ invocations7d: 300, successRate: 0.9, avgDurationMs: 200 }),
    ])
    expect(o.count).toBe(2)
    expect(o.invocations7d).toBe(400)
    // weighted: (100*1 + 300*0.9)/400 = 0.925
    expect(o.successRate).toBeCloseTo(0.925, 6)
    // weighted: (100*100 + 300*200)/400 = 175
    expect(o.avgDurationMs).toBeCloseTo(175, 6)
    // derived errors: 400 * (1 - 0.925) = 30
    expect(o.errors7d).toBe(30)
  })

  it('returns null metrics when no rows carry them (never invents)', () => {
    const o = deriveOverview([fn(), fn()])
    expect(o).toMatchObject({ count: 2, invocations7d: null, successRate: null, avgDurationMs: null, errors7d: null })
  })

  it('prefers explicit error counts over derivation', () => {
    expect(deriveOverview([fn({ invocations7d: 100, successRate: 0.5, errors7d: 7 })]).errors7d).toBe(7)
  })

  it('falls back to a simple mean when no invocation weights exist', () => {
    expect(deriveOverview([fn({ successRate: 0.8 }), fn({ successRate: 1.0 })]).successRate).toBeCloseTo(0.9, 6)
  })
})

describe('filters / namespaces / pagination', () => {
  const rows = [
    fn({ name: 'resize', namespace: 'media', status: 'ready', image: 'ghcr.io/x/resize' }),
    fn({ name: 'thumb', namespace: 'media', status: 'error' }),
    fn({ name: 'webhook', namespace: 'core', status: 'ready' }),
  ]

  it('filters by free-text search over name/namespace/image/env', () => {
    expect(filterFunctions(rows, { search: 'resize' }).map((r) => r.name)).toEqual(['resize'])
    expect(filterFunctions(rows, { search: 'MEDIA' }).map((r) => r.name)).toEqual(['resize', 'thumb'])
  })

  it('filters by namespace and status, with "all" as a no-op', () => {
    expect(filterFunctions(rows, { namespace: 'core' }).map((r) => r.name)).toEqual(['webhook'])
    expect(filterFunctions(rows, { status: 'error' }).map((r) => r.name)).toEqual(['thumb'])
    expect(filterFunctions(rows, { namespace: 'all', status: 'all' })).toHaveLength(3)
  })

  it('lists unique sorted namespaces', () => {
    expect(namespacesOf(rows)).toEqual(['core', 'media'])
  })

  it('paginates and clamps the page', () => {
    const p = paginate(rows, 5, 2)
    expect(p.totalPages).toBe(2)
    expect(p.page).toBe(2)
    expect(p.rows.map((r) => r.name)).toEqual(['webhook'])
  })
})

describe('series trend (real deltas only)', () => {
  it('sums multi-line series per bucket', () => {
    expect(summedSeries([
      { key: 'a', points: [{ t: '1', v: 1 }, { t: '2', v: 2 }] },
      { key: 'b', points: [{ t: '1', v: 3 }, { t: '2', v: 4 }] },
    ])).toEqual([4, 6])
  })

  it('computes second-half vs first-half percent change, or null when too short', () => {
    expect(trendPct([10, 10, 20, 20])).toBeCloseTo(100, 6)
    expect(trendPct([1, 2, 3])).toBeNull()
    expect(trendPct([0, 0, 5, 5])).toBeNull()
  })
})

describe('formatters', () => {
  it('formats integers, compact counts, percentages, durations, money', () => {
    expect(fmtInt(1234567)).toBe('1,234,567')
    expect(fmtCompact(1234567)).toBe('1.23M')
    expect(fmtCompact(950)).toBe('950')
    expect(fmtPct(0.992)).toBe('99.2%')
    expect(fmtPct(1)).toBe('100%')
    expect(fmtDuration(142)).toBe('142ms')
    expect(fmtDuration(1240)).toBe('1.24s')
    expect(fmtUsd(1234)).toBe('$12.34')
  })

  it('renders an em dash for every missing value (no fabrication)', () => {
    expect(fmtInt(null)).toBe('—')
    expect(fmtCompact(undefined)).toBe('—')
    expect(fmtPct(null)).toBe('—')
    expect(fmtDuration(undefined)).toBe('—')
    expect(fmtUsd(null)).toBe('—')
    expect(fmtRelative(null)).toBe('—')
    expect(fmtAbs(undefined)).toBe('—')
  })

  it('formats relative time against an injected now', () => {
    const now = Date.parse('2026-06-29T12:00:00Z')
    expect(fmtRelative('2026-06-29T11:59:30Z', now)).toBe('just now')
    expect(fmtRelative('2026-06-29T11:30:00Z', now)).toBe('30m ago')
    expect(fmtRelative('2026-06-29T09:00:00Z', now)).toBe('3h ago')
    expect(fmtRelative('2026-06-26T12:00:00Z', now)).toBe('3d ago')
  })
})

describe('FunctionsApi.list — hits the documented /v1/functions contract', () => {
  const fetched: string[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url)
      return Promise.resolve(
        new Response(JSON.stringify({ functions: [{ name: 'resize', namespace: 'media', status: 'ready' }] }), {
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

  it('fetches the inventory at /v1/functions and normalizes it', async () => {
    // The functions surface authorizes on the Bearer owner claim and 403s a cookie-only
    // call ("X-Org-Id required"). So the client calls the canonical, prefix-free
    // /v1/functions on the API host, carrying the session's bearer (org resolved from the
    // owner). Same contract as framework/s3/machines — every cloud path is /v1-rooted,
    // ZERO /cloud prefix.
    const out = await FunctionsApi.list()
    expect(fetched).toContain(`${API}/v1/functions`)
    expect(out.map((f) => f.name)).toEqual(['resize'])
  })
})
