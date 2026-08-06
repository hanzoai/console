import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { CloudModelApi } from './models-catalog'

/**
 * The catalog must reach the model list at the canonical API host's `/v1/models`
 * with NO prefix (the CTO one-endpoint contract) — the host is NAMED, not inherited
 * from whatever origin serves the bundle. The user bearer travels as a header, so the
 * call is origin-independent; what must never come back is a prefixed head (`/ai/`,
 * `/cloud/`) or a second data origin (cloud.hanzo.ai — the "models missing" bug). We
 * assert the exact URL the catalog fetches for the model list.
 */
/** The PAGE origin — where the SPA is served from. */
const ORIGIN = 'https://console.hanzo.ai'
/** The canonical API host every `/v1` call resolves against, whatever origin serves the page. */
const API = 'https://api.hanzo.ai'

describe('CloudModelApi.list — canonical /v1/models, no prefix', () => {
  const fetched: string[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url)
      const body = url.includes('pricing')
        ? { models: [] }
        : { object: 'list', data: [{ id: 'zen-coder', object: 'model', created: 1, owned_by: 'hanzo', premium: true }] }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('fetches the model list from the canonical <api>/v1/models (no /ai, no /cloud prefix)', async () => {
    const models = await CloudModelApi.list()
    const modelsUrl = fetched.find((u) => u.endsWith('/models') && !u.includes('pricing'))
    expect(modelsUrl).toBe(`${API}/v1/models`)
    expect(modelsUrl).not.toContain('/ai/')
    expect(modelsUrl).not.toContain('/cloud/')
    expect(models.map((m) => m.id)).toEqual(['zen-coder'])
    expect(models[0].premium).toBe(true)
  })

  it('never reaches a second data origin for models', async () => {
    await CloudModelApi.list()
    // The model list resolves against the ONE canonical API host — never the legacy
    // cloud.hanzo.ai head, which would be a second data origin for the same fact.
    const modelsUrl = fetched.find((u) => u.endsWith('/models') && !u.includes('pricing'))
    expect(modelsUrl?.startsWith(API)).toBe(true)
    expect(modelsUrl).not.toContain('cloud.hanzo.ai')
  })
})
