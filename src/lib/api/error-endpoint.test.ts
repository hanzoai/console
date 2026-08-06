/**
 * `ApiError.endpoint` — the failure names the call that actually failed.
 *
 * The honest-error cards (`RuntimeNotice` and friends) print an endpoint so a reader can
 * go look at it. They used to SYNTHESIZE it from a display label: the Logs card was
 * rendered as `surface="logs"` and printed `/v1/o11y/logs`, while the request that failed
 * was `POST /v1/o11y/query_range`. `/v1/o11y/logs` is a real route — GET-only, 405 on a
 * POST — so the wrong answer looked like a lead and someone spent real time on it.
 *
 * The fix is that the error carries its own URL, so these tests run the REAL client
 * (only `fetch` is stubbed) and assert the path off the thrown `ApiError`. A label can be
 * anything; this is the address.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ApiError, restGet, restPost, cloudProxyV1Url } from './client'
import { ApmApi, apmWindow } from './apm'

const ORIGIN = 'https://console.hanzo.ai'

/** The ApiError a rejected call threw. Fails loudly when the call RESOLVED — a test that
 *  caught nothing must never read as a pass. */
async function thrownBy(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call()
  } catch (e) {
    expect(e, 'the failure must be a typed ApiError').toBeInstanceOf(ApiError)
    return e as ApiError
  }
  throw new Error('the call resolved — no error was thrown, so there is nothing to assert')
}

describe('ApiError.endpoint (the path that actually failed)', () => {
  const sent: string[] = []
  let reply: () => Response

  beforeEach(() => {
    sent.length = 0
    reply = () => new Response('{"error":"boom"}', { status: 500, headers: { 'content-type': 'application/json' } })
    ;(globalThis as { window?: unknown }).window = { location: { origin: ORIGIN, hostname: 'console.hanzo.ai' } }
    vi.stubGlobal('fetch', (url: string) => {
      sent.push(String(url))
      return Promise.resolve(reply())
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('a failed o11y logs read names /v1/o11y/query_range — NOT the /v1/o11y/logs label', async () => {
    const e = await thrownBy(() => ApmApi.logs(apmWindow(3600), 50))
    expect(sent, 'the request must have gone out for its URL to be meaningful').toEqual([`${ORIGIN}/v1/o11y/query_range`])
    expect(e.endpoint).toBe('/v1/o11y/query_range')
    expect(e.endpoint).not.toBe('/v1/o11y/logs')
    expect(e.status).toBe(500)
  })

  it('carries the path on every plain-REST failure class: 5xx, 401/403, and a network error', async () => {
    const url = cloudProxyV1Url('o11y/services')

    expect((await thrownBy(() => restPost(url, {}))).endpoint).toBe('/v1/o11y/services')

    reply = () => new Response('nope', { status: 403 })
    const denied = await thrownBy(() => restGet(url))
    expect(denied.status).toBe(403)
    expect(denied.endpoint).toBe('/v1/o11y/services')

    vi.stubGlobal('fetch', () => Promise.reject(new Error('connection refused')))
    const offline = await thrownBy(() => restPost(url, {}))
    expect(offline.message).toBe('connection refused')
    expect(offline.endpoint).toBe('/v1/o11y/services')
  })

  it('normalizes to ONE origin-less form, so the card reads the same in the browser and on the server', () => {
    expect(new ApiError('x', 500, `${ORIGIN}/v1/o11y/query_range`).endpoint).toBe('/v1/o11y/query_range')
    expect(new ApiError('x', 500, '/v1/o11y/query_range').endpoint).toBe('/v1/o11y/query_range')
    // The query string labels a single call, not the endpoint — dropped.
    expect(new ApiError('x', 500, `${ORIGIN}/v1/platform/fleet?env=main`).endpoint).toBe('/v1/platform/fleet')
  })

  it('is empty — never guessed — when the thrower had no URL to name', () => {
    expect(new ApiError('boom').endpoint).toBe('')
    expect(new ApiError('boom', 404).endpoint).toBe('')
  })
})
