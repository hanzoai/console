import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  AppsApi,
  builderEditUrl,
  normalizeApp,
  normalizeApps,
  normalizeDeployment,
  normalizeDeployments,
} from './apps'

/**
 * Apps API (the hanzo.app buildable-sites store) + pure normalizers. The module
 * calls the DOCUMENTED cloud `/v1/projects` contract same-origin, keyless and
 * prefix-free (`originV1Url` → `<origin>/v1/projects`); `next.config.mjs` rewrites
 * that head to the user-bearer `/v1` proxy. These tests pin (1) each call hits
 * the EXACT same-origin `/v1/projects` path (the canonical Agents/CRM form — never a
 * direct cloud-origin call, which 403s), (2) the real projectsvc JSON shape
 * (projectView/deploymentView) normalizes, (3) a bare array + the flat store-column
 * fallback both read, (4) garbage degrades to a safe default — never throws, and
 * (5) the `hanzo.app/dev?project=<slug>` edit deep-link is built injection-safe.
 */
const ORIGIN = 'https://console.hanzo.ai'

describe('Apps normalizers — real projectsvc JSON shape, defensive', () => {
  it('normalizes a project view with the nested repo object', () => {
    const a = normalizeApp({
      id: 'proj_1',
      org: 'maxpower',
      slug: 'landing',
      name: 'Landing Page',
      description: 'Our marketing site',
      repo: { url: 'https://github.com/maxpower/landing', branch: 'main', provider: 'github' },
      framework: 'nextjs',
      status: 'live',
      liveUrl: 'https://landing.maxpower.hanzo.app',
      bucket: 'sites',
      currentDeploymentId: 'dep_9',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(a).toMatchObject({
      id: 'proj_1',
      slug: 'landing',
      name: 'Landing Page',
      framework: 'nextjs',
      status: 'live',
      liveUrl: 'https://landing.maxpower.hanzo.app',
      currentDeploymentId: 'dep_9',
    })
    expect(a.repo).toEqual({ url: 'https://github.com/maxpower/landing', branch: 'main', provider: 'github' })
  })

  it('reads the FLAT store columns when the HTTP repo/currentDeploy shape is absent', () => {
    const a = normalizeApp({
      id: 'proj_2',
      slug: 'blog',
      repoUrl: 'https://github.com/maxpower/blog',
      repoBranch: 'dev',
      repoProvider: 'github',
      currentDeploy: 'dep_2',
    })
    expect(a.repo).toEqual({ url: 'https://github.com/maxpower/blog', branch: 'dev', provider: 'github' })
    expect(a.currentDeploymentId).toBe('dep_2')
  })

  it('coerces missing/garbage fields to safe defaults (never throws)', () => {
    const a = normalizeApp({ slug: 'bare' })
    expect(a).toMatchObject({ slug: 'bare', name: '', status: '', liveUrl: '', framework: '' })
    expect(a.repo).toEqual({ url: '', branch: '', provider: '' })
    // A non-object degrades to an empty (identity-less) record, filtered out of lists.
    expect(normalizeApp(null).slug).toBe('')
  })

  it('lists projects from a bare array (projectsvc returns a bare array) and drops identity-less rows', () => {
    const out = normalizeApps([{ slug: 'a', name: 'A' }, null, 'x', { slug: 'b', name: 'B' }])
    expect(out.map((a) => a.slug)).toEqual(['a', 'b'])
    // ...and also from any common envelope key (defense in depth).
    expect(normalizeApps({ projects: [{ slug: 'c' }] }).map((a) => a.slug)).toEqual(['c'])
    expect(normalizeApps({ data: [{ slug: 'd' }] }).map((a) => a.slug)).toEqual(['d'])
  })

  it('normalizes a deployment and sorts the list newest-first (highest version)', () => {
    const d = normalizeDeployment({ id: 'dep_1', projectId: 'proj_1', version: 3, status: 'live', files: 12, bytes: 4096 })
    expect(d).toMatchObject({ id: 'dep_1', version: 3, status: 'live', files: 12, bytes: 4096 })
    const list = normalizeDeployments([
      { id: 'dep_1', version: 1, status: 'superseded' },
      { id: 'dep_3', version: 3, status: 'live' },
      { id: 'dep_2', version: 2, status: 'superseded' },
      { id: '', version: 9 }, // no id → dropped
    ])
    expect(list.map((x) => x.version)).toEqual([3, 2, 1])
  })
})

describe('builderEditUrl — the console→hanzo.app edit deep-link', () => {
  it('opens the existing project in the hanzo.app builder (/dev?project=<slug>)', () => {
    expect(builderEditUrl('landing')).toBe('https://hanzo.app/dev?project=landing')
    expect(builderEditUrl('landing', 'https://hanzo.app/')).toBe('https://hanzo.app/dev?project=landing')
    // A brand-scoped app base (env override) is honored.
    expect(builderEditUrl('site', 'https://app.zoo.ngo')).toBe('https://app.zoo.ngo/dev?project=site')
  })

  it('is injection-safe — a hostile slug is URL-encoded, never escapes the query', () => {
    const url = builderEditUrl('a&b=c#d e')
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/dev')
    // The entire slug is the single `project` param; nothing leaks into another key.
    expect(parsed.searchParams.get('project')).toBe('a&b=c#d e')
    expect([...parsed.searchParams.keys()]).toEqual(['project'])
  })
})

describe('AppsApi — hits the same-origin /v1/projects contract (rewritten to the /v1 bearer proxy)', () => {
  const fetched: { url: string; method: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET' })
      const body = url.endsWith('/deployments')
        ? [{ id: 'dep_1', version: 1, status: 'live' }]
        : url.match(/\/v1\/projects\/[^/]+$/)
          ? { slug: 'landing', name: 'Landing' }
          : [{ slug: 'landing', name: 'Landing', status: 'live' }]
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('lists sites via the same-origin /v1/projects path (not a direct cloud-origin call)', async () => {
    const out = await AppsApi.list()
    expect(fetched[0]).toEqual({ url: `${ORIGIN}/v1/projects`, method: 'GET' })
    expect(fetched[0].url).not.toContain('/cloud/')
    expect(out.map((a) => a.slug)).toEqual(['landing'])
  })

  it('gets one site by slug and its deployments through the proxy path', async () => {
    await AppsApi.get('landing')
    await AppsApi.deployments('landing')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/projects/landing`)
    expect(fetched[1].url).toBe(`${ORIGIN}/v1/projects/landing/deployments`)
  })
})
