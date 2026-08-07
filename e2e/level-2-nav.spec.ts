/**
 * e2e: ONE level-2 nav.
 *
 * Clicking into a product must reveal ITS options rather than replacing the screen,
 * and there must be exactly ONE such nav on screen — not the sidebar's level 2 AND a
 * competing tab strip in the content, which is what `/models` used to do (eight items
 * in the rail, four in the content, disagreeing on the index's own name).
 *
 * "Rather than replacing the screen" is now literal on both axes: the product's
 * sub-pages expand BENEATH its row and the rest of the catalog stays put. The rail
 * used to swap itself for the product's sub-nav behind a "Back to all products"
 * button, so these specs assert the other products are still there — that is the
 * whole point of the change, and the part a future drill would silently undo.
 *
 * These are assertions only a browser can make. They read COMPUTED style and
 * GEOMETRY, not source: a strip hidden by a `$lg` media style prop is still in the
 * DOM, so `toBeVisible()` — which resolves to `display`/`visibility`/box-size — is
 * the only honest test of "is there a second nav on screen".
 *
 * Run: BASE_URL=http://localhost:4111 npx playwright test level-2-nav
 */
import { test, expect, type Route, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { requireFixtureServer } from './_fixture'
import { primeSession } from './_session'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000'

requireFixtureServer()
const SHOTS = join(process.cwd(), 'e2e-shots')

const ACCOUNT = {
  owner: 'hanzo',
  name: 'z',
  email: 'z@hanzo.ai',
  displayName: 'Z Admin',
  isAdmin: true,
}

const API_RE = /\/(v1|cloud|ai|billing|commerce|telemetry|vm|superbase|admin|paas|integrations|auth\/refresh)(\/|$|\?)/
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Every backend answers 401 — this spec is about NAV, not data, and an unauthorized
 * read is the state every module already handles honestly. (A fabricated empty
 * envelope is NOT interchangeable: a module that expects an object and is handed
 * `[]` throws into its error boundary, which would make this spec a data test.)
 */
async function mock(route: Route) {
  const req = route.request()
  if (req.resourceType() === 'document') return route.continue()
  const url = new URL(req.url())
  if (url.pathname.startsWith('/auth/')) return json(route, { ok: true })
  const sameOrigin = url.origin === new URL(BASE_URL).origin
  if (sameOrigin && !API_RE.test(url.pathname)) return route.continue()
  return json(route, { error: 'Sign in to use Hanzo Cloud.' }, 401)
}

async function open(page: Page, path: string) {
  await page.route('**/*', mock)
  await primeSession(page, ACCOUNT)
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="product-content"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(1200)
}

/** The level-2 nav rendered in the CONTENT column (`SubNav`). Located by test id,
 *  not by role: a `display: none` element leaves the accessibility tree, and this
 *  spec must be able to find it precisely when it is hidden. */
const strip = (page: Page, id: string) => page.locator(`[data-testid="subnav-${id}"]`)

/** A level-2 row/tab by its label, anywhere on screen, VISIBLE only. */
const visibleTab = (page: Page, label: string) =>
  page.getByRole('button', { name: label, exact: true }).filter({ visible: true })

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }))

test('desktop: the sidebar owns level 2 — the content strip is not a second nav', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await open(page, '/models')

  // The rail expanded Models in place — and did NOT swap itself for it.
  await expect(page.getByRole('button', { name: 'Back to all products' })).toHaveCount(0)
  // The rest of the catalog is still there — "All products" sits at the FOOT of the
  // product list, so its presence proves the list was never swapped away. This is the
  // assertion the drill could not have passed.
  await expect(page.getByRole('button', { name: 'All products' }).first()).toBeVisible()

  // The index is named what the PRODUCT calls it — Models' index is the Catalog,
  // not a generic "Overview". This is the registry's `indexLabel`, read by the nav.
  await expect(visibleTab(page, 'Catalog').first()).toBeVisible()
  await expect(visibleTab(page, 'Leaderboard').first()).toBeVisible()
  await expect(visibleTab(page, 'Blend').first()).toBeVisible()

  // Exactly ONE of each — a duplicate would mean two navs painting at once.
  for (const label of ['Catalog', 'Leaderboard', 'Blend']) {
    expect(await visibleTab(page, label).count(), `${label} appears once`).toBe(1)
  }

  // The content strip is in the DOM but PAINTS NOTHING at lg+ (computed display).
  await expect(strip(page, 'models')).toBeAttached()
  await expect(strip(page, 'models')).not.toBeVisible()
  expect(await strip(page, 'models').evaluate((el) => getComputedStyle(el).display)).toBe('none')

  await page.screenshot({ path: join(SHOTS, 'level2-desktop-models.png'), fullPage: false })
  await ctx.close()
})

test('phone: the strip carries level 2 where the sidebar is a drawer', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await open(page, '/models')

  // The rail is off-canvas, so the strip is the ONE nav — and it is the SAME list.
  await expect(strip(page, 'models')).toBeVisible()
  const labels = await strip(page, 'models').getByRole('button').allInnerTexts()
  // Routing is admin-only and this account is an ORG admin, not a global one — the
  // one nav gates it, so a customer is never offered a surface they cannot open.
  //
  // The tail reads raw → summary: Logs, then Metrics, then Status LAST (the
  // live-health verdict comes after the signals it is derived from). f6df104ec8
  // reordered BASE_SUBPAGES and updated match-core.test.ts but not this spec, so it
  // asserted the retired order and failed against every build from 8.5.75 on.
  expect(labels).toEqual(['Catalog', 'Leaderboard', 'Blend', 'Settings', 'Logs', 'Metrics', 'Status'])

  // The strip wraps rather than pushing the page sideways.
  const scrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(scrolls, 'body must not scroll horizontally').toBe(false)

  // Every tab is a real hit target — measured, not assumed.
  const boxes = await strip(page, 'models').getByRole('button').all()
  for (const b of boxes) {
    const box = await b.boundingBox()
    expect(box, 'a tab must have a painted box').not.toBeNull()
    expect(box!.height, 'a tab must be tall enough to tap').toBeGreaterThanOrEqual(28)
    expect(box!.x + box!.width, 'a tab must not paint past the right edge').toBeLessThanOrEqual(391)
  }

  await strip(page, 'models').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(SHOTS, 'level2-mobile-models.png'), fullPage: false })
  await ctx.close()
})

test('the URL carries the level — a deep link and a reload land on the same tab', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await open(page, '/models/blend')

  const current = async () =>
    strip(page, 'models').locator('[aria-current="page"]').first().innerText()

  expect(await current()).toBe('Blend')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="product-content"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(1200)
  expect(await current(), 'reload keeps the level').toBe('Blend')
  expect(new URL(page.url()).pathname).toBe('/models/blend')

  await ctx.close()
})

test('back returns a level without losing pinned state', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await open(page, '/models')

  // Pin state is account-backed, not view state — it must survive a drill + back.
  const pinsBefore = await page.evaluate(() => localStorage.getItem('hanzo.preferences.cache'))

  await visibleTab(page, 'Blend').first().click()
  await page.waitForTimeout(900)
  expect(new URL(page.url()).pathname).toBe('/models/blend')

  await page.goBack({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  expect(new URL(page.url()).pathname).toBe('/models')

  // Models is still expanded with the same options — browser Back moved the ROUTE,
  // and the rail followed it without collapsing what the user was looking at.
  await expect(visibleTab(page, 'Catalog').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to all products' })).toHaveCount(0)

  expect(await page.evaluate(() => localStorage.getItem('hanzo.preferences.cache'))).toBe(pinsBefore)
  await ctx.close()
})

/**
 * Every product that used to carry its own `const TABS` — the whole conversion, in
 * one sweep. For each: the page renders, the rail expands it in place, and the
 * content strip is present but PAINTS NOTHING at lg+. That is the "no second nav"
 * invariant, and it is the thing that regresses the moment someone adds a tab bar
 * back.
 */
const CONVERTED = [
  'models', 'evals', 'ai-accounts', 'containers', 'analytics', 'finetuning', 'team',
  'automations', 'embeddings', 'tasks', 'functions', 'profile', 'router', 'settings',
  'zero-trust', 'billing', 'captable', 'crm',
] as const

test('no product paints a second level-2 nav at lg+', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  for (const id of CONVERTED) {
    await open(page, `/${id}`)
    await expect(strip(page, id), `${id}: declares one level-2 nav`).toBeAttached()
    expect(
      await strip(page, id).evaluate((el) => getComputedStyle(el).display),
      `${id}: the content strip must not paint while the rail owns level 2`,
    ).toBe('none')
    await expect(
      page.getByRole('button', { name: 'Back to all products' }),
      `${id}: the rail expands in place — it must never swap itself for one product`,
    ).toHaveCount(0)
  }

  await ctx.close()
})
