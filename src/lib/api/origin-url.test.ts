import { describe, it, expect, afterEach } from 'vitest'

import { originV1Url } from './client'

/**
 * originV1Url is the ONE client-visible form for the AI product surface: same-origin
 * `/v1/<path>` with NO prefix (the CTO one-endpoint contract). next.config rewrites
 * the AI heads to the bearer proxies, so the client never types `/v1` or `/ai`.
 */
describe('originV1Url', () => {
  afterEach(() => {
    // Clean up any window stub between cases.
    delete (globalThis as { window?: unknown }).window
  })

  it('is a same-origin /v1/<path> in the browser (no /cloud, no /ai prefix)', () => {
    ;(globalThis as { window?: unknown }).window = { location: { origin: 'https://console.hanzo.ai' } }
    expect(originV1Url('prompts')).toBe('https://console.hanzo.ai/v1/prompts')
    expect(originV1Url('agents/support-triage')).toBe('https://console.hanzo.ai/v1/agents/support-triage')
    expect(originV1Url('evals/scores')).toBe('https://console.hanzo.ai/v1/evals/scores')
    expect(originV1Url('models')).toBe('https://console.hanzo.ai/v1/models')
  })

  it('never contains a /cloud or /ai prefix', () => {
    ;(globalThis as { window?: unknown }).window = { location: { origin: 'https://console.hanzo.ai' } }
    for (const p of ['prompts', 'agents', 'evals/runs', 'models', 'chat/completions']) {
      const url = originV1Url(p)
      expect(url).not.toContain('/cloud/')
      expect(url).not.toContain('/ai/')
      expect(url).toContain('/v1/')
    }
  })

  it('strips a leading slash on the path (no // in the result)', () => {
    ;(globalThis as { window?: unknown }).window = { location: { origin: 'https://console.hanzo.ai' } }
    expect(originV1Url('/prompts')).toBe('https://console.hanzo.ai/v1/prompts')
  })

  it('is root-relative /v1/<path> on the server (no window) — the rewrite still applies', () => {
    // No window global set.
    expect(originV1Url('prompts')).toBe('/v1/prompts')
    expect(originV1Url('models')).toBe('/v1/models')
  })
})
