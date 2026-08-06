import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  ALWAYS_ON_PRODUCTS,
  isAlwaysOn,
  entitledSet,
  filterEntitled,
  nextEnabled,
} from './entitlements'

describe('entitlements — always-on essentials', () => {
  it('marks the money/org essentials as always-on', () => {
    for (const id of ['overview', 'billing', 'usage', 'settings', 'team', 'profile', 'api-keys']) {
      expect(isAlwaysOn(id)).toBe(true)
    }
  })
  it('does not mark a normal product as always-on', () => {
    expect(isAlwaysOn('agents')).toBe(false)
    expect(isAlwaysOn('vector')).toBe(false)
  })
})

describe('entitledSet — ungated vs gated', () => {
  it('null/undefined enabled → null (ungated: show everything)', () => {
    expect(entitledSet(null)).toBeNull()
    expect(entitledSet(undefined)).toBeNull()
  })
  it('a real set unions the always-on essentials with the enabled ids', () => {
    const set = entitledSet(['agents', 'vector'])!
    expect(set.has('agents')).toBe(true)
    expect(set.has('vector')).toBe(true)
    // essentials are always present even if not in the enabled list
    for (const id of ALWAYS_ON_PRODUCTS) expect(set.has(id)).toBe(true)
    // a non-enabled product is absent
    expect(set.has('gpus')).toBe(false)
  })
})

describe('filterEntitled — the ONE gate predicate', () => {
  const entries = [
    { id: 'overview' },
    { id: 'billing' },
    { id: 'agents' },
    { id: 'vector' },
    { id: 'gpus' },
  ]

  it('a super admin sees everything regardless of the set', () => {
    expect(filterEntitled(entries, [], true).map((e) => e.id)).toEqual(entries.map((e) => e.id))
    expect(filterEntitled(entries, ['agents'], true)).toHaveLength(entries.length)
  })

  it('ungated (null) shows everything — no regression before the endpoint lands', () => {
    expect(filterEntitled(entries, null, false)).toHaveLength(entries.length)
  })

  it('a customer sees only always-on + enabled products', () => {
    const ids = filterEntitled(entries, ['agents'], false).map((e) => e.id)
    expect(ids).toContain('overview') // always-on
    expect(ids).toContain('billing') // always-on
    expect(ids).toContain('agents') // enabled
    expect(ids).not.toContain('vector') // not enabled
    expect(ids).not.toContain('gpus') // not enabled
  })

  it('a fresh org with no enabled products still sees the essentials', () => {
    const ids = filterEntitled(entries, [], false).map((e) => e.id)
    expect(ids).toEqual(['overview', 'billing'])
  })

  it('does not mutate the input array', () => {
    const input = [{ id: 'agents' }]
    filterEntitled(input, [], false)
    expect(input).toHaveLength(1)
  })
})

describe('nextEnabled — pure add/remove', () => {
  it('adds, dedupes and sorts', () => {
    expect(nextEnabled(['vector'], { add: ['agents', 'vector'] })).toEqual(['agents', 'vector'])
  })
  it('removes', () => {
    expect(nextEnabled(['agents', 'vector'], { remove: ['vector'] })).toEqual(['agents'])
  })
  it('remove wins over add for the same id in one patch', () => {
    expect(nextEnabled([], { add: ['agents'], remove: ['agents'] })).toEqual([])
  })
  it('never stores an always-on id (it is implicit)', () => {
    expect(nextEnabled([], { add: ['billing', 'agents'] })).toEqual(['agents'])
  })
})

/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

describe('EntitlementsApi — /v1 client contract (mock until the endpoint lands)', () => {
  const origWindow = (globalThis as { window?: unknown }).window
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { window?: unknown }).window = { location: { origin: ORIGIN } }
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    ;(globalThis as { window?: unknown }).window = origWindow
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const ok = (body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))

  it('GET hits /v1/orgs/{org}/entitlements on the canonical API host', async () => {
    fetchMock.mockReturnValue(ok({ enabled: ['agents', 'vector'] }))
    const { EntitlementsApi } = await import('./entitlements')
    const res = await EntitlementsApi.get('maxpower')
    expect(res.enabled).toEqual(['agents', 'vector'])
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toBe(`${API}/v1/orgs/maxpower/entitlements`)
  })

  it('normalizes a garbage payload to an honest empty enabled list', async () => {
    fetchMock.mockReturnValue(ok({ nonsense: true }))
    const { EntitlementsApi } = await import('./entitlements')
    expect((await EntitlementsApi.get('maxpower')).enabled).toEqual([])
  })

  it('POST sends the patch body to the same path', async () => {
    fetchMock.mockReturnValue(ok({ enabled: ['agents'] }))
    const { EntitlementsApi } = await import('./entitlements')
    const res = await EntitlementsApi.update('maxpower', { add: ['agents'] })
    expect(res.enabled).toEqual(['agents'])
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(String(calledUrl)).toBe(`${API}/v1/orgs/maxpower/entitlements`)
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ add: ['agents'] })
  })
})
