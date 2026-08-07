/**
 * The Deploy front door's catalog declaration, pinned against the real source.
 *
 * `registry.tsx` cannot be imported here — it pulls the icon ESM the runner can't
 * load — so the house pattern applies (see lib/products/sentry-scope.test.ts):
 * read the entry's own flags off the SOURCE, and prove the predicates that consume
 * them with fixtures elsewhere (`match-core.test.ts` owns the routing algorithm).
 * A fixture proves the predicate; only the source proves the DATA, and the data is
 * what a later edit breaks.
 *
 * Each fact here has already been a bug shape in this console:
 *  - a `deploy` SLUG_ALIAS makes the front door unreachable, because
 *    `canonicalSlug` rewrites the head before any lookup happens;
 *  - `admin: true` on a customer surface hides it from every customer;
 *  - two entries labelled "Deploy" put identically-named rows in one nav section,
 *    one of them the admin ESTATE map;
 *  - a sub-page with no `:tab` route renders an honest stub, and nothing fails.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SLUG_ALIASES } from '~/lib/products/match-core'

const SRC = readFileSync(join(__dirname, '..', '..', '..', 'lib', 'products', 'registry.tsx'), 'utf8')

/** One catalog entry's source text: from its `id:` to the next entry's. */
function entrySrc(id: string): string {
  const at = SRC.indexOf(`id: '${id}',`)
  expect(at, `catalog entry '${id}' not found in registry.tsx`).toBeGreaterThan(-1)
  const next = SRC.indexOf("\n    id: '", at + 1)
  return SRC.slice(at, next === -1 ? SRC.length : next)
}

describe('the Deploy product', () => {
  const src = entrySrc('deploy')

  it('is a Platform module labelled Deploy', () => {
    expect(src).toMatch(/^\s*label: 'Deploy',\s*$/m)
    expect(src).toMatch(/^\s*category: 'Platform',\s*$/m)
    expect(src).toMatch(/^\s*kind: 'module',\s*$/m)
  })

  it('is NOT admin-gated — a customer ships their own code', () => {
    expect(/^\s*admin:\s*true,\s*$/m.test(src)).toBe(false)
  })

  it('declares the index and the :tab route its sub-pages need', () => {
    expect(src).toMatch(/\{ path: '', component: DeployModule \}/)
    expect(src).toMatch(/\{ path: ':tab', component: DeployModule \}/)
  })

  it('declares exactly the six sub-pages the module dispatches on', () => {
    const slugs = [...src.matchAll(/\{ slug: '([a-z]+)', label:/g)].map((m) => m[1])
    expect(slugs).toEqual(['apps', 'sites', 'domains', 'cd', 'ci', 'storage'])
  })

  it('is the ONE entry labelled Deploy in the whole catalog', () => {
    expect([...SRC.matchAll(/^\s*label: 'Deploy',\s*$/gm)]).toHaveLength(1)
  })
})

describe('/deploy resolves to the front door', () => {
  it('has no alias shadowing the head', () => {
    // `canonicalSlug` rewrites the FIRST segment unconditionally, so an alias
    // named `deploy` would route the front door's own URL somewhere else.
    expect(SLUG_ALIASES.deploy).toBeUndefined()
  })

  it('leaves App Platform addressable under its own id', () => {
    expect(SLUG_ALIASES['app-platform']).toBeUndefined()
    expect(entrySrc('app-platform')).toMatch(/^\s*label: 'App Platform',\s*$/m)
  })
})

describe('the estate fleet map stays admin-only, under its own name', () => {
  const src = entrySrc('gitops')

  it('is labelled Fleet, not Deploy', () => {
    expect(src).toMatch(/^\s*label: 'Fleet',\s*$/m)
  })

  it('is still admin-gated — it shows every org, not just yours', () => {
    expect(/^\s*admin:\s*true,\s*$/m.test(src)).toBe(true)
  })
})
