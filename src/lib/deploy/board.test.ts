import { describe, it, expect } from 'vitest'
import {
  rowOfApp,
  rowOfSite,
  primaryHost,
  boundHosts,
  hostOf,
  byRecency,
  summarize,
  repoName,
  envVars,
  prunePublicKeys,
  partialNote,
  parseEnv,
  hostError,
  envError,
  toAppInput,
  toSiteInput,
  formError,
  hostRows,
  type DeployForm,
} from './board'
import type { PaasAppWithProject } from '~/lib/api/paas'
import type { Site } from '~/lib/api/platform-sites'

const app = (over: Partial<PaasAppWithProject> = {}): PaasAppWithProject =>
  ({
    id: 'a1',
    org: 'acme',
    projectId: 'p1',
    slug: 'api',
    name: 'API',
    status: 'live',
    domains: ['api.acme.hanzo.app'],
    updatedAt: 200,
    project: { id: 'p1', org: 'acme', slug: 'web', name: 'Web' },
    ...over,
  }) as PaasAppWithProject

const site = (over: Partial<Site> = {}): Site =>
  ({
    id: 's1',
    org: 'acme',
    slug: 'docs',
    name: 'Docs',
    repo: {},
    framework: 'static',
    status: 'live',
    liveUrl: 'https://docs.acme.hanzo.app',
    createdAt: 50,
    updatedAt: 100,
    ...over,
  }) as Site

describe('rows', () => {
  it('folds an app onto the board with its project and operator state', () => {
    const r = rowOfApp(app({ phase: 'Running', health: 'healthy' }))
    expect(r).toMatchObject({
      kind: 'app',
      slug: 'api',
      name: 'API',
      project: 'web',
      host: 'api.acme.hanzo.app',
      status: 'live',
      phase: 'Running',
      health: 'healthy',
      updatedAt: 200,
    })
  })

  it('folds a site onto the same shape, host taken from the live URL', () => {
    const r = rowOfSite(site())
    expect(r).toMatchObject({ kind: 'site', slug: 'docs', host: 'docs.acme.hanzo.app', status: 'live' })
    // A site has no project scope and no operator CR — absent, not faked.
    expect(r.project).toBeUndefined()
    expect(r.phase).toBeUndefined()
  })

  it('leaves host undefined when nothing is bound, rather than inventing one', () => {
    expect(rowOfApp(app({ domains: [] })).host).toBeUndefined()
    expect(rowOfApp(app({ domains: undefined })).host).toBeUndefined()
    expect(rowOfSite(site({ liveUrl: undefined })).host).toBeUndefined()
    expect(rowOfApp(app({ domains: [] })).hosts).toEqual([])
    expect(rowOfSite(site({ liveUrl: undefined })).hosts).toEqual([])
  })

  it('carries EVERY bound host, not just the primary', () => {
    // An app is born with its *.hanzo.app host, so a custom domain is the SECOND
    // entry — folding to the primary would hide the domain someone bound.
    const r = rowOfApp(app({ domains: ['api.acme.hanzo.app', 'api.example.com'] }))
    expect(r.host).toBe('api.acme.hanzo.app')
    expect(r.hosts).toEqual(['api.acme.hanzo.app', 'api.example.com'])
  })

  it('drops blank domain entries from the host list', () => {
    expect(boundHosts(['', ' a.example.com ', '  '])).toEqual(['a.example.com'])
    expect(boundHosts(undefined)).toEqual([])
  })

  it('skips blank domain entries when picking the primary host', () => {
    expect(primaryHost(['', '  ', 'real.example.com'])).toBe('real.example.com')
    expect(primaryHost([])).toBeUndefined()
  })

  it('falls back to the raw value when a live URL is not parseable', () => {
    expect(hostOf('docs.example.com')).toBe('docs.example.com')
    expect(hostOf('https://x.example.com/path')).toBe('x.example.com')
  })

  it('defaults a missing status to draft and a missing timestamp to 0', () => {
    const r = rowOfApp(app({ status: undefined, updatedAt: undefined, createdAt: undefined }))
    expect(r.status).toBe('draft')
    expect(r.updatedAt).toBe(0)
  })

  it('uses createdAt when the row was never updated', () => {
    expect(rowOfApp(app({ updatedAt: undefined, createdAt: 42 })).updatedAt).toBe(42)
  })
})

describe('board', () => {
  it('orders newest first without mutating the input', () => {
    const rows = [rowOfSite(site()), rowOfApp(app())]
    const sorted = byRecency(rows)
    expect(sorted.map((r) => r.slug)).toEqual(['api', 'docs'])
    expect(rows.map((r) => r.slug)).toEqual(['docs', 'api'])
  })

  it('counts only what the backend calls live', () => {
    const rows = [rowOfApp(app()), rowOfApp(app({ id: 'a2', slug: 'w', status: 'building' })), rowOfSite(site())]
    expect(summarize(rows)).toEqual({ total: 3, live: 2, apps: 2, sites: 1 })
  })
})

describe('repoName', () => {
  it('takes the last segment and drops the .git suffix', () => {
    expect(repoName('https://git.hanzo.ai/hanzoai/console.git')).toBe('console')
    expect(repoName('git@github.com:hanzoai/cloud.git')).toBe('cloud')
    expect(repoName('https://git.hanzo.ai/hanzoai/console/')).toBe('console')
  })

  it('slugifies a segment that is not already a slug', () => {
    expect(repoName('https://example.com/org/My App')).toBe('my-app')
  })

  it('is empty for a URL with no usable segment, so the form asks', () => {
    expect(repoName('')).toBe('')
    expect(repoName('///')).toBe('')
  })
})

describe('parseEnv', () => {
  it('splits on the FIRST = so a value may contain one', () => {
    expect(parseEnv('URL=postgres://u:p@h/db?x=1')).toEqual([
      { key: 'URL', value: 'postgres://u:p@h/db?x=1', secret: true },
    ])
  })

  it('skips blanks, comments, and lines with no assignment', () => {
    expect(parseEnv('\n# a comment\nPORT=8080\ngarbage\n  \n')).toEqual([
      { key: 'PORT', value: '8080', secret: true },
    ])
  })

  it('drops a line that starts with = rather than storing an empty key', () => {
    expect(parseEnv('=novalue')).toEqual([])
  })

  it('keeps an empty value when the key is real', () => {
    expect(parseEnv('EMPTY=')).toEqual([{ key: 'EMPTY', value: '', secret: true }])
  })

  it('does not unquote or expand — a credential is stored verbatim', () => {
    expect(parseEnv('TOKEN="ab$HOME"')).toEqual([{ key: 'TOKEN', value: '"ab$HOME"', secret: true }])
  })

  // The defect this replaced: a key-NAME regex decided secrecy, so these three
  // real credential names sailed through as public while the form's help text
  // promised they were sealed.
  it.each(['STRIPE_SK', 'GH_PAT', 'DB_PASS', 'PORT', 'NODE_ENV'])('seals %s by default', (key) => {
    expect(parseEnv(`${key}=x`)[0].secret).toBe(true)
  })

  it('opens ONLY the keys named public', () => {
    const got = parseEnv('PORT=8080\nSTRIPE_SK=sk_live_x', new Set(['PORT']))
    expect(got.map((e) => [e.key, e.secret])).toEqual([
      ['PORT', false],
      ['STRIPE_SK', true],
    ])
  })

  it('ignores a public key that is not present, and never opens by prefix', () => {
    expect(parseEnv('DB_PASSWORD=x', new Set(['DB_PASS', 'NOPE']))[0].secret).toBe(true)
  })
})

describe('envVars', () => {
  it('reads the public list off the form', () => {
    const form: DeployForm = { kind: 'app', name: 'a', repo: 'r', env: 'A=1\nB=2', publicKeys: ['A'] }
    expect(envVars(form).map((e) => [e.key, e.secret])).toEqual([
      ['A', false],
      ['B', true],
    ])
  })

  it('seals everything when the form names nothing public', () => {
    expect(envVars({ kind: 'app', name: 'a', repo: 'r', env: 'A=1' })[0].secret).toBe(true)
  })
})

describe('prunePublicKeys', () => {
  it('keeps a mark whose variable is still there', () => {
    expect(prunePublicKeys('PORT=8080\nDEBUG=1', ['PORT'])).toEqual(['PORT'])
  })

  it('drops a mark whose variable was deleted', () => {
    expect(prunePublicKeys('DEBUG=1', ['PORT'])).toEqual([])
    expect(prunePublicKeys('', ['PORT'])).toEqual([])
  })

  // The attack this closes: mark a harmless DATABASE_URL Public, delete it, then
  // type a new one carrying a password. Without pruning the stale mark is
  // inherited and the credential ships unsealed.
  it('does not let a mark be inherited by a later variable reusing the name', () => {
    const marked = ['DATABASE_URL']
    const afterDelete = prunePublicKeys('PORT=8080', marked)
    expect(afterDelete).toEqual([])
    const retyped = 'PORT=8080\nDATABASE_URL=postgres://u:secret@h/db'
    expect(parseEnv(retyped, new Set(afterDelete)).find((e) => e.key === 'DATABASE_URL')?.secret).toBe(true)
  })

  it('matches exactly, so a case twin never inherits the mark', () => {
    expect(prunePublicKeys('db_url=x', ['DB_URL'])).toEqual([])
    expect(parseEnv('db_url=x', new Set(['DB_URL']))[0].secret).toBe(true)
  })

  it('ignores a commented-out line — a mark cannot survive on a comment', () => {
    expect(prunePublicKeys('# PORT=8080', ['PORT'])).toEqual([])
  })
})

describe('partialNote', () => {
  it('names WHICH source is incomplete, so a reader knows which number lies', () => {
    expect(partialNote(['app'])).toMatch(/^Apps could not/)
    expect(partialNote(['site'])).toMatch(/^Sites could not/)
    expect(partialNote(['app', 'site'])).toMatch(/^Apps and sites could not/)
  })

  it('is silent for a whole board', () => {
    expect(partialNote([])).toBeNull()
  })
})

describe('envError', () => {
  it('accepts the keys the platform accepts', () => {
    expect(envError('PORT=8080\n_PRIVATE=x\nA1=y')).toBeNull()
    expect(envError('')).toBeNull()
  })

  it('names the first key the backend would reject, instead of letting it 400', () => {
    expect(envError('PORT=8080\nMY-KEY=x')).toMatch(/"MY-KEY"/)
    expect(envError('1BAD=x')).toMatch(/"1BAD"/)
  })
})

describe('hostError', () => {
  it('accepts a plain hostname', () => {
    expect(hostError('app.example.com')).toBeNull()
    expect(hostError('a-b.c.example.co.uk')).toBeNull()
  })

  it('is silent while the field is empty', () => {
    expect(hostError('')).toBeNull()
    expect(hostError('   ')).toBeNull()
  })

  it('rejects a URL, a path, and a port with a specific message', () => {
    expect(hostError('https://app.example.com')).toMatch(/https:\/\//)
    expect(hostError('app.example.com/x')).toMatch(/no path/)
    expect(hostError('app.example.com:8080')).toMatch(/no port/)
  })

  it('rejects malformed hostnames', () => {
    expect(hostError('example')).not.toBeNull()
    expect(hostError('-bad.example.com')).not.toBeNull()
    expect(hostError('app..example.com')).not.toBeNull()
    expect(hostError('app example.com')).not.toBeNull()
  })

  it('rejects a hostname over the 253-character limit', () => {
    expect(hostError(`${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.example.com`))
      .not.toBeNull()
  })
})

describe('form → create input', () => {
  const base: DeployForm = { kind: 'app', name: 'api', repo: 'https://git.hanzo.ai/hanzoai/api.git' }

  it('maps a repo + host + env to the app create body, sealing env by default', () => {
    expect(toAppInput({ ...base, branch: 'main', host: 'API.Example.COM ', env: 'PORT=8080' })).toEqual({
      name: 'api',
      source: 'git',
      repo: { url: 'https://git.hanzo.ai/hanzoai/api.git', branch: 'main' },
      env: [{ key: 'PORT', value: '8080', secret: true }],
      domains: ['api.example.com'],
    })
  })

  it('carries the per-variable public choice into the create body', () => {
    const out = toAppInput({ ...base, env: 'PORT=8080\nSTRIPE_SK=sk_live', publicKeys: ['PORT'] })
    expect(out.env).toEqual([
      { key: 'PORT', value: '8080', secret: false },
      { key: 'STRIPE_SK', value: 'sk_live', secret: true },
    ])
  })

  it('omits branch, env, and domains rather than sending empty ones', () => {
    expect(toAppInput(base)).toEqual({
      name: 'api',
      source: 'git',
      repo: { url: 'https://git.hanzo.ai/hanzoai/api.git' },
    })
    expect(toAppInput({ ...base, branch: '  ', host: '  ', env: '\n#c\n' })).toEqual({
      name: 'api',
      source: 'git',
      repo: { url: 'https://git.hanzo.ai/hanzoai/api.git' },
    })
  })

  it('builds a site body with its framework, and omits an absent repo', () => {
    expect(toSiteInput({ kind: 'site', name: 'docs', repo: '', framework: 'next' })).toEqual({
      name: 'docs',
      framework: 'next',
    })
    expect(toSiteInput({ kind: 'site', name: 'docs', repo: 'https://x/y.git', branch: 'main' })).toEqual({
      name: 'docs',
      framework: 'static',
      repo: { url: 'https://x/y.git', branch: 'main' },
    })
  })
})

describe('formError', () => {
  const app_: DeployForm = { kind: 'app', name: 'api', repo: 'https://x/y.git' }

  it('passes a complete app form', () => {
    expect(formError(app_, 'web')).toBeNull()
  })

  it('demands a name, a project, and a repo for an app', () => {
    expect(formError({ ...app_, name: ' ' }, 'web')).toMatch(/Name/)
    expect(formError(app_, null)).toMatch(/project/)
    expect(formError({ ...app_, repo: '' }, 'web')).toMatch(/Repository/)
  })

  it('surfaces a bad host', () => {
    expect(formError({ ...app_, host: 'https://x.com' }, 'web')).toMatch(/https:\/\//)
  })

  it('surfaces a bad env key before the request is made', () => {
    expect(formError({ ...app_, env: 'MY-KEY=x' }, 'web')).toMatch(/"MY-KEY"/)
  })

  it('needs neither project nor repo for a site', () => {
    expect(formError({ kind: 'site', name: 'docs', repo: '' }, null)).toBeNull()
  })
})

describe('hostRows', () => {
  it('expands a row into ONE row per bound host, so a custom domain shows', () => {
    const rows = [rowOfApp(app({ domains: ['api.acme.hanzo.app', 'api.example.com'] })), rowOfSite(site())]
    expect(hostRows(rows).map((h) => h.host)).toEqual([
      'api.acme.hanzo.app',
      'api.example.com',
      'docs.acme.hanzo.app',
    ])
  })

  it('attributes every host to its owner and kind', () => {
    expect(hostRows([rowOfSite(site())])).toEqual([
      { host: 'docs.acme.hanzo.app', owner: 'Docs', kind: 'site', status: 'live' },
    ])
  })

  it('omits a row with nothing bound', () => {
    expect(hostRows([rowOfApp(app({ domains: [] }))])).toEqual([])
  })
})
