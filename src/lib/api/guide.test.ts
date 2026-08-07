import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { GuideApi, normalizeOverview } from './guide'

/**
 * Guide API + pure normalizers. The module calls the DOCUMENTED cloud `/v1/guide`
 * contract same-origin, keyless and prefix-free (`originV1Url` → `<origin>/v1/guide`);
 * the standalone console rewrites that head to the user-bearer `/v1` proxy, the
 * go:embed console calls cloud directly. These tests pin (1) each call hits the
 * EXACT same-origin `/v1/guide/...` path, (2) the real overview JSON shape (guide.go
 * stepView tags) normalizes, and (3) a garbage/absent field degrades safely.
 */
const ORIGIN = 'https://console.hanzo.ai'

describe('Guide normalizers — real guide.go JSON shape, defensive', () => {
  it('normalizes a full overview', () => {
    const o = normalizeOverview({
      version: 'builtin-1',
      title: 'Launch',
      custom: false,
      progress: { done: 1, total: 3, percent: 33, next: 'landing' },
      steps: [
        {
          id: 'positioning', title: 'Positioning', why: 'w', how: 'h', done: 'd',
          dependencies: [], signal: 'acted', tool: 'content_generate', args: { doctype: 'Campaign' },
          automatable: true, state: 'done', source: 'agent', available: true, blockedBy: [],
        },
        {
          id: 'landing', title: 'Landing', dependencies: ['positioning'], tool: 'content_generate',
          automatable: true, state: 'todo', available: false, blockedBy: ['positioning'],
        },
      ],
    })
    expect(o.version).toBe('builtin-1')
    expect(o.progress).toEqual({ done: 1, total: 3, percent: 33, next: 'landing' })
    expect(o.steps).toHaveLength(2)
    expect(o.steps[0]).toMatchObject({ id: 'positioning', state: 'done', automatable: true, source: 'agent' })
    expect(o.steps[1]).toMatchObject({ id: 'landing', available: false, blockedBy: ['positioning'] })
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const o = normalizeOverview(null)
    expect(o).toMatchObject({ version: '', custom: false, steps: [] })
    expect(o.progress).toEqual({ done: 0, total: 0, percent: 0, next: '' })
    // An unknown state coerces to todo; a non-object step is filtered out.
    const o2 = normalizeOverview({ steps: [{ id: 'a', state: 'bogus' }, 'x', null] })
    expect(o2.steps.map((s) => s.id)).toEqual(['a'])
    expect(o2.steps[0].state).toBe('todo')
  })

  it('reads steps from a bare array or the data envelope', () => {
    expect(normalizeOverview({ steps: [{ id: 'a' }, { id: 'b' }] }).steps).toHaveLength(2)
  })
})

describe('GuideApi — hits the same-origin /v1/guide contract', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.includes('/actions')
        ? { data: [{ id: 'act_1', stepId: 'positioning', tool: 'content_generate', ok: true, createdAt: 1 }] }
        : { version: 'builtin-1', custom: false, progress: { done: 0, total: 7, percent: 0, next: 'positioning' }, steps: [] }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('loads the overview from /v1/guide', async () => {
    const o = await GuideApi.overview()
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide`, method: 'GET' })
    expect(o.progress.next).toBe('positioning')
  })

  it('posts step transitions to the exact per-step paths', async () => {
    await GuideApi.markDone('landing')
    await GuideApi.skip('waitlist')
    await GuideApi.start('email')
    await GuideApi.reset('referral')
    expect(fetched.map((f) => `${f.method} ${f.url}`)).toEqual([
      `POST ${ORIGIN}/v1/guide/steps/landing/done`,
      `POST ${ORIGIN}/v1/guide/steps/waitlist/skip`,
      `POST ${ORIGIN}/v1/guide/steps/email/start`,
      `POST ${ORIGIN}/v1/guide/steps/referral/reset`,
    ])
  })

  it('runs "do it for me" (non-streaming) via POST /v1/guide/steps/:id/do', async () => {
    await GuideApi.do('positioning')
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/guide/steps/positioning/do`, method: 'POST' })
  })

  it('reads the action ledger from /v1/guide/actions', async () => {
    const acts = await GuideApi.actions()
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/guide/actions`)
    expect(acts).toHaveLength(1)
    expect(acts[0]).toMatchObject({ id: 'act_1', tool: 'content_generate', ok: true })
  })

  it('encodes a step id with special characters', async () => {
    await GuideApi.markDone('a/b')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/guide/steps/a%2Fb/done`)
  })
})
