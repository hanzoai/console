import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ProviderAdminApi, deriveHealth, normalizeProvider } from './provider-admin'

/**
 * The provider control board is the platform-wide shared-gateway routing surface
 * (GLOBAL-ADMIN only). Two invariants under test:
 *   1. Its client hits the console's OWN same-origin `/v1/admin/providers` (which
 *      `next.config.mjs` rewrites to the global-admin-gated `/admin/aggregate`
 *      proxy) — NEVER a direct cookie-only call to the cloud host (which would
 *      bypass the console gate), for BOTH the GET list and the POST mutations.
 *   2. A provider KEY is never modeled or surfaced — `keyPresent` is a boolean;
 *      even if the backend leaks a raw key field, it never reaches `AdminProvider`.
 */
const ORIGIN = 'https://admin.hanzo.ai'

describe('deriveHealth — honest derived verdict (no live probe)', () => {
  it('disabled ⇒ off regardless of key', () => {
    expect(deriveHealth({ enabled: false, keyPresent: true })).toBe('off')
    expect(deriveHealth({ enabled: false, keyPresent: false })).toBe('off')
  })
  it('enabled + keyPresent ⇒ ready', () => {
    expect(deriveHealth({ enabled: true, keyPresent: true })).toBe('ready')
  })
  it('enabled + !keyPresent ⇒ no-key', () => {
    expect(deriveHealth({ enabled: true, keyPresent: false })).toBe('no-key')
  })
})

describe('normalizeProvider — optional-safe, key-leak-proof', () => {
  it('maps the documented shape', () => {
    const p = normalizeProvider({
      name: 'do-ai',
      displayName: 'DigitalOcean',
      type: 'DigitalOcean',
      enabled: true,
      primary: true,
      keyPresent: true,
      modelCount: 12,
      providerUrl: 'https://inference.do-ai.run',
    })
    expect(p).toEqual({
      name: 'do-ai',
      displayName: 'DigitalOcean',
      type: 'DigitalOcean',
      enabled: true,
      primary: true,
      keyPresent: true,
      modelCount: 12,
      providerUrl: 'https://inference.do-ai.run',
    })
  })

  it('tolerates snake_case + a bare/absent name (displayName falls back to name)', () => {
    const p = normalizeProvider({ name: 'openrouter', is_default: true, key_present: true, model_count: 40, provider_url: 'https://openrouter.ai' })
    expect(p.displayName).toBe('openrouter')
    expect(p.primary).toBe(true)
    expect(p.keyPresent).toBe(true)
    expect(p.modelCount).toBe(40)
    expect(p.providerUrl).toBe('https://openrouter.ai')
  })

  it('fails closed on garbage (no key claimed, no fabricated numbers)', () => {
    const p = normalizeProvider({ name: 'x', keyPresent: 'yes', modelCount: 'lots', enabled: 1 })
    expect(p.keyPresent).toBe(false) // strict-true only — a non-boolean is NOT a present key
    expect(p.enabled).toBe(false) // strict-true only
    expect(p.modelCount).toBe(0)
  })

  it('NEVER surfaces a raw provider key even if the backend leaks one', () => {
    const p = normalizeProvider({ name: 'do-ai', keyPresent: true, apiKey: 'sk-super-secret', secret: 'do-not-leak', key: 'sk-nope' })
    // The shape has no key/secret/apiKey field, and JSON of the object must not
    // contain the secret material anywhere.
    expect(JSON.stringify(p)).not.toContain('sk-super-secret')
    expect(JSON.stringify(p)).not.toContain('do-not-leak')
    expect(JSON.stringify(p)).not.toContain('sk-nope')
    const bag = p as unknown as Record<string, unknown>
    expect(bag.apiKey).toBeUndefined()
    expect(bag.secret).toBeUndefined()
    expect(bag.key).toBeUndefined()
    expect(p.keyPresent).toBe(true)
  })
})

describe('ProviderAdminApi — same-origin /v1/admin/providers, never the cloud host', () => {
  const calls: { url: string; method: string; body?: string }[] = []

  beforeEach(() => {
    calls.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'admin.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
      const one = { name: 'do-ai', displayName: 'DigitalOcean', type: 'DigitalOcean', enabled: true, primary: true, keyPresent: true, modelCount: 3, providerUrl: 'https://do-ai' }
      const isPrimary = url.includes('/primary')
      // The casibase envelope: list/primary → array, toggle → single row.
      const data = url.endsWith('/providers') || isPrimary ? [one] : one
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok', msg: '', data }), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('list() GETs the same-origin <origin>/v1/admin/providers (no /cloud, no /ai prefix)', async () => {
    const rows = await ProviderAdminApi.list()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/admin/providers`)
    expect(calls[0].method).toBe('GET')
    expect(rows.map((r) => r.name)).toEqual(['do-ai'])
  })

  it('never calls the cloud API host directly (would bypass the console admin gate)', async () => {
    await ProviderAdminApi.list()
    expect(calls[0].url.startsWith(ORIGIN)).toBe(true)
    expect(calls[0].url).not.toContain('cloud.hanzo.ai')
    expect(calls[0].url).not.toContain('/cloud/')
    expect(calls[0].url).not.toContain('/ai/')
  })

  it('toggle() POSTs the {name,enabled} body to same-origin /v1/admin/providers/toggle', async () => {
    const updated = await ProviderAdminApi.toggle('openrouter', false)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/admin/providers/toggle`)
    expect(calls[0].method).toBe('POST')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ name: 'openrouter', enabled: false })
    expect(updated.name).toBe('do-ai')
  })

  it('setPrimary() POSTs {name} to same-origin /v1/admin/providers/primary and returns the list', async () => {
    const rows = await ProviderAdminApi.setPrimary('fireworks')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/admin/providers/primary`)
    expect(calls[0].method).toBe('POST')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ name: 'fireworks' })
    expect(rows.map((r) => r.name)).toEqual(['do-ai'])
  })
})
