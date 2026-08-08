import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  AppsApi,
  BROWSER_PLATFORMS,
  builderEditUrl,
  installTag,
  normalizeApp,
  normalizeApps,
  normalizeBrowserTags,
  normalizeDeployment,
  normalizeDeployments,
  normalizeTags,
  mergeTags,
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

/**
 * A site's tag config. The browser ids are PUBLIC by definition (they ship in the
 * page), so these tests are about the CONFIG being read and written faithfully — the
 * secret path is `destinations.ts` and never touches this module.
 */
describe('Site tag config — normalized like cloud sanitizes it', () => {
  it('lower-cases platforms, trims ids, and drops empties', () => {
    expect(normalizeTags({ GA4: ' G-ABC ', Meta: '179', tiktok: '   ', x: '' })).toEqual({
      ga4: 'G-ABC',
      meta: '179',
    })
  })

  it('degrades a non-object (or absent) tag bag to an empty set, never throws', () => {
    for (const bad of [undefined, null, 'nope', 42, []]) expect(normalizeTags(bad)).toEqual({})
  })

  it('carries the publishable key and tags onto the site view', () => {
    const a = normalizeApp({ slug: 'landing', key: 'pk-abc123', tags: { ga4: 'G-1' } })
    expect(a.key).toBe('pk-abc123')
    expect(a.tags).toEqual({ ga4: 'G-1' })
  })

  it('a site with no tags reads as an empty set, not undefined (cloud omits the field)', () => {
    const a = normalizeApp({ slug: 'landing' })
    expect(a.tags).toEqual({})
    expect(a.key).toBe('')
  })

  it('offers exactly the four platforms cloud injects a browser pixel for', () => {
    expect(BROWSER_PLATFORMS.map((p) => p.platform)).toEqual(['ga4', 'meta', 'tiktok', 'x'])
  })
})

/**
 * The write is a REPLACE, so the merge is the one place the console can destroy config
 * it never rendered. These pin that it cannot.
 */
describe('mergeTags — a replacing write must not delete what the form never showed', () => {
  it('KEEPS a platform the console does not render (the server CAPI reads it too)', () => {
    expect(mergeTags({ ga4: 'G-OLD', reddit: 'rd-1' }, { ga4: 'G-NEW' })).toEqual({
      ga4: 'G-NEW',
      reddit: 'rd-1',
    })
  })

  it('removes a rendered platform whose id was cleared — that is how a pixel comes off', () => {
    expect(mergeTags({ ga4: 'G-OLD', meta: '179' }, { ga4: 'G-OLD', meta: '' })).toEqual({ ga4: 'G-OLD' })
    expect(mergeTags({ meta: '179' }, { meta: '   ' })).toEqual({})
  })

  it('adds a newly-typed platform and trims it', () => {
    expect(mergeTags({}, { tiktok: ' C4 ' })).toEqual({ tiktok: 'C4' })
  })

  it('does not mutate the site it was given', () => {
    const current = { ga4: 'G-OLD' }
    mergeTags(current, { ga4: '' })
    expect(current).toEqual({ ga4: 'G-OLD' })
  })

  it('an untouched draft round-trips the stored set unchanged', () => {
    const current = { ga4: 'G-1', meta: '2', reddit: 'rd' }
    expect(mergeTags(current, current)).toEqual(current)
  })
})

describe('Browser tag door — the RESOLVED set, defensively', () => {
  it('reads the {tags:[…]} envelope the door answers with', () => {
    expect(
      normalizeBrowserTags({
        tags: [
          { platform: 'ga4', type: 'ga', id: 'G-ABC' },
          { platform: 'meta', type: 'meta', id: '179' },
        ],
      }),
    ).toEqual([
      { platform: 'ga4', type: 'ga', id: 'G-ABC' },
      { platform: 'meta', type: 'meta', id: '179' },
    ])
  })

  it('drops a tag with no platform or no id — it would inject nothing', () => {
    const out = normalizeBrowserTags({ tags: [{ platform: 'ga4', id: '' }, { id: 'G-1' }, {}] })
    expect(out).toEqual([])
  })

  it('an empty / garbage payload is an empty set (the door fails safe at 200)', () => {
    for (const bad of [{ tags: [] }, {}, null, 'nope']) expect(normalizeBrowserTags(bad)).toEqual([])
  })
})

describe('installTag — the one-line install', () => {
  it('names the PUBLIC api host, not the console origin the operator happens to be on', () => {
    expect(installTag('pk-abc')).toBe(
      '<script defer src="https://api.hanzo.ai/v1/event.js" data-key="pk-abc"></script>',
    )
  })

  it('is prefix-free /v1 and carries the key as data-key, with no trailing-slash artifact', () => {
    const s = installTag('pk-abc', 'https://api.hanzo.ai/')
    expect(s).toContain('/v1/event.js')
    expect(s).not.toContain('//v1/')
    expect(s).not.toContain('/api/v1/')
  })
})

describe('AppsApi tag routes — same-origin, prefix-free', () => {
  const fetched: { url: string; method: string; body?: string }[] = []

  beforeEach(() => {
    fetched.length = 0
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      fetched.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
      const body = url.includes('/v1/tags')
        ? { tags: [{ platform: 'ga4', type: 'ga', id: 'G-ABC' }] }
        : { slug: 'landing', key: 'pk-abc', tags: { ga4: 'G-ABC' } }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('PATCHes the whole tag set to the site the URL names', async () => {
    const out = await AppsApi.setTags('landing', { ga4: 'G-ABC' })
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/projects/landing`)
    expect(fetched[0].method).toBe('PATCH')
    expect(JSON.parse(fetched[0].body ?? '{}')).toEqual({ tags: { ga4: 'G-ABC' } })
    expect(out.tags).toEqual({ ga4: 'G-ABC' })
  })

  it('sends {} to CLEAR — a present object replaces the set, so removal is expressible', async () => {
    await AppsApi.setTags('landing', {})
    expect(JSON.parse(fetched[0].body ?? '{}')).toEqual({ tags: {} })
  })

  it('never sends a slug in the body — the URL is the addressing authority', async () => {
    await AppsApi.setTags('landing', { ga4: 'G-1' })
    expect(JSON.parse(fetched[0].body ?? '{}')).not.toHaveProperty('slug')
  })

  it('previews through the public door, url-encoding the key', async () => {
    const out = await AppsApi.browserTags('pk-a b&c')
    expect(fetched[0].url).toBe(`${ORIGIN}/v1/tags?key=pk-a%20b%26c`)
    expect(fetched[0].url).not.toContain('/api/')
    expect(out).toEqual([{ platform: 'ga4', type: 'ga', id: 'G-ABC' }])
  })
})
