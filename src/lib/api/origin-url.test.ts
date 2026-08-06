import { describe, it, expect, afterEach } from 'vitest'

import { CANONICAL_API_URL } from '~/config'

import { originV1Url } from './client'

/**
 * originV1Url is the ONE client-visible form for EVERY cloud API call: an ABSOLUTE
 * `<api-host>/v1/<path>` with NO prefix before `/v1/` (the CTO one-endpoint contract).
 *
 * It used to read `window.location.origin`, which only LOOKED compliant because
 * console.hanzo.ai and api.hanzo.ai are the same binary on the same address —
 * measured identical (`x-api-version: v1.801.480`, byte-identical bodies). Naming
 * the host makes the contract true by construction rather than by coincidence, so
 * the tests below pin the host EXPLICITLY and pin its independence from the page.
 */
describe('originV1Url', () => {
  const stubOrigin = (origin: string) => {
    ;(globalThis as { window?: unknown }).window = { location: { origin } }
  }

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('is an absolute /v1/<path> on the canonical API host', () => {
    stubOrigin('https://console.hanzo.ai')
    expect(originV1Url('prompts')).toBe(`${CANONICAL_API_URL}/v1/prompts`)
    expect(originV1Url('agents/support-triage')).toBe(`${CANONICAL_API_URL}/v1/agents/support-triage`)
    expect(originV1Url('evals/scores')).toBe(`${CANONICAL_API_URL}/v1/evals/scores`)
    expect(originV1Url('models')).toBe(`${CANONICAL_API_URL}/v1/models`)
  })

  it('names api.hanzo.ai — the one endpoint, not a host inherited from the page', () => {
    stubOrigin('https://console.hanzo.ai')
    expect(CANONICAL_API_URL).toBe('https://api.hanzo.ai')
    expect(originV1Url('prompts')).toBe('https://api.hanzo.ai/v1/prompts')
  })

  /**
   * THE property the change exists for. Whatever host serves the bundle — the embed
   * on console.hanzo.ai, the Next server on admin.hanzo.ai, a brand host, or a
   * relocated deployment — the API host does not move with it.
   */
  it('does not vary with the page origin', () => {
    const hosts = [
      'https://console.hanzo.ai',
      'https://admin.hanzo.ai',
      'https://cloud.lux.cloud',
      'https://billing.zoo.cloud',
      'http://localhost:4000',
    ]
    for (const h of hosts) {
      stubOrigin(h)
      expect(originV1Url('prompts')).toBe(`${CANONICAL_API_URL}/v1/prompts`)
    }
  })

  /**
   * Previously the server branch yielded a ROOT-RELATIVE `/v1/<path>` while the
   * browser branch yielded an absolute one — the same call producing two shapes
   * depending on where it ran. Naming the host collapses that: one form, everywhere.
   */
  it('is the same on the server as in the browser (no window)', () => {
    stubOrigin('https://console.hanzo.ai')
    const inBrowser = originV1Url('prompts')
    delete (globalThis as { window?: unknown }).window
    expect(originV1Url('prompts')).toBe(inBrowser)
    expect(originV1Url('models')).toBe(`${CANONICAL_API_URL}/v1/models`)
  })

  it('never contains a /cloud, /ai or /api prefix', () => {
    stubOrigin('https://console.hanzo.ai')
    for (const p of ['prompts', 'agents', 'evals/runs', 'models', 'chat/completions']) {
      const url = originV1Url(p)
      expect(url).not.toContain('/cloud/')
      expect(url).not.toContain('/ai/')
      expect(url).not.toContain('/api/')
      expect(url).toContain('/v1/')
    }
  })

  it('strips a leading slash on the path (no // in the result)', () => {
    stubOrigin('https://console.hanzo.ai')
    expect(originV1Url('/prompts')).toBe(`${CANONICAL_API_URL}/v1/prompts`)
    // No doubled slash anywhere after the scheme.
    expect(originV1Url('/prompts').replace(/^https?:\/\//, '')).not.toContain('//')
  })
})
