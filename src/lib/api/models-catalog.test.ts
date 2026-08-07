import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { CloudModelApi } from './models-catalog'

/**
 * The catalog must reach the model list at the console's OWN same-origin `/v1/models`
 * with NO prefix (the CTO one-endpoint contract). `next.config.mjs` rewrites the
 * `models` head to the `/ai` bearer proxy, which adds the user bearer the gateway
 * requires — so the client stays keyless AND prefix-free, and never makes a
 * cookie-only cross-origin call to the cloud host (the "models missing" bug). We
 * assert the exact URL the catalog fetches for the model list.
 */
const ORIGIN = 'https://console.hanzo.ai'

describe('CloudModelApi.list — same-origin /v1/models, no prefix', () => {
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

  it('fetches the model list from the same-origin <origin>/v1/models (no /ai, no /cloud prefix)', async () => {
    const models = await CloudModelApi.list()
    const modelsUrl = fetched.find((u) => u.endsWith('/models') && !u.includes('pricing'))
    expect(modelsUrl).toBe(`${ORIGIN}/v1/models`)
    expect(modelsUrl).not.toContain('/ai/')
    expect(modelsUrl).not.toContain('/cloud/')
    expect(models.map((m) => m.id)).toEqual(['zen-coder'])
    expect(models[0].premium).toBe(true)
  })

  it('never makes a cookie-only cross-origin call to the cloud host for models', async () => {
    await CloudModelApi.list()
    // The model list must be same-origin (rewritten to the bearer proxy), never a
    // direct call to the cloud API host (cloud.hanzo.ai) which would be cookie-only.
    const modelsUrl = fetched.find((u) => u.endsWith('/models') && !u.includes('pricing'))
    expect(modelsUrl?.startsWith(ORIGIN)).toBe(true)
    expect(modelsUrl).not.toContain('cloud.hanzo.ai')
  })
})
