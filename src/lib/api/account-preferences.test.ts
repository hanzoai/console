/**
 * User preferences travel to the plane that reads the credential the console holds.
 *
 * Measured live on console.hanzo.ai: `PATCH /v1/ai/preferences` answered
 * `401 {"msg":"Please sign in first"}` WITH a valid Bearer attached, because that
 * endpoint is the AI gateway's casibase handler and authenticates on a casibase
 * SESSION — no token the console owns can satisfy it, so no preference ever saved.
 * `/v1/prefs` is the per-user plane on cloud, and it authenticates on exactly the
 * Bearer every other console call already carries.
 *
 * Black-box: stub the global fetch (authedFetch calls it bare), drive the real
 * AccountApi, and read the request off the wire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const iam = vi.hoisted(() => ({ token: 'live-access-token' as string | null }))

vi.mock('~/lib/auth/iam', () => ({
  iamAccessToken: () => iam.token,
  iamValidAccessToken: async () => iam.token,
  iamHasSession: () => iam.token != null,
  iamExpiresInSeconds: () => 3600,
  iamUserInfo: async () => null,
  iamSignOut: () => {},
}))

const { AccountApi } = await import('./account')

function respond(body: unknown, status = 200) {
  return vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  )
}

let fetchMock: ReturnType<typeof respond>

beforeEach(() => {
  fetchMock = respond({ prefs: { theme: 'dark' }, updatedAt: 1 })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('preferences ride the plane that reads the Bearer', () => {
  it('saves with PATCH /v1/prefs, carrying the credential', async () => {
    const merged = await AccountApi.updatePreferences({ theme: 'dark' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/v1/prefs')
    expect(url).not.toContain('ai/preferences')
    expect(init.method).toBe('PATCH')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer live-access-token')
    // Only the keys this surface owns are sent; the merge is the server's job.
    expect(JSON.parse(init.body as string)).toEqual({ theme: 'dark' })
    // The whole document comes back, so another product's keys survive locally.
    expect(merged).toEqual({ theme: 'dark' })
  })

  it('reads the stored document with GET /v1/prefs — the read that did not exist before', async () => {
    const prefs = await AccountApi.preferences()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/v1/prefs')
    expect(init.method).toBe('GET')
    expect(prefs).toEqual({ theme: 'dark' })
  })

  it('reads a never-written document as no customizations, not as a failure', async () => {
    // The plane answers 200 with an empty document rather than a 404, so a first-time
    // user renders the same as everyone else.
    vi.stubGlobal('fetch', respond({ prefs: {} }))
    await expect(AccountApi.preferences()).resolves.toEqual({})
  })
})
