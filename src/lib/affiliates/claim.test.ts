import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { stashAffiliateCode, attributeAffiliateOnce, __resetAffiliateGuard } from './claim'

/**
 * Affiliate capture + attribute — the signup-capture half. Uses a fetch stub (the
 * real client path, like referrals claim.test.ts) so the test proves the ACTUAL POST
 * to `/v1/affiliates/attribute`, plus the localStorage capture + the
 * once-per-session guards.
 */
// Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
// (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
const ORIGIN = 'https://console.hanzo.ai'
const API = 'https://api.hanzo.ai'

function memStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('affiliate capture + attribute', () => {
  const fetched: { url: string; method: string; body: string }[] = []
  let ls: ReturnType<typeof memStore>
  let ss: ReturnType<typeof memStore>

  beforeEach(() => {
    __resetAffiliateGuard()
    fetched.length = 0
    ls = memStore()
    ss = memStore()
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai', search: '' },
    }
    ;(globalThis as { localStorage?: unknown }).localStorage = ls
    ;(globalThis as { sessionStorage?: unknown }).sessionStorage = ss
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'afr_1', created: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
    delete (globalThis as { localStorage?: unknown }).localStorage
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage
  })

  it('stashes ?aff=<code> into localStorage', () => {
    ;(globalThis as { window: { location: { search: string } } }).window.location.search = '?aff=acme'
    stashAffiliateCode()
    expect(ls.getItem('hz_aff')).toBe('acme')
  })

  it('is a no-op with no ?aff', () => {
    stashAffiliateCode()
    expect(ls.getItem('hz_aff')).toBeNull()
  })

  it('attributes a stashed code once, POSTing to the /v1 bearer BFF, then consumes it', async () => {
    ls.setItem('hz_aff', 'acme')
    attributeAffiliateOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
    expect(fetched[0].url).toBe(`${API}/v1/affiliates/attribute`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('acme')
    expect(ls.getItem('hz_aff')).toBeNull() // consumed on success
    expect(ss.getItem('hz_aff_attributed:orgB')).toBe('1') // session guard set
    // Second call in the same page life → in-memory guard blocks (no new POST).
    attributeAffiliateOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
  })

  it('does not attribute when nothing was stashed', async () => {
    attributeAffiliateOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(0)
  })

  it('does not re-attribute across page lives (sessionStorage guard)', async () => {
    ls.setItem('hz_aff', 'acme')
    attributeAffiliateOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
    // New page life: in-memory guard cleared, sessionStorage persists; re-stash the
    // (consumed) code to prove the SESSION guard — not the missing code — blocks it.
    __resetAffiliateGuard()
    ls.setItem('hz_aff', 'acme')
    attributeAffiliateOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
  })
})
