import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  normalizeTemplate,
  normalizeTemplates,
  normalizeForkedProject,
  normalizeDeployResult,
  isLive,
  groupByCategory,
  customizePrompt,
  buildBuilderUrl,
  TemplatesApi,
  type Template,
} from './templates'
import { ApiError } from './client'

/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL).
 *  The page ORIGIN each transport block mocks below is where the SPA is SERVED —
 *  deliberately NOT where the API lives. */
const API = 'https://api.hanzo.ai'

const template = (over: Partial<Template> = {}): Template => ({
  slug: 'brainwave',
  title: 'Brainwave',
  category: 'AI',
  description: 'An AI landing page.',
  framework: 'next',
  features: [],
  source: 'https://gallery.hanzo.ai/templates/brainwave',
  ...over,
})

describe('normalizeTemplate', () => {
  it('drops a record with no slug/id or no title', () => {
    expect(normalizeTemplate({})).toBeNull()
    expect(normalizeTemplate({ slug: 'a' })).toBeNull()
    expect(normalizeTemplate({ title: 'A' })).toBeNull()
  })

  it('reads slug from slug|id and title from title|displayName|name', () => {
    expect(normalizeTemplate({ id: 'x', name: 'X' })).toMatchObject({ slug: 'x', title: 'X' })
    expect(normalizeTemplate({ slug: 'y', displayName: 'Y' })).toMatchObject({ slug: 'y', title: 'Y' })
  })

  it('defaults category to App and features to [], coerces numbers', () => {
    const t = normalizeTemplate({ slug: 's', title: 'S', tier: 1, rating: 5 })
    expect(t).toMatchObject({ category: 'App', features: [], tier: 1, rating: 5 })
  })

  it('keeps only string features and passes through handoff urls', () => {
    const t = normalizeTemplate({ slug: 's', title: 'S', features: ['a', 2, ''], source: 'u', preview: 'p' })
    expect(t?.features).toEqual(['a', '2'])
    expect(t).toMatchObject({ source: 'u', preview: 'p' })
  })
})

describe('normalizeTemplates', () => {
  it('reads the data envelope and drops invalid rows', () => {
    const out = normalizeTemplates({ data: [{ slug: 'a', title: 'A' }, { slug: 'b' }] })
    expect(out.map((t) => t.slug)).toEqual(['a'])
  })

  it('reads a bare array and never throws on junk', () => {
    expect(normalizeTemplates([{ slug: 'a', title: 'A' }]).length).toBe(1)
    expect(normalizeTemplates(null)).toEqual([])
    expect(normalizeTemplates(9)).toEqual([])
  })
})

describe('groupByCategory', () => {
  it('groups by category, categories alphabetized, order preserved within', () => {
    const ts = normalizeTemplates([
      { slug: 'a', title: 'A', category: 'SaaS' },
      { slug: 'b', title: 'B', category: 'App' },
      { slug: 'c', title: 'C', category: 'SaaS' },
    ])
    const groups = groupByCategory(ts)
    expect(groups.map(([c]) => c)).toEqual(['App', 'SaaS'])
    expect(groups[1][1].map((t) => t.slug)).toEqual(['a', 'c'])
  })
})

describe('customizePrompt', () => {
  it('seeds the template context (title, framework, description) + the user ask', () => {
    expect(customizePrompt(template(), 'make it dark and add a pricing table')).toBe(
      'Start from the Brainwave template (next). An AI landing page. Customize it: make it dark and add a pricing table',
    )
  })

  it('defaults to just the template seed when no user text is given', () => {
    expect(customizePrompt(template())).toBe(
      'Start from the Brainwave template (next). An AI landing page. Customize it to my needs.',
    )
    // blank/whitespace user text is treated as absent
    expect(customizePrompt(template(), '   ')).toBe(
      'Start from the Brainwave template (next). An AI landing page. Customize it to my needs.',
    )
  })

  it('degrades gracefully when framework/description are missing (no stray "()" or double spaces)', () => {
    expect(customizePrompt(template({ framework: undefined, description: undefined }), 'add auth')).toBe(
      'Start from the Brainwave template. Customize it: add auth',
    )
  })
})

describe('buildBuilderUrl', () => {
  it('builds <appBase>/dev?template=<source>&prompt=<seed>&action=edit', () => {
    const u = new URL(buildBuilderUrl(template(), 'add a blog', 'https://hanzo.app'))
    expect(u.origin + u.pathname).toBe('https://hanzo.app/dev')
    expect(u.searchParams.get('template')).toBe('https://gallery.hanzo.ai/templates/brainwave')
    expect(u.searchParams.get('prompt')).toBe(
      'Start from the Brainwave template (next). An AI landing page. Customize it: add a blog',
    )
    expect(u.searchParams.get('action')).toBe('edit')
  })

  it('defaults the base to https://hanzo.app and trims a trailing slash', () => {
    expect(buildBuilderUrl(template())).toContain('https://hanzo.app/dev?')
    expect(buildBuilderUrl(template(), '', 'https://hanzo.app/')).toContain('https://hanzo.app/dev?')
  })

  it('omits the template param when the starter has no gallery source', () => {
    const u = new URL(buildBuilderUrl(template({ source: undefined })))
    expect(u.searchParams.has('template')).toBe(false)
    expect(u.searchParams.get('prompt')).toContain('Start from the Brainwave template')
  })

  it('is injection-safe: a hostile ask stays inside the single encoded prompt param', () => {
    // Trying to smuggle extra params / break the query must not add params or
    // change the action — it is one URL-encoded value.
    const evil = 'x&action=deploy&template=https://evil.example/#'
    const u = new URL(buildBuilderUrl(template(), evil))
    expect(u.searchParams.get('action')).toBe('edit')
    expect(u.searchParams.get('template')).toBe('https://gallery.hanzo.ai/templates/brainwave')
    expect(u.searchParams.get('prompt')).toContain(evil)
    // exactly the three params we set — no injected ones
    expect([...u.searchParams.keys()].sort()).toEqual(['action', 'prompt', 'template'])
    // the raw query encodes the ampersands from the ask (not literal separators)
    expect(u.search).toContain('x%26action%3Ddeploy')
  })
})

describe('normalizeForkedProject', () => {
  it('returns null without a slug', () => {
    expect(normalizeForkedProject({})).toBeNull()
    expect(normalizeForkedProject({ name: 'X' })).toBeNull()
    expect(normalizeForkedProject(null)).toBeNull()
  })

  it('maps the projectsvc Project view, defaulting name/framework/status', () => {
    expect(normalizeForkedProject({ slug: 'brainwave' })).toEqual({
      slug: 'brainwave',
      name: 'brainwave',
      framework: 'static',
      status: 'draft',
      liveUrl: undefined,
    })
  })

  it('passes through real fields (name, framework, status, liveUrl)', () => {
    const p = normalizeForkedProject({
      slug: 'brainwave',
      name: 'Brainwave',
      framework: 'next',
      status: 'live',
      liveUrl: 'https://s3.hanzo.ai/hanzo-sites/maxpower/brainwave/index.html',
      // extra fields the console does not need are ignored
      org: 'maxpower',
      repo: { url: 'https://gallery.hanzo.ai/templates/brainwave', provider: 'git' },
    })
    expect(p).toEqual({
      slug: 'brainwave',
      name: 'Brainwave',
      framework: 'next',
      status: 'live',
      liveUrl: 'https://s3.hanzo.ai/hanzo-sites/maxpower/brainwave/index.html',
    })
  })
})

describe('TemplatesApi.fork — POST /v1/projects/fork (canonical API host, no prefix)', () => {
  const ORIGIN = 'https://console.hanzo.ai'
  let calls: { url: string; method?: string; body?: unknown }[]

  beforeEach(() => {
    calls = []
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  const stub = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return Promise.resolve(
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
      )
    })

  it('POSTs {slug} to <api>/v1/projects/fork and returns the forked project', async () => {
    stub(201, { slug: 'brainwave', name: 'Brainwave', framework: 'next', status: 'draft' })
    const p = await TemplatesApi.fork('brainwave')
    expect(calls[0].url).toBe(`${API}/v1/projects/fork`)
    expect(calls[0].url).not.toContain('/cloud/')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toEqual({ slug: 'brainwave' })
    expect(p).toMatchObject({ slug: 'brainwave', name: 'Brainwave', framework: 'next', status: 'draft' })
  })

  it('includes an explicit name override in the body when provided', async () => {
    stub(201, { slug: 'landing-1', name: 'My Landing', framework: 'vite', status: 'draft' })
    await TemplatesApi.fork('xora-react', { name: 'My Landing' })
    expect(calls[0].body).toEqual({ slug: 'xora-react', name: 'My Landing' })
  })

  it('throws a 404 ApiError when the fork route is absent (older backend) so the UI can fall back', async () => {
    stub(404, { error: 'not found' })
    const err = await TemplatesApi.fork('brainwave').then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(404)
  })
})

describe('normalizeDeployResult', () => {
  it('defaults status to building and reads liveUrl/message', () => {
    expect(normalizeDeployResult({})).toEqual({ status: 'building', liveUrl: undefined, message: undefined })
    expect(normalizeDeployResult({ status: 'queued' })).toMatchObject({ status: 'queued' })
    expect(normalizeDeployResult({ status: 'live', liveUrl: 'https://x' })).toMatchObject({
      status: 'live',
      liveUrl: 'https://x',
    })
    expect(normalizeDeployResult({ status: 'error', message: 'boom' })).toMatchObject({
      status: 'error',
      message: 'boom',
    })
  })
})

describe('isLive', () => {
  it('is true with a liveUrl or a live status (case-insensitive), false otherwise', () => {
    expect(isLive('live')).toBe(true)
    expect(isLive('LIVE')).toBe(true)
    expect(isLive('building', 'https://x')).toBe(true)
    expect(isLive('building')).toBe(false)
    expect(isLive(undefined, undefined)).toBe(false)
  })
})

describe('TemplatesApi.deploy / status — projectsvc deploy (canonical API host, no prefix)', () => {
  const ORIGIN = 'https://console.hanzo.ai'
  let calls: { url: string; method?: string; body?: unknown }[]

  beforeEach(() => {
    calls = []
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  const stub = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      return Promise.resolve(
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
      )
    })

  it('deploy POSTs {source:git} to <api>/v1/projects/{slug}/deploy (never /cloud-prefixed)', async () => {
    stub(202, { status: 'queued' })
    const r = await TemplatesApi.deploy('brainwave')
    expect(calls[0].url).toBe(`${API}/v1/projects/brainwave/deploy`)
    expect(calls[0].url).not.toContain('/cloud/')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toEqual({ source: 'git' })
    expect(r).toMatchObject({ status: 'queued' })
  })

  it('deploy percent-encodes the slug', async () => {
    stub(202, { status: 'queued' })
    await TemplatesApi.deploy('a/b')
    expect(calls[0].url).toBe(`${API}/v1/projects/a%2Fb/deploy`)
  })

  it('status GETs <api>/v1/projects/{slug} and normalizes to a ForkedProject', async () => {
    stub(200, { slug: 'brainwave', name: 'Brainwave', framework: 'next', status: 'live', liveUrl: 'https://x' })
    const p = await TemplatesApi.status('brainwave')
    expect(calls[0].url).toBe(`${API}/v1/projects/brainwave`)
    expect(calls[0].method ?? 'GET').toBe('GET')
    expect(p).toMatchObject({ status: 'live', liveUrl: 'https://x' })
  })
})
