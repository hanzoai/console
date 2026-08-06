import { describe, it, expect, afterEach, vi } from 'vitest'

import { PlansApi } from './plans'

/** The PAGE origin — where the SPA is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The canonical API host every `/v1` call resolves against, whatever origin serves the page. */
const API = 'https://api.hanzo.ai'

/** A captured request URL for asserting the exact path the client hit. */
let lastUrl = ''

/**
 * Stub `window` + a `fetch` that RECORDS the request URL and replies with `body`.
 * Mirrors the commerce `/v1/billing/plans` wire shape: a BARE ARRAY of `staticPlan`
 * records with prices in CENTS.
 */
function stubPlans(body: unknown, status = 200): void {
  lastUrl = ''
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  vi.stubGlobal('fetch', (url: string) => {
    lastUrl = String(url)
    return Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    )
  })
}

function teardown(): void {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
}

/** A commerce `staticPlan` record (cents), as GET /v1/billing/plans emits it. */
function plan(o: Record<string, unknown>): Record<string, unknown> {
  return { currency: 'usd', interval: 'monthly', intervalCount: 1, trialPeriodDays: 0, ...o }
}

/** The real cloud subscription catalog, cents-denominated, in JSON source order. */
const CATALOG = [
  plan({ slug: 'developer', name: 'Developer', description: 'Free', category: 'personal', price: 0, priceAnnual: 0, features: ['$5 free credit'], limits: { requestsPerMinute: 60, freeCredit: 5 } }),
  plan({ slug: 'pro', name: 'Pro', description: 'For builders', category: 'personal', price: 4900, priceAnnual: 3900, popular: true, features: ['500 requests/min', '1M tokens/min'], limits: { requestsPerMinute: 500, tokensPerMinute: 1_000_000 } }),
  plan({ slug: 'max', name: 'Max', description: 'Max power', category: 'personal', price: 20000, priceAnnual: 16000, features: ['5000 requests/min'], limits: { requestsPerMinute: 5000, includedCloudCredits: 100 } }),
  plan({ slug: 'team', name: 'Team', description: 'For teams', category: 'team', price: 19900, priceAnnual: 15900, features: ['SSO'], limits: { maxMembers: 10 } }),
  plan({ slug: 'team-max', name: 'Team Max', description: 'Team, maxed', category: 'team', price: 22500, priceAnnual: 18000, features: ['Priority'] }),
  plan({ slug: 'enterprise', name: 'Enterprise', description: 'Full scale', category: 'enterprise', price: 999900, priceAnnual: 799900, features: ['99.99% SLA'] }),
  plan({ slug: 'custom', name: 'Custom', description: 'Bespoke', category: 'enterprise', price: 0, contactSales: true, features: ['Custom SLA'] }),
  // Separate product lines that MUST be filtered off the cloud account grid.
  plan({ slug: 'world-pro', name: 'World Pro', description: 'OSINT', category: 'world', price: 2900, popular: true, features: [] }),
  plan({ slug: 'social-team', name: 'Social Team', description: 'Social', category: 'social', price: 3900, features: [] }),
  plan({ slug: 'dns-pro', name: 'DNS Pro', description: 'DNS', category: 'dns', price: 500, features: [] }),
]

describe('PlansApi.plans', () => {
  afterEach(teardown)

  it('reads the per-tenant billing proxy directly (NOT a bare /v1/pricing or /v1/plans that 401s live)', async () => {
    stubPlans(CATALOG)
    await PlansApi.plans()
    expect(lastUrl).toBe(`${API}/v1/billing/plans`)
  })

  it('maps commerce cents -> whole dollars and carries the Pro tier at $49/mo, popular', async () => {
    stubPlans(CATALOG)
    const plans = await PlansApi.plans()
    const pro = plans.find((p) => p.id === 'pro')
    expect(pro).toBeDefined()
    expect(pro!.priceMonthly).toBe(49)
    expect(pro!.priceAnnual).toBe(39)
    expect(pro!.popular).toBe(true)
    expect(pro!.currency).toBe('usd')
    expect(pro!.features).toEqual(['500 requests/min', '1M tokens/min'])
    expect(pro!.limits?.requestsPerMinute).toBe(500)
    expect(pro!.limits?.tokensPerMinute).toBe(1_000_000)
  })

  it('filters to the cloud ACCOUNT tiers (personal/team/enterprise) — world/social/dns are separate products', async () => {
    stubPlans(CATALOG)
    const plans = await PlansApi.plans()
    expect(plans.map((p) => p.id)).not.toContain('world-pro')
    expect(plans.map((p) => p.id)).not.toContain('social-team')
    expect(plans.map((p) => p.id)).not.toContain('dns-pro')
    expect(new Set(plans.map((p) => p.category))).toEqual(new Set(['personal', 'team', 'enterprise']))
  })

  it('flags quote tiers as contact-sales (Enterprise >= $9,999, Custom flag) but not the free Developer tier', async () => {
    stubPlans(CATALOG)
    const plans = await PlansApi.plans()
    const by = (id: string) => plans.find((p) => p.id === id)!
    expect(by('enterprise').contactSales).toBe(true)
    expect(by('custom').contactSales).toBe(true)
    expect(by('developer').contactSales).toBe(false)
    expect(by('developer').priceMonthly).toBe(0)
    expect(by('pro').contactSales).toBe(false)
  })

  it('orders the grid by category then cheapest-first, contact-sales last within a category', async () => {
    stubPlans(CATALOG)
    const plans = await PlansApi.plans()
    expect(plans.map((p) => p.id)).toEqual([
      'developer',
      'pro',
      'max',
      'team',
      'team-max',
      'enterprise',
      'custom',
    ])
  })

  it('degrades to [] when the catalog is not an array (honest, never a fabricated tier)', async () => {
    stubPlans({ error: 'nope' })
    expect(await PlansApi.plans()).toEqual([])
  })
})
