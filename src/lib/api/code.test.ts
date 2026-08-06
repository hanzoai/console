import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  CodeApi,
  canonicalType,
  normalizeSpan,
  normalizeSpans,
  normalizeSearch,
  normalizeCitation,
  normalizeAsk,
  normalizeContext,
  searchFacets,
  spanKey,
  locRef,
  fullRef,
  fmtScore,
  scoreFraction,
  SEARCH_LIMIT,
  type Span,
} from './code'

/** A minimal span factory for the pure-logic tests. */
const span = (over: Partial<Span> = {}): Span => ({
  repo: over.repo ?? 'hanzoai/cloud',
  file: over.file ?? 'clients/code/code.go',
  line: over.line ?? 10,
  endLine: over.endLine ?? 10,
  snippet: over.snippet ?? 'func Mount() {}',
  score: over.score ?? 0.03,
  ...over,
})

describe('canonicalType', () => {
  it('keeps the four surfaced modes and defaults unknown/empty to hybrid', () => {
    expect(canonicalType('text')).toBe('text')
    expect(canonicalType('symbol')).toBe('symbol')
    expect(canonicalType('semantic')).toBe('semantic')
    expect(canonicalType('hybrid')).toBe('hybrid')
    // `regex` is a real backend type we don't surface — folds to the default.
    expect(canonicalType('regex')).toBe('hybrid')
    expect(canonicalType(undefined)).toBe('hybrid')
    expect(canonicalType('WEIRD')).toBe('hybrid')
  })
})

describe('normalizeSpan', () => {
  it('reads a full hit and clamps endLine below line up to line', () => {
    const s = normalizeSpan({
      repo: 'hanzoai/cloud', file: 'clients/code/search.go', line: 13, endLine: 24,
      kind: 'type', symbol: 'Span', snippet: 'type Span struct {}', score: 0.0166, tier: 'symbol', role: 'match',
    })
    expect(s).toMatchObject({ repo: 'hanzoai/cloud', file: 'clients/code/search.go', line: 13, endLine: 24, kind: 'type', symbol: 'Span', score: 0.0166, tier: 'symbol', role: 'match' })
  })

  it('reads alt keys (path/text/name) and defaults endLine to line', () => {
    const s = normalizeSpan({ path: 'a/b.ts', line: 5, text: 'const x = 1', name: 'x' })
    expect(s).toMatchObject({ file: 'a/b.ts', line: 5, endLine: 5, snippet: 'const x = 1', symbol: 'x' })
    expect(s?.score).toBe(0) // no score → real 0, never fabricated
  })

  it('drops a hit with no file (the locator is mandatory)', () => {
    expect(normalizeSpan({ line: 3, snippet: 'x' })).toBeNull()
    expect(normalizeSpan({})).toBeNull()
  })
})

describe('normalizeSpans (envelope-agnostic)', () => {
  it('reads under results / spans / data / items / rows or a bare array', () => {
    const rows = [{ file: 'x.go', line: 1 }, { file: 'y.go', line: 2 }]
    for (const payload of [rows, { results: rows }, { spans: rows }, { data: rows }, { items: rows }, { rows }]) {
      expect(normalizeSpans(payload)).toHaveLength(2)
    }
    expect(normalizeSpans(null)).toEqual([])
    expect(normalizeSpans({ nope: rows })).toEqual([])
  })
})

describe('normalizeSearch', () => {
  it('reads query/type/results and the degraded flag', () => {
    const r = normalizeSearch({ query: 'mount', type: 'symbol', results: [{ file: 'a.go', line: 1 }], degraded: true }, 'hybrid')
    expect(r).toMatchObject({ query: 'mount', type: 'symbol', degraded: true })
    expect(r.results).toHaveLength(1)
  })
  it('falls back to the requested type and degraded=false', () => {
    const r = normalizeSearch({ results: [] }, 'text')
    expect(r.type).toBe('text')
    expect(r.degraded).toBe(false)
  })
})

describe('normalizeCitation + normalizeAsk', () => {
  it('reads the answer + citations, dropping citations with no file', () => {
    const a = normalizeAsk({
      question: 'where is auth?', answer: 'In middleware_identity.go.',
      citations: [{ file: 'middleware_identity.go', line: 40, endLine: 52, symbol: 'Sanitize' }, { line: 9 }],
    })
    expect(a).toMatchObject({ question: 'where is auth?', answer: 'In middleware_identity.go.', degraded: false })
    expect(a.citations).toHaveLength(1)
    expect(a.citations[0]).toMatchObject({ file: 'middleware_identity.go', line: 40, endLine: 52, symbol: 'Sanitize' })
  })
  it('marks degraded and reads an empty answer', () => {
    const a = normalizeAsk({ question: 'q', citations: [], degraded: true })
    expect(a).toMatchObject({ answer: '', degraded: true, citations: [] })
  })
  it('normalizeCitation drops a fileless row and clamps endLine', () => {
    expect(normalizeCitation({ line: 1 })).toBeNull()
    expect(normalizeCitation({ file: 'a.go', line: 5, endLine: 2 })).toMatchObject({ line: 5, endLine: 5 })
  })
})

describe('normalizeContext', () => {
  it('reads the budget-packed bundle (spans under spans OR results)', () => {
    const b = normalizeContext({ query: 'x', repo: 'r', budgetTokens: 4000, usedTokens: 512, spans: [{ file: 'a.go', line: 1 }] })
    expect(b).toMatchObject({ query: 'x', repo: 'r', budgetTokens: 4000, usedTokens: 512 })
    expect(b.spans).toHaveLength(1)
    expect(normalizeContext({ results: [{ file: 'b.go', line: 2 }] }).spans).toHaveLength(1)
  })
})

describe('searchFacets', () => {
  it('derives count, distinct repos, tier + kind breakdown, and max score', () => {
    const f = searchFacets([
      span({ repo: 'a', tier: 'symbol', kind: 'func', score: 0.02 }),
      span({ repo: 'a', tier: 'text', score: 0.05 }),
      span({ repo: 'b', tier: 'symbol', kind: 'type', score: 0.01 }),
    ])
    expect(f.count).toBe(3)
    expect(f.repos).toEqual(['a', 'b'])
    expect(f.tiers).toEqual({ symbol: 2, text: 1 })
    expect(f.kinds).toEqual({ func: 1, type: 1 })
    expect(f.maxScore).toBeCloseTo(0.05, 5)
  })
  it('is empty-safe', () => {
    expect(searchFacets([])).toEqual({ count: 0, repos: [], tiers: {}, kinds: {}, maxScore: 0 })
  })
})

describe('refs + formatters', () => {
  it('locRef / fullRef render file:line (with a range) and prepend repo', () => {
    expect(locRef({ file: 'a.go', line: 5 })).toBe('a.go:5')
    expect(locRef({ file: 'a.go', line: 5, endLine: 9 })).toBe('a.go:5-9')
    expect(locRef({})).toBe('—')
    expect(fullRef({ repo: 'org/repo', file: 'a.go', line: 5 })).toBe('org/repo a.go:5')
    expect(fullRef({ file: 'a.go', line: 5 })).toBe('a.go:5')
  })
  it('fmtScore formats small + large scores and em-dashes non-finite', () => {
    expect(fmtScore(0.0166)).toBe('0.017')
    expect(fmtScore(1.5)).toBe('1.50')
    expect(fmtScore(undefined)).toBe('—')
    expect(fmtScore(Number.NaN)).toBe('—')
  })
  it('scoreFraction clamps to 0..1 against the set max', () => {
    expect(scoreFraction(0.05, 0.1)).toBeCloseTo(0.5, 5)
    expect(scoreFraction(0.2, 0.1)).toBe(1)
    expect(scoreFraction(0.05, 0)).toBe(0) // no max → no bar (never divide by zero)
  })
  it('spanKey is position-qualified so identical locators do not clash', () => {
    const s = span({ repo: 'r', file: 'a.go', line: 1 })
    expect(spanKey(s, 0)).not.toBe(spanKey(s, 1))
  })
})

/**
 * The `/v1/code/*` routes live on the canonical API host, are prefix-free, and carry NO
 * org param — the cloud handler resolves the org from the bearer's owner claim (a
 * PHYSICAL per-org SQLite file). These pin that the client builds the right path + query
 * and NEVER leaks an org param client-side.
 */
describe('CodeApi — canonical API host, prefix-free, no client-side org', () => {
  /** The PAGE origin — where the console is served from. */
  const ORIGIN = 'https://console.hanzo.ai'
  /** The API host — where it calls, whatever origin it was served from. */
  const API = 'https://api.hanzo.ai'
  let calls: { url: string; method: string; body?: string }[] = []

  beforeEach(() => {
    calls = []
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: { method?: string; body?: string }) => {
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), body: init?.body })
      return Promise.resolve(
        new Response(JSON.stringify({ query: 'q', type: 'hybrid', results: [], spans: [], citations: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('search GETs /v1/code/search?q&type&limit — no org param', async () => {
    await CodeApi.search('Mount func', 'symbol')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    const u = new URL(calls[0].url)
    expect(u.origin + u.pathname).toBe(`${API}/v1/code/search`)
    expect(u.searchParams.get('q')).toBe('Mount func')
    expect(u.searchParams.get('type')).toBe('symbol')
    expect(u.searchParams.get('limit')).toBe(String(SEARCH_LIMIT))
    // The org is NEVER a client-side param — the bearer owner scopes tenancy server-side.
    expect(u.searchParams.has('org')).toBe(false)
    expect(u.searchParams.has('X-Org-Id')).toBe(false)
  })

  it('search includes the repo scope only when provided', async () => {
    await CodeApi.search('x', 'hybrid', 'hanzoai/cloud')
    expect(new URL(calls[0].url).searchParams.get('repo')).toBe('hanzoai/cloud')
    calls = []
    await CodeApi.search('x', 'hybrid', '')
    expect(new URL(calls[0].url).searchParams.has('repo')).toBe(false)
  })

  it('ask GETs /v1/code/ask?q (+repo), no org param', async () => {
    await CodeApi.ask('where is auth validated?', 'hanzoai/cloud')
    const u = new URL(calls[0].url)
    expect(u.origin + u.pathname).toBe(`${API}/v1/code/ask`)
    expect(u.searchParams.get('q')).toBe('where is auth validated?')
    expect(u.searchParams.get('repo')).toBe('hanzoai/cloud')
    expect(u.searchParams.has('org')).toBe(false)
  })

  it('context POSTs /v1/code/context with a JSON body', async () => {
    await CodeApi.context('pack this', 'hanzoai/cloud', 4000)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${API}/v1/code/context`)
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({ query: 'pack this', repo: 'hanzoai/cloud', budgetTokens: 4000 })
  })
})
