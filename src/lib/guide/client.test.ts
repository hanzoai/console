import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  GuideBlueprintApi,
  strategyQuery,
  normalizeBlueprint,
  normalizeProfile,
  normalizeSuggest,
} from './client'

/**
 * GuideBlueprintApi + pure normalizers + `strategyQuery` shaping. The SuperAdmin client
 * calls the cloud `/v1/guide/*` blueprint contract through the console's `/v1` user-bearer
 * proxy (`cloudProxyV1Url` → `<origin>/v1/guide/...` — the live-ingress-safe form for a
 * bearer-scoped head; a bare `/v1/guide` 403s on the gateway). These pin (1) that each call
 * hits the EXACT `/v1/guide/...` path + verb, (2) the real blueprint/profile/suggest JSON
 * normalizes, and (3) a garbage/absent field degrades to a safe default (never throws).
 */
const ORIGIN = 'https://admin.hanzo.ai'

describe('strategyQuery — the corpus filter querystring', () => {
  it('is empty for no filter or an all-empty filter', () => {
    expect(strategyQuery()).toBe('')
    expect(strategyQuery({})).toBe('')
    expect(strategyQuery({ category: '', stage: '', workload: '' })).toBe('')
  })

  it('omits empty facets and keeps the canonical order', () => {
    expect(strategyQuery({ category: 'growth' })).toBe('?category=growth')
    const qs = strategyQuery({ category: 'growth', stage: 'launched', workload: 'gpu' })
    const p = new URLSearchParams(qs.replace(/^\?/, ''))
    expect(p.get('category')).toBe('growth')
    expect(p.get('stage')).toBe('launched')
    expect(p.get('workload')).toBe('gpu')
  })
})

describe('blueprint normalizers — real cloud JSON, defensive', () => {
  it('normalizes the full authored blueprint with archetypes, steps, strategies', () => {
    const bp = normalizeBlueprint({
      version: 'v3',
      brand: 'hanzo',
      title: 'The Zen of Hanzo',
      enabled: true,
      principles: [
        { n: 1, hexagram: '☰', slug: 'the-creative', name: 'The Creative', principle: 'Initiate boldly', change: '乾', sun_tzu: 'Energy', domain: 'vision' },
      ],
      steps: [
        { id: 'connect-analytics', section: 'measure', title: 'Connect analytics', detail: 'Wire the tag', tool: 'analytics', dependencies: ['create-site'], enabled: false },
      ],
      strategies: [
        { id: 's1', principle: 'the-creative', category: 'acquisition', workload: 'content', action: 'Ship a launch post', tags: ['seo', 'launch'], source: 'modern', era: '2020s', blog: { why: 'Reach', how: 'Publish', case_study: 'Acme +40%' } },
      ],
      templates: [{ id: 't1', name: 'Launch email', category: 'email', body: 'Hi {name}' }],
      sections: [{ id: 'measure', title: 'Measure', order: 2 }],
    })
    expect(bp.version).toBe('v3')
    expect(bp.principles[0]).toMatchObject({ n: 1, name: 'The Creative', sunTzu: 'Energy', domain: 'vision', enabled: true })
    // deps read from `dependencies`; explicit false disables.
    expect(bp.steps[0]).toMatchObject({ id: 'connect-analytics', tool: 'analytics', enabled: false })
    expect(bp.steps[0].deps).toEqual(['create-site'])
    // blog stub why/how/case-study (snake_case tolerated).
    expect(bp.strategies[0].blog).toEqual({ why: 'Reach', how: 'Publish', caseStudy: 'Acme +40%' })
    expect(bp.strategies[0].tags).toEqual(['seo', 'launch'])
    // template title reads from `name`; section detail defaults to ''.
    expect(bp.templates[0].title).toBe('Launch email')
    expect(bp.sections[0]).toMatchObject({ id: 'measure', order: 2, enabled: true })
  })

  it('coerces garbage/absent to safe defaults and treats a missing enabled as ON', () => {
    const bp = normalizeBlueprint(null)
    expect(bp).toMatchObject({ version: '', brand: '', enabled: true })
    expect(bp.principles).toEqual([])
    expect(bp.strategies).toEqual([])
    // A present item with no `enabled` flag reads as enabled (authored default);
    // only an explicit false is disabled.
    const on = normalizeBlueprint({ steps: [{ id: 'x' }] }).steps[0]
    expect(on.enabled).toBe(true)
    const off = normalizeBlueprint({ steps: [{ id: 'y', enabled: false }] }).steps[0]
    expect(off.enabled).toBe(false)
    // A string blog degrades into the case-study slot.
    expect(normalizeBlueprint({ strategies: [{ id: 's', blog: 'https://blog/x' }] }).strategies[0].blog).toEqual({
      why: '',
      how: '',
      caseStudy: 'https://blog/x',
    })
  })

  it('normalizes the live profile (signals + keyMetrics funnel, snake_case)', () => {
    const p = normalizeProfile({
      stage: 'launched',
      signals: { hasAnalytics: true, hasBilling: 0, hasDomain: 'true' },
      key_metrics: { funnel: { pageviews: 1200, visitors: 800, signups: 60, orders: 12 }, revenue_cents: 34500, records: 9, launch_progress: 55 },
    })
    expect(p.stage).toBe('launched')
    expect(p.signals).toEqual({ hasAnalytics: true, hasBilling: false, hasDomain: true })
    expect(p.keyMetrics.funnel).toMatchObject({ pageviews: 1200, signups: 60, orders: 12 })
    expect(p.keyMetrics.revenueCents).toBe(34500)
    expect(p.keyMetrics.launchProgress).toBe(55)
    // Empty profile → honest defaults (stage falls back to 'formed').
    expect(normalizeProfile(null)).toMatchObject({ stage: 'formed', signals: {} })
  })

  it('normalizes the ranked next-best moves', () => {
    const s = normalizeSuggest({
      next: 'connect-analytics',
      suggestions: [
        { step_id: 'connect-analytics', title: 'Connect analytics', why: 'See traffic', rationale: 'High leverage', automatable: true, unlocks: 3 },
        null,
      ],
      recommendations: ['Turn on the funnel', ''],
    })
    expect(s.next).toBe('connect-analytics')
    expect(s.suggestions).toHaveLength(1)
    expect(s.suggestions[0]).toMatchObject({ stepId: 'connect-analytics', automatable: true, unlocks: 3 })
    expect(s.recommendations).toEqual(['Turn on the funnel'])
    expect(normalizeSuggest(null)).toEqual({ next: '', suggestions: [], recommendations: [] })
  })
})

describe('GuideBlueprintApi — hits the exact /v1/guide/* bearer-proxy paths', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'admin.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.includes('/versions') ? { versions: [] } : url.includes('/strategies') ? { strategies: [] } : {}
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads the blueprint via the /v1 bearer BFF (prefix-free /v1)', async () => {
    await GuideBlueprintApi.blueprint()
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/blueprint`, method: 'GET' })
  })

  it('PATCHes one item at /blueprint/:collection/:id (the enable/disable lever)', async () => {
    await GuideBlueprintApi.patchItem('steps', 'connect-analytics', { enabled: false })
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/blueprint/steps/connect-analytics`, method: 'PATCH' })
  })

  it('PUTs the whole blueprint to publish a version', async () => {
    await GuideBlueprintApi.publish({ version: 'v3' })
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/blueprint`, method: 'PUT' })
  })

  it('reads the version history', async () => {
    await GuideBlueprintApi.versions()
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/blueprint/versions`, method: 'GET' })
  })

  it('filters the corpus with the query facets', async () => {
    await GuideBlueprintApi.strategies({ category: 'acquisition', workload: 'content' })
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/strategies?category=acquisition&workload=content`, method: 'GET' })
  })

  it('reads the live profile and the ranked suggestions', async () => {
    await GuideBlueprintApi.profile()
    await GuideBlueprintApi.suggest()
    expect(fetched.map((f) => f.url)).toEqual([`${ORIGIN}/v1/guide/profile`, `${ORIGIN}/v1/guide/suggest`])
  })
})
