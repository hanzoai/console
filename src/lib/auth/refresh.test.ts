import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// refreshSession is browser-only and delegates to the IAM SDK; mock the SDK wrapper so
// the single-flight wiring is exercised in the node test env. resilientRefresh below is
// pure over injected deps, so it needs no mock (it never touches iam).
vi.mock('./iam', () => ({
  iamValidAccessToken: vi.fn(),
  iamHasSession: vi.fn(() => true),
}))

import { resilientRefresh, refreshSession, REFRESH_RETRY_MS } from './refresh'
import { iamValidAccessToken } from './iam'

const noSleep = (_ms: number) => Promise.resolve()

// The FIX itself — the exact `resilientFetch` injected-deps idiom the API client uses.
describe('resilientRefresh — a transient blip self-heals; a dead session does not spin', () => {
  it('returns true on the first attempt, no retry, no sleep', async () => {
    const attempt = vi.fn().mockResolvedValue('tok')
    const sleep = vi.fn(noSleep)
    expect(await resilientRefresh({ attempt, hasSession: () => true, sleep })).toBe(true)
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('recovers a TRANSIENT failure: null then a token → true (the whole point of the fix)', async () => {
    const attempt = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('tok')
    const sleep = vi.fn(noSleep)
    expect(await resilientRefresh({ attempt, hasSession: () => true, sleep })).toBe(true)
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep).toHaveBeenCalledWith(REFRESH_RETRY_MS[0])
  })

  it('a genuinely-dead session resolves false only after exhausting the bounded retries', async () => {
    const attempt = vi.fn().mockResolvedValue(null)
    const sleep = vi.fn(noSleep)
    expect(await resilientRefresh({ attempt, hasSession: () => true, sleep })).toBe(false)
    // one initial attempt + one per backoff slot
    expect(attempt).toHaveBeenCalledTimes(REFRESH_RETRY_MS.length + 1)
    expect(sleep).toHaveBeenCalledTimes(REFRESH_RETRY_MS.length)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual(REFRESH_RETRY_MS)
  })

  it('never waits through the backoff when there is no session to refresh (anonymous / revoked)', async () => {
    const attempt = vi.fn().mockResolvedValue(null)
    const sleep = vi.fn(noSleep)
    expect(await resilientRefresh({ attempt, hasSession: () => false, sleep })).toBe(false)
    expect(attempt).toHaveBeenCalledTimes(1) // one try, then hasSession() false → stop
    expect(sleep).not.toHaveBeenCalled()
  })

  it('stops the moment the session disappears mid-retry (a revoked token the SDK cleared)', async () => {
    const attempt = vi.fn().mockResolvedValue(null)
    const sleep = vi.fn(noSleep)
    const hasSession = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    expect(await resilientRefresh({ attempt, hasSession, sleep })).toBe(false)
    expect(attempt).toHaveBeenCalledTimes(2) // initial + one retry, then session gone
    expect(sleep).toHaveBeenCalledTimes(1)
  })
})

const mockAttempt = iamValidAccessToken as ReturnType<typeof vi.fn>

// The wiring: browser-only + single-flight (concurrent callers share ONE rotation —
// load-bearing for a one-time-use rotating refresh token).
describe('refreshSession — browser-only, single-flight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {} as unknown as Window & typeof globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is a no-op on the server (no window) — resolves false, never touches the SDK', async () => {
    vi.unstubAllGlobals() // remove the window stub → typeof window === 'undefined'
    expect(await refreshSession()).toBe(false)
    expect(mockAttempt).not.toHaveBeenCalled()
  })

  it('collapses concurrent callers onto ONE rotation (the timer + N parallel 401s)', async () => {
    mockAttempt.mockResolvedValue('tok')
    const p1 = refreshSession()
    const p2 = refreshSession()
    expect(p1).toBe(p2) // same in-flight promise
    expect(await Promise.all([p1, p2])).toEqual([true, true])
    expect(mockAttempt).toHaveBeenCalledTimes(1) // one rotation, not two
    // Settled → a later caller starts a fresh rotation (inflight cleared).
    expect(await refreshSession()).toBe(true)
    expect(mockAttempt).toHaveBeenCalledTimes(2)
  })
})
