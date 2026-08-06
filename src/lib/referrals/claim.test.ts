import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { stashReferralCode, claimReferralOnce, __resetReferralGuard } from './claim'

/**
 * Referral capture + claim — the signup-capture half. Uses a fetch stub (the real
 * client path, like crm.test.ts) so the test proves the ACTUAL POST to
 * `/v1/referrals/claim` on the canonical API host, plus the localStorage capture +
 * the once-per-session guards.
 */
/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
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

describe('referral capture + claim', () => {
  const fetched: { url: string; method: string; body: string }[] = []
  let ls: ReturnType<typeof memStore>
  let ss: ReturnType<typeof memStore>

  beforeEach(() => {
    __resetReferralGuard()
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
        new Response(JSON.stringify({ id: 'ref_1', created: true }), {
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

  it('stashes ?ref=<code> into localStorage', () => {
    ;(globalThis as { window: { location: { search: string } } }).window.location.search = '?ref=ABC123XY'
    stashReferralCode()
    expect(ls.getItem('hz_ref')).toBe('ABC123XY')
  })

  it('is a no-op with no ?ref', () => {
    stashReferralCode()
    expect(ls.getItem('hz_ref')).toBeNull()
  })

  it('claims a stashed code once, POSTing to the canonical /v1, then consumes it', async () => {
    ls.setItem('hz_ref', 'ABC')
    claimReferralOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
    expect(fetched[0].url).toBe(`${API}/v1/referrals/claim`)
    expect(fetched[0].method).toBe('POST')
    expect(fetched[0].body).toContain('ABC')
    expect(ls.getItem('hz_ref')).toBeNull() // consumed on success
    expect(ss.getItem('hz_ref_claimed:orgB')).toBe('1') // session guard set
    // Second call in the same page life → in-memory guard blocks (no new POST).
    claimReferralOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
  })

  it('does not claim when nothing was stashed', async () => {
    claimReferralOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(0)
  })

  it('does not re-claim across page lives (sessionStorage guard)', async () => {
    ls.setItem('hz_ref', 'ABC')
    claimReferralOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
    // New page life: in-memory guard cleared, sessionStorage persists; re-stash the
    // (consumed) code to prove the SESSION guard — not the missing code — blocks it.
    __resetReferralGuard()
    ls.setItem('hz_ref', 'ABC')
    claimReferralOnce('orgB')
    await flush()
    expect(fetched).toHaveLength(1)
  })
})
