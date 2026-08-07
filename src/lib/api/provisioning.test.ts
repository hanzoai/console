import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProvisioningApi, normalizeResourceList, type ResourceKind } from './provisioning'

/**
 * The provisioning list must ALWAYS reduce to a `Resource[]`. A managed backend
 * that 200s with a wrapper object (the Vector regression) would otherwise reach
 * the list view's `for…of` / `.length` as a non-iterable and blank the module.
 * These pin the honest unwrap-or-empty contract at the transport boundary.
 */
describe('normalizeResourceList', () => {
  const row = { id: '1', name: 'a', kind: 'vector', status: 'ready', host: 'h', port: 6333 }

  it('passes a bare array through', () => {
    expect(normalizeResourceList([row])).toEqual([row])
  })

  it('unwraps common envelope keys', () => {
    expect(normalizeResourceList({ data: [row] })).toEqual([row])
    expect(normalizeResourceList({ items: [row] })).toEqual([row])
    expect(normalizeResourceList({ results: [row] })).toEqual([row])
    expect(normalizeResourceList({ collections: [row] })).toEqual([row])
    expect(normalizeResourceList({ rows: [row] })).toEqual([row])
  })

  it('unwraps one level of nesting (e.g. Qdrant `result.collections`)', () => {
    expect(normalizeResourceList({ result: { collections: [row] } })).toEqual([row])
  })

  it('keeps an honest empty array for wrapped-but-empty', () => {
    expect(normalizeResourceList({ data: [] })).toEqual([])
    expect(normalizeResourceList({ result: {} })).toEqual([])
  })

  it('never crashes on a non-list body — degrades to []', () => {
    expect(normalizeResourceList(null)).toEqual([])
    expect(normalizeResourceList(undefined)).toEqual([])
    expect(normalizeResourceList('oops')).toEqual([])
    expect(normalizeResourceList(42)).toEqual([])
    expect(normalizeResourceList({})).toEqual([])
    expect(normalizeResourceList({ error: 'boom' })).toEqual([])
  })

  it('drops non-object elements defensively', () => {
    expect(normalizeResourceList([row, null, 'x', 3, row])).toEqual([row, row])
  })
})

/**
 * Transport contract — every provisioning call MUST address the console's OWN-origin
 * `/v1` user-bearer proxy (`<origin>/v1/<kind>`), never a bare `/v1/<kind>`.
 * A bare `/v1/*` is routed straight to hanzoai/gateway on the live ingress (no minted
 * Bearer) and 403s "X-Org-Id required", surfacing as a FALSE "Not enabled for your
 * account". These pin the fix so the class-bug can never silently return.
 */
describe('ProvisioningApi transport → /v1 bearer BFF', () => {
  const ORIGIN = 'https://console.hanzo.ai'
  let lastUrl = ''

  beforeEach(() => {
    lastUrl = ''
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    vi.stubGlobal('fetch', (url: string) => {
      lastUrl = String(url)
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  const kinds: ResourceKind[] = ['sql', 'vector', 'datastore', 'kv', 'search', 's3', 'docdb']

  it.each(kinds)('list(%s) hits <origin>/v1/<kind> (prefix-free, ZERO /cloud)', async (kind) => {
    await ProvisioningApi.list(kind)
    expect(lastUrl).toBe(`${ORIGIN}/v1/${kind}`)
    expect(lastUrl).not.toMatch(new RegExp(`^${ORIGIN}/(cloud|vm|ai|billing|commerce)/v1/`))
  })

  it('get/create/remove address the same /v1 bearer BFF', async () => {
    await ProvisioningApi.get('vector', 'gooo')
    expect(lastUrl).toBe(`${ORIGIN}/v1/vector/gooo`)
    await ProvisioningApi.create('vector', 'gooo')
    expect(lastUrl).toBe(`${ORIGIN}/v1/vector`)
    await ProvisioningApi.remove('vector', 'gooo')
    expect(lastUrl).toBe(`${ORIGIN}/v1/vector/gooo`)
  })
})
