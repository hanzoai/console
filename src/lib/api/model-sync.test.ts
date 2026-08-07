import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { ModelSyncApi } from './model-sync'

const ORIGIN = 'https://admin.hanzo.ai'

describe('ModelSyncApi — same-origin model sync endpoints', () => {
  const calls: { url: string; method: string }[] = []

  beforeEach(() => {
    calls.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'admin.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET' })
      const data = url.endsWith('/admin/refresh-model-pricing')
        ? { lastPricingRefresh: '2026-07-05T00:00:00.000Z' }
        : {}
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok', msg: '', data }), { status: 200, headers: { 'content-type': 'application/json' } }))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reloadConfig() POSTs same-origin /v1/reload-model-config', async () => {
    await ModelSyncApi.reloadConfig()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/admin/reload-model-config`)
    expect(calls[0].method).toBe('POST')
  })

  it('refreshPricing() POSTs same-origin /v1/refresh-model-pricing', async () => {
    const res = await ModelSyncApi.refreshPricing()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${ORIGIN}/v1/admin/refresh-model-pricing`)
    expect(calls[0].method).toBe('POST')
    expect(res.lastPricingRefresh).toBe('2026-07-05T00:00:00.000Z')
  })
})
