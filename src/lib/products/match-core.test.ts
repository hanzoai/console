import { describe, expect, it } from 'vitest'

import {
  resolveRoute,
  entryMatches,
  productSubpages,
  resolveProductView,
  subpageIsWired,
  isAdminView,
  destinationsFor,
  canonicalSlug,
  SLUG_ALIASES,
  BASE_SUBPAGES,
  baseSubpagesFor,
  subpageSlug,
  subpageHref,
  activeSubpage,
} from './match-core'
import type { CatalogEntry, ProductModule } from './registry'

// Runtime stubs for the type-only icon/component fields (matching never renders).
const C = (() => null) as unknown as ProductModule['routes'][number]['component']
const I = (() => null) as unknown as ProductModule['icon']

/**
 * Fixtures mirror the REAL registry shape after the models merge:
 *   /models                → catalog (index)
 *   /models/<tab>          → tab view  (e.g. routing)
 *   /models/routing/<name> → edit/create a route
 */
const modules: ProductModule[] = [
  {
    id: 'models',
    label: 'Models',
    icon: I,
    description: 'Browse the live model catalog and configure routing policy.',
    routes: [
      { path: '', component: C },
      { path: ':tab', component: C },
      { path: 'routing/:name', component: C },
    ],
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: I,
    description: '',
    routes: [
      { path: '', component: C },
      { path: ':name', component: C },
    ],
  },
]

describe('resolveRoute — the models merge routing (ask 1)', () => {
  it('lands /models on the catalog (index) by default', () => {
    const m = resolveRoute(modules, ['models'])
    expect(m?.module.id).toBe('models')
    expect(m?.route.path).toBe('')
    expect(m?.params).toEqual({})
  })

  it('resolves the secondary routing tab', () => {
    const m = resolveRoute(modules, ['models', 'routing'])
    expect(m?.route.path).toBe(':tab')
    expect(m?.params).toEqual({ tab: 'routing' })
  })

  it('resolves create + edit under routing/<name>', () => {
    expect(resolveRoute(modules, ['models', 'routing', 'new'])?.params).toEqual({ name: 'new' })
    expect(resolveRoute(modules, ['models', 'routing', 'gpt-4o'])?.params).toEqual({ name: 'gpt-4o' })
    // The deeper pattern is matched by segment count, never the shorter :tab.
    expect(resolveRoute(modules, ['models', 'routing', 'new'])?.route.path).toBe('routing/:name')
  })

  it('returns null for an unknown module or over-long slug', () => {
    expect(resolveRoute(modules, ['nope'])).toBeNull()
    expect(resolveRoute(modules, [])).toBeNull()
    expect(resolveRoute(modules, ['models', 'routing', 'a', 'b'])).toBeNull()
  })
})

describe('entryMatches — the sidebar filter (ask 4)', () => {
  const entry = {
    id: 'vector',
    label: 'Vector',
    icon: I,
    description: 'Managed vector database — embeddings & semantic search.',
    category: 'Data',
    status: 'enabled',
    gcp: 'Vertex Vector Search',
    kind: 'module',
    routes: [],
  } as unknown as CatalogEntry

  it('is permissive on empty query and case-insensitive on real matches', () => {
    expect(entryMatches(entry, '')).toBe(true)
    expect(entryMatches(entry, '   ')).toBe(true)
    expect(entryMatches(entry, 'VECTOR')).toBe(true)
    expect(entryMatches(entry, 'vec')).toBe(true)
  })

  it('matches across id, category, gcp, and description — not just the label', () => {
    expect(entryMatches(entry, 'data')).toBe(true) // category
    expect(entryMatches(entry, 'vertex')).toBe(true) // gcp
    expect(entryMatches(entry, 'semantic')).toBe(true) // description
    expect(entryMatches(entry, 'kubernetes')).toBe(false)
  })
})

// ── The level-2 sub-page contract (asks 1 & 2) ───────────────────────────────

/** Build a module catalog entry with optional declared sub-pages + routes. */
const mod = (
  id: string,
  extra: Partial<CatalogEntry> & { routes?: ProductModule['routes'] } = {},
): CatalogEntry =>
  ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    icon: I,
    description: '',
    category: 'AI',
    status: 'enabled',
    kind: 'module',
    routes: extra.routes ?? [{ path: '', component: C }],
    ...extra,
  }) as unknown as CatalogEntry

// A registry mirroring the real shape: a :tab product (models, with an admin-only
// Routing specific), a single-screen product (vpc), a product with a declared
// specific that has NO route yet (tasks › queues), and an admin product.
const models = mod('models', {
  subpages: [{ slug: 'routing', label: 'Routing', admin: true }],
  routes: [
    { path: '', component: C },
    { path: ':tab', component: C },
  ],
})
const vpc = mod('vpc')
const tasks = mod('tasks', {
  subpages: [{ slug: 'queues', label: 'Queues' }],
  routes: [
    { path: '', component: C },
    { path: ':ns/:wid', component: C },
  ],
})
const providers = mod('providers', { admin: true })
// The ONE native Automations module — `/auto` and `/automation` alias to it (the
// external auto.hanzo.ai engine + its `/v1/auto` proxy are retired).
const automations = mod('automations', { label: 'Automations', category: 'AI' })
// A genuinely-EXTERNAL product (a Lux chain-app launch tile): owns no in-console
// route; a direct URL resolves to `external`, not 404. Proves the external-kind
// machinery still holds for the chain-app tiles after the auto entry became native.
const luxExplorer = mod('lux-explorer', {
  label: 'Explorer',
  category: 'Web3',
  kind: 'external',
  href: 'https://explore.lux.network',
  routes: undefined,
} as never)
// A defensive edge case: an entry that VIOLATES the module contract (kind is not
// 'module'). The catalog type is module-only now, but the match-core guards
// (`kind !== 'module'`) still fail closed for any malformed entry that slips
// through at runtime — this fixture proves the guard holds.
const nonModule = mod('bogus', { kind: 'other', routes: undefined } as never)
// The canonical targets of the human-slug aliases (traces→o11y, deploy→app-platform,
// plans-pricing→plans, wallets→wallet, fine-tuning→finetuning, web-search→websearch,
// git→code — the former standalone Git product folded into the unified Code hub).
// Present so the alias table's "every target is a real id" invariant is provable and
// a direct alias URL resolves to the real module (never a 404). `models` already exists.
const o11y = mod('o11y', { label: 'Traces', category: 'Observe' })
const appPlatform = mod('app-platform', { label: 'App Platform', category: 'Platform' })
const plans = mod('plans', { label: 'Plans', category: 'Settings' })
const wallet = mod('wallet', { label: 'Wallet', category: 'Web3' })
const finetuning = mod('finetuning', { label: 'Fine-tuning', category: 'Training' })
const websearch = mod('websearch', { label: 'Web Search', category: 'AI' })
const code = mod('code', { label: 'Code', category: 'Dev' })

const CATALOG: CatalogEntry[] = [models, vpc, tasks, providers, automations, luxExplorer, o11y, appPlatform, plans, wallet, finetuning, websearch, code, nonModule]
const MODULES = CATALOG.filter((e) => e.kind === 'module').map((e) => e as unknown as ProductModule)

describe('productSubpages — Overview + specifics + uniform base set', () => {
  const slugs = (e: CatalogEntry, showAdmin = true) => productSubpages(e, showAdmin).map((s) => s.slug)

  it('auto-adds Overview + the base set to a single-screen product', () => {
    expect(slugs(vpc)).toEqual(['', 'settings', 'logs', 'metrics', 'status'])
  })
  it('places a specific between Overview and the base set', () => {
    // models declares Routing (admin) — visible to an admin, before the base set.
    expect(slugs(models, true)).toEqual(['', 'routing', 'settings', 'logs', 'metrics', 'status'])
  })
  it('does NOT duplicate a base slug a product declares as a specific', () => {
    const withMetrics = mod('x', { subpages: [{ slug: 'metrics', label: 'Metrics' }] })
    expect(slugs(withMetrics)).toEqual(['', 'metrics', 'settings', 'logs', 'status'])
  })
  it('hides an admin-only specific from a customer', () => {
    expect(slugs(models, false)).toEqual(['', 'settings', 'logs', 'metrics', 'status'])
  })
  it('drops a base slug that IS the product — Settings has no Settings child', () => {
    // The org-Settings product owns the `settings` concept; a base `settings`
    // sub-page beneath it is the `Settings › Settings` the rail used to show.
    expect(slugs(mod('settings'))).toEqual(['', 'logs', 'metrics', 'status'])
    // Same rule for the Observe products named after a base slug.
    expect(slugs(mod('logs'))).toEqual(['', 'settings', 'metrics', 'status'])
    expect(slugs(mod('metrics'))).toEqual(['', 'settings', 'logs', 'status'])
    expect(slugs(mod('status'))).toEqual(['', 'settings', 'logs', 'metrics'])
  })
  it('fails closed (empty sub-pages) for a non-module entry', () => {
    expect(productSubpages(nonModule)).toEqual([])
  })
  it('BASE_SUBPAGES is exactly Settings · Logs · Metrics · Status', () => {
    expect(BASE_SUBPAGES.map((s) => s.slug)).toEqual(['settings', 'logs', 'metrics', 'status'])
  })
  it('a product that IS a base concern never gets a self-referential base tab', () => {
    // The Settings product: General (index) · Branding, then the base set MINUS
    // its own 'settings' — no second "Settings" tab of itself (the reported bug).
    const settings = mod('settings', { indexLabel: 'General', subpages: [{ slug: 'branding', label: 'Branding' }] })
    expect(slugs(settings)).toEqual(['', 'branding', 'logs', 'metrics', 'status'])
    // Same one rule for the other three Observe products named after a base slug.
    expect(slugs(mod('logs'))).toEqual(['', 'settings', 'metrics', 'status'])
    expect(slugs(mod('metrics'))).toEqual(['', 'settings', 'logs', 'status'])
    expect(slugs(mod('status'))).toEqual(['', 'settings', 'logs', 'metrics'])
    // The rule is expressed once: baseSubpagesFor drops only the self-named slug.
    expect(baseSubpagesFor(mod('settings')).map((s) => s.slug)).toEqual(['logs', 'metrics', 'status'])
    expect(baseSubpagesFor(mod('vpc')).map((s) => s.slug)).toEqual(['settings', 'logs', 'metrics', 'status'])
  })
})

describe('the ONE level-2 nav — one declaration, read by both the rail and the strip', () => {
  it('names the index after the product when it owns one (Models is a Catalog)', () => {
    const named = mod('models2', { indexLabel: 'Catalog', subpages: [{ slug: 'blend', label: 'Blend' }] })
    expect(productSubpages(named).map((s) => s.label)).toEqual([
      'Catalog', 'Blend', 'Settings', 'Logs', 'Metrics', 'Status',
    ])
  })
  it('falls back to Overview when the product does not name its index', () => {
    expect(productSubpages(vpc)[0].label).toBe('Overview')
  })

  it('validates a URL segment against the declaration — an unknown tab is the index', () => {
    expect(subpageSlug(models, 'routing')).toBe('routing')
    expect(subpageSlug(models, 'bogus')).toBe('')
    expect(subpageSlug(models, undefined)).toBe('')
  })
  it('refuses an admin-only tab for a customer, so the module cannot light it', () => {
    expect(subpageSlug(models, 'routing', false)).toBe('')
  })
  it('accepts a base sub-page (the shared Status/Logs/Metrics/Settings views)', () => {
    expect(subpageSlug(vpc, 'metrics')).toBe('metrics')
  })

  it('builds one URL per screen — the index has no trailing segment', () => {
    expect(subpageHref('models', '')).toBe('/models')
    expect(subpageHref('models', 'blend')).toBe('/models/blend')
  })

  it('reads the level back OUT of the URL, so reload and Back agree', () => {
    expect(activeSubpage('/models', 'models')).toBe('')
    expect(activeSubpage('/models/blend', 'models')).toBe('blend')
    // A deeper route still reports its level-2 parent (routing/<name> → routing).
    expect(activeSubpage('/models/routing/new', 'models')).toBe('routing')
    // Another product's path never lights this product's nav.
    expect(activeSubpage('/tasks/queues', 'models')).toBe('')
  })
})

describe('resolveProductView — base sub-pages are the shared per-product view (ask 2)', () => {
  const view = (slug: string[]) => resolveProductView(CATALOG, MODULES, slug)

  it('renders a real route for the index and a declared :tab specific', () => {
    expect(view(['models']).kind).toBe('route')
    expect(view(['models', 'routing']).kind).toBe('route') // declared specific → :tab
  })
  it('routes an undeclared BASE sub-page to the shared per-product sub-page (single-screen)', () => {
    const v = view(['vpc', 'status'])
    expect(v.kind).toBe('subpage')
    if (v.kind === 'subpage') expect(v.subpage.slug).toBe('status')
  })
  it('a :tab route NEVER swallows a base slug — Metrics/Status is the real per-product view', () => {
    // models declares only Routing; status/logs/metrics are NOT its specifics, so
    // they render the shared per-product sub-page, not the module's default :tab.
    expect(view(['models', 'status']).kind).toBe('subpage')
    expect(view(['models', 'metrics']).kind).toBe('subpage')
    expect(view(['models', 'logs']).kind).toBe('subpage')
  })
  it('a product that OWNS a base slug as a declared specific keeps its bespoke route', () => {
    // e.g. Embeddings › Settings / Prompts › Metrics — the product handles it.
    const emb = mod('emb', {
      subpages: [{ slug: 'settings', label: 'Settings' }],
      routes: [
        { path: '', component: C },
        { path: ':tab', component: C },
      ],
    })
    const cat = [emb]
    const mods = cat.map((e) => e as unknown as ProductModule)
    expect(resolveProductView(cat, mods, ['emb', 'settings']).kind).toBe('route')
    // …but an UNowned base slug on the same product is still the shared view.
    expect(resolveProductView(cat, mods, ['emb', 'status']).kind).toBe('subpage')
  })
  it('the router agrees with the nav: a product IS-that-concern URL is not a base subpage', () => {
    // Settings (a :tab product): /settings/settings is NOT the shared per-product
    // Settings view — it falls through to the module (which lands on the index),
    // so there is never a self-referential Settings screen. Its OTHER base slugs
    // still render the shared view.
    const settings = mod('settings', {
      indexLabel: 'General',
      subpages: [{ slug: 'branding', label: 'Branding' }],
      routes: [
        { path: '', component: C },
        { path: ':tab', component: C },
      ],
    })
    const cat = [settings]
    const mods = cat.map((e) => e as unknown as ProductModule)
    expect(resolveProductView(cat, mods, ['settings', 'settings']).kind).not.toBe('subpage')
    expect(resolveProductView(cat, mods, ['settings', 'status']).kind).toBe('subpage')
    // A single-screen product named after a base slug: the self-URL is an honest
    // 404 (nothing links there), while its other base slugs render the shared view.
    const logs = mod('logs')
    const lcat = [logs]
    const lmods = lcat.map((e) => e as unknown as ProductModule)
    expect(resolveProductView(lcat, lmods, ['logs', 'logs']).kind).toBe('notfound')
    expect(resolveProductView(lcat, lmods, ['logs', 'metrics']).kind).toBe('subpage')
  })
  it('stubs a DECLARED non-base specific that has no route yet (Tasks › Queues)', () => {
    const v = view(['tasks', 'queues'])
    expect(v.kind).toBe('stub')
    if (v.kind === 'stub') expect(v.subpage.label).toBe('Queues')
  })
  // ANTI-DRIFT (the "zero coming-soon" guarantee for sub-pages): the ONLY way a product's
  // nav lands the not-wired ProductSubpageStub is a DECLARED specific with no backing route.
  // The real catalog avoids that by giving every subpage-declaring product a `:tab` (or
  // slug-specific) route. This pins the rule via `subpageIsWired`: a declared specific WITH a
  // `:tab` route is wired → resolves to `route`, never the stub. A product declaring a
  // specific it does NOT route is the bug this catches (and Tasks›Queues above shows the stub).
  it('a declared specific WITH a :tab route is wired (route, never the coming-soon stub)', () => {
    const wired = mod('wired', {
      subpages: [{ slug: 'analytics', label: 'Analytics' }],
      routes: [
        { path: '', component: C },
        { path: ':tab', component: C },
      ],
    })
    const cat = [wired]
    const mods = cat.map((e) => e as unknown as ProductModule)
    expect(subpageIsWired(mods, 'wired', 'analytics')).toBe(true)
    expect(resolveProductView(cat, mods, ['wired', 'analytics']).kind).toBe('route')
    // The negative: the same product WITHOUT a route for the specific is NOT wired → stubs.
    const unwired = mod('unwired', { subpages: [{ slug: 'analytics', label: 'Analytics' }] })
    const ucat = [unwired]
    const umods = ucat.map((e) => e as unknown as ProductModule)
    expect(subpageIsWired(umods, 'unwired', 'analytics')).toBe(false)
    expect(resolveProductView(ucat, umods, ['unwired', 'analytics']).kind).toBe('stub')
  })
  it('404s an unknown product or an unknown deep path', () => {
    expect(view(['nope']).kind).toBe('notfound')
    expect(view(['vpc', 'nope', 'deep']).kind).toBe('notfound')
  })
})

// ── Slug aliases + external resolution — no nav item 404s ─────────────────────

describe('canonicalSlug — conventional URLs map to the canonical entry id', () => {
  it('rewrites only the head segment, preserving the rest', () => {
    expect(canonicalSlug(['auto'])).toEqual(['automations'])
    expect(canonicalSlug(['automation'])).toEqual(['automations'])
  })
  it('maps the human product slugs the console/e2e/bookmarks use to the canonical id', () => {
    // These six were the biggest "blank" source: a human slug ≠ registry id → 404.
    expect(canonicalSlug(['traces'])).toEqual(['o11y'])
    expect(canonicalSlug(['plans-pricing'])).toEqual(['plans'])
    expect(canonicalSlug(['wallets'])).toEqual(['wallet'])
    expect(canonicalSlug(['model-catalog'])).toEqual(['models'])
    expect(canonicalSlug(['fine-tuning'])).toEqual(['finetuning'])
    expect(canonicalSlug(['web-search'])).toEqual(['websearch'])
    // A trailing segment is preserved through the alias (e.g. /traces/logs).
    expect(canonicalSlug(['traces', 'logs'])).toEqual(['o11y', 'logs'])
  })
  it('is identity for a non-aliased or empty slug', () => {
    expect(canonicalSlug(['models', 'routing'])).toEqual(['models', 'routing'])
    expect(canonicalSlug([])).toEqual([])
  })
  it('the alias table maps only to real canonical ids', () => {
    // Every alias target must be a resolvable entry — never a dangling id.
    for (const target of Object.values(SLUG_ALIASES)) {
      expect(CATALOG.some((e) => e.id === target)).toBe(true)
    }
  })
})

describe('resolveProductView — aliases + external resolve (never a 404 nav item)', () => {
  const view = (slug: string[]) => resolveProductView(CATALOG, MODULES, slug)

  it('a direct URL to an external product resolves to `external`, not 404', () => {
    const v = view(['lux-explorer'])
    expect(v.kind).toBe('external')
    if (v.kind === 'external') expect(v.entry.href).toBe('https://explore.lux.network')
  })
  it('the Automations aliases (/auto, /automation) resolve to the NATIVE module, not a link-out', () => {
    expect(view(['auto']).kind).toBe('route')
    expect(view(['automation']).kind).toBe('route')
    expect(view(['automations']).kind).toBe('route')
    const v = view(['auto'])
    if (v.kind === 'route') expect(v.matched.module.id).toBe('automations')
  })
  it('every human product slug resolves to its real module (never a 404 blank)', () => {
    const cases: [string, string][] = [
      ['traces', 'o11y'],
      ['plans-pricing', 'plans'],
      ['wallets', 'wallet'],
      ['model-catalog', 'models'],
      ['fine-tuning', 'finetuning'],
      ['web-search', 'websearch'],
    ]
    for (const [slug, id] of cases) {
      const v = view([slug])
      expect(v.kind, `/${slug} must resolve`).toBe('route')
      if (v.kind === 'route') expect(v.matched.module.id).toBe(id)
    }
  })
})

describe('subpageIsWired — base sub-pages are always wired (real per-product view)', () => {
  it('wires the index, a :tab specific, and EVERY base slug; not an unrouted non-base specific', () => {
    expect(subpageIsWired(MODULES, 'models', '')).toBe(true)
    expect(subpageIsWired(MODULES, 'models', 'routing')).toBe(true)
    // Base slugs render the shared per-product sub-page → always wired (never dimmed).
    expect(subpageIsWired(MODULES, 'vpc', 'status')).toBe(true)
    expect(subpageIsWired(MODULES, 'vpc', 'metrics')).toBe(true)
    expect(subpageIsWired(MODULES, 'models', 'settings')).toBe(true)
    // A declared non-base specific with no route yet is still honestly not wired.
    expect(subpageIsWired(MODULES, 'tasks', 'queues')).toBe(false)
  })
})

describe('isAdminView — admin product OR admin sub-page (customer gating)', () => {
  it('flags an admin product and an admin sub-page, not customer surfaces', () => {
    expect(isAdminView(CATALOG, ['providers'])).toBe(true)
    expect(isAdminView(CATALOG, ['models'])).toBe(false)
    expect(isAdminView(CATALOG, ['models', 'routing'])).toBe(true)
    expect(isAdminView(CATALOG, ['models', 'status'])).toBe(false)
  })
})

describe('destinationsFor — ⌘K indexes products + specifics, admin-gated (ask 3)', () => {
  it('indexes products then declared specifics; a deep sub-page carries its path', () => {
    const dests = destinationsFor(CATALOG, true)
    expect(dests.some((d) => d.kind === 'product' && d.entry.id === 'models')).toBe(true)
    const q = dests.find((d) => d.kind === 'subpage' && d.entry.id === 'tasks' && d.subpage.slug === 'queues')
    expect(q).toBeTruthy()
    if (q && q.kind === 'subpage') expect(q.path).toBe('/tasks/queues')
  })
  it('gates the admin product AND the admin sub-page for a customer', () => {
    const customer = destinationsFor(CATALOG, false)
    expect(customer.some((d) => d.entry.id === 'providers')).toBe(false)
    expect(customer.some((d) => d.kind === 'subpage' && d.subpage.slug === 'routing')).toBe(false)
    const admin = destinationsFor(CATALOG, true)
    expect(admin.some((d) => d.entry.id === 'providers')).toBe(true)
    expect(admin.some((d) => d.kind === 'subpage' && d.subpage.slug === 'routing')).toBe(true)
  })
})
