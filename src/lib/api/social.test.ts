import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { SocialApi } from './social'

/**
 * The console's `/v1/social` BINDING. The contract (types, normalizers, paths) is
 * tested in `@hanzo/ui/product/social` — the ONE place it lives. What is console-only,
 * and therefore tested here, is the TRANSPORT: that a contract path resolves to
 * `/v1/social/...` on the CANONICAL API host (keyless, prefix-free), which is the
 * canonical CRM/Agents form. The social product FACE is served from social.hanzo.ai;
 * its data still comes from the one named API host, never from the face's own origin.
 */
/** The origin this product face is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://social.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

describe('SocialApi — binds the contract to the canonical API host', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'social.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.includes('/providers')
        ? { data: [{ provider: 'x', credentialsConfigured: false, missingCredentials: ['X_API_KEY'] }] }
        : url.includes('/publish')
          ? { id: 'post_1', status: 'failed', error: 'provider not configured' }
          : { data: [] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('reads provider readiness via the /v1/social/providers path', async () => {
    const caps = await SocialApi.providers()
    expect(fetched[0]).toEqual({ url: `${API}/v1/social/providers`, method: 'GET' })
    expect(caps[0]).toMatchObject({ provider: 'x', credentialsConfigured: false, missingCredentials: ['X_API_KEY'] })
  })

  it('publishes a post with POST /v1/social/posts/:id/publish', async () => {
    const p = await SocialApi.posts.publish('post_1')
    expect(fetched[0]).toEqual({ url: `${API}/v1/social/posts/post_1/publish`, method: 'POST' })
    expect(p).toMatchObject({ id: 'post_1', status: 'failed', error: 'provider not configured' })
  })

  it('lists posts and accounts via their canonical /v1/social paths', async () => {
    await SocialApi.posts.list()
    await SocialApi.accounts.list('x')
    expect(fetched[0].url).toBe(`${API}/v1/social/posts`)
    expect(fetched[1].url).toBe(`${API}/v1/social/accounts?provider=x`)
  })
})
