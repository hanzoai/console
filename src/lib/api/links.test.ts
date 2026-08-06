import { describe, it, expect, afterEach, vi } from 'vitest'
import { LinksApi, normalizeLink } from './links'

/** The PAGE origin — where the SPA is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The canonical API host every `/v1` call resolves against, whatever origin serves the page. */
const API = 'https://api.hanzo.ai'
let lastUrl = ''
let lastInit: RequestInit | undefined

/** Stub window + a single JSON fetch; capture url + init (mirrors canonical-paths.test). */
function stub(body: unknown, status = 200): void {
  lastUrl = ''
  lastInit = undefined
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, val: string) => void store.set(k, val),
      removeItem: (k: string) => void store.delete(k),
    },
  }
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    lastUrl = String(url)
    lastInit = init
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    )
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

describe('normalizeLink', () => {
  it('maps camelCase, coerces enums, and fills honest defaults', () => {
    const l = normalizeLink({
      id: 'link_1', user: 'alice', machine: 'm1', host: 'box', os: 'darwin',
      provider: 'claude', account: 'a@x', plan: 'Claude Max', kind: 'subscription',
      billing: 'plan', status: 'linked', lastSeen: '2026-07-15T12:00:00Z',
      usage: { sessionPct: 42, weeklyPct: 12, tokens: 1000, spendCents: 0 },
    })
    expect(l).toMatchObject({ id: 'link_1', provider: 'claude', kind: 'subscription', billing: 'plan', status: 'linked' })
    expect(l.usage?.sessionPct).toBe(42)
  })
  it('tolerates snake_case + garbage, defaults enums to the safe value', () => {
    const l = normalizeLink({ id: 'x', provider: 'openai', kind: 'weird', billing: 'weird', status: 'weird', usage: { spend_cents: 250, session_pct: 5 } })
    // unknown kind → subscription default; unknown billing → plan; unknown status → linked
    expect(l.kind).toBe('subscription')
    expect(l.billing).toBe('plan')
    expect(l.status).toBe('linked')
    expect(l.usage?.spendCents).toBe(250)
    expect(l.usage?.sessionPct).toBe(5)
  })
  it('an apikey link reads billing=commerce', () => {
    expect(normalizeLink({ id: 'x', kind: 'apikey', billing: 'commerce' })).toMatchObject({ kind: 'apikey', billing: 'commerce' })
  })
})

describe('LinksApi transport contract', () => {
  it('list() GETs /v1/links and normalizes links + devices', async () => {
    stub({
      links: [{ id: 'l1', provider: 'claude', kind: 'subscription' }],
      devices: [{ machine: 'm1', host: 'box', accounts: [{ id: 'l1', provider: 'claude' }], activeSessions: 2 }],
    })
    const out = await LinksApi.list()
    expect(lastUrl).toBe(`${API}/v1/links`)
    expect(lastInit?.method ?? 'GET').toBe('GET')
    expect(out.links).toHaveLength(1)
    expect(out.devices[0]?.activeSessions).toBe(2)
    expect(out.devices[0]?.accounts[0]?.id).toBe('l1')
  })

  it('route() GETs /v1/links/route and normalizes candidates + primary', async () => {
    stub({
      candidates: [
        { provider: 'claude', kind: 'subscription', billing: 'plan', available: true, headroomPct: 90, linkId: 'a' },
        { provider: 'hanzo', kind: 'apikey', billing: 'commerce', available: true, headroomPct: 100, linkId: 'b' },
      ],
      primary: { provider: 'claude', kind: 'subscription', billing: 'plan', available: true, headroomPct: 90, linkId: 'a' },
    })
    const plan = await LinksApi.route()
    expect(lastUrl).toBe(`${API}/v1/links/route`)
    expect(plan.candidates).toHaveLength(2)
    expect(plan.primary?.linkId).toBe('a')
    expect(plan.candidates[1]?.billing).toBe('commerce')
  })

  it('revoke(id) DELETEs /v1/links/:id (url-escaped)', async () => {
    stub({ revoked: 1, sessionsStopped: 1 })
    await LinksApi.revoke('link_1')
    expect(lastUrl).toBe(`${API}/v1/links/link_1`)
    expect(lastInit?.method).toBe('DELETE')
  })

  it('revokeDevice(machine) POSTs /v1/links/devices/:machine/revoke and returns the counts', async () => {
    stub({ revoked: 2, sessionsStopped: 3 })
    const r = await LinksApi.revokeDevice('m1')
    expect(lastUrl).toBe(`${API}/v1/links/devices/m1/revoke`)
    expect(lastInit?.method).toBe('POST')
    expect(r).toEqual({ revoked: 2, sessionsStopped: 3 })
  })
})
