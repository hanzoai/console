/**
 * e2e: the agent quickstart.
 *
 * The surface in the screenshot: a step ladder, "What do you want to build?" with a
 * composer, and a searchable template gallery beside it. These are assertions only a
 * browser can make — that the two columns actually paint side by side at desktop,
 * stack on a phone without the body scrolling sideways, and that picking a template
 * carries its preset into the builder.
 *
 * Run: BASE_URL=http://localhost:4000 npx playwright test agent-quickstart
 */
import { test, expect, type Route, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { requireFixtureServer } from './_fixture'
import { primeSession } from './_session'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000'

requireFixtureServer()
const SHOTS = join(process.cwd(), 'e2e-shots')

const ACCOUNT = { owner: 'hanzo', name: 'z', email: 'z@hanzo.ai', displayName: 'Z Admin', isAdmin: true }

const API_RE = /\/(v1|cloud|ai|billing|commerce|telemetry|vm|superbase|admin|paas|integrations|auth\/refresh)(\/|$|\?)/
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Every backend 401s — this spec is about the SURFACE, not data. */
async function mock(route: Route) {
  const req = route.request()
  if (req.resourceType() === 'document') return route.continue()
  const url = new URL(req.url())
  if (url.pathname.startsWith('/auth/')) return json(route, { ok: true })
  const sameOrigin = url.origin === new URL(BASE_URL).origin
  if (sameOrigin && !API_RE.test(url.pathname)) return route.continue()
  return json(route, { error: 'Sign in to use Hanzo Cloud.' }, 401)
}

async function open(page: Page) {
  await page.route('**/*', mock)
  await primeSession(page, ACCOUNT)
  await page.goto(`${BASE_URL}/agents/quickstart`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="product-content"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(1500)
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }))

test('desktop: the ladder, the composer and the gallery', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await open(page)

  await expect(page.getByText('What do you want to build?')).toBeVisible()
  await expect(page.getByLabel('Describe your agent')).toBeVisible()
  await expect(page.getByText('Browse templates')).toBeVisible()

  // Step 1 is current; later steps are present but not yet reachable.
  await expect(page.getByRole('button', { name: /Step 1: Describe/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Step 3: Run/ })).toBeDisabled()

  // The two columns sit SIDE BY SIDE — geometry, not source.
  const composer = await page.getByLabel('Describe your agent').boundingBox()
  const gallery = await page.getByText('Browse templates').boundingBox()
  expect(composer && gallery).toBeTruthy()
  expect(gallery!.x, 'the gallery is to the right of the composer').toBeGreaterThan(composer!.x + composer!.width - 1)

  await page.screenshot({ path: join(SHOTS, 'agent-quickstart-desktop.png'), fullPage: false })
  await ctx.close()
})

test('the gallery searches, and picking a template carries its preset into the builder', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await open(page)

  await expect(page.getByRole('button', { name: 'Start from Deep researcher' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start from Code reviewer' })).toBeVisible()

  await page.getByLabel('Search templates').fill('extract')
  await page.waitForTimeout(400)
  await expect(page.getByRole('button', { name: 'Start from Structured extractor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start from Deep researcher' })).toHaveCount(0)

  await page.getByLabel('Search templates').fill('')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Start from Deep researcher' }).click()
  await page.waitForTimeout(700)

  // Step 2: the ONE builder, carrying the template's preset — the handle and the
  // prompt the template declares, not an empty form.
  await expect(page.getByRole('button', { name: /Step 2: Configure/ })).toBeVisible()
  await expect(page.locator('input[value="researcher"]').first()).toBeVisible()
  await expect(page.getByText(/You research questions/).first()).toBeVisible()

  await page.screenshot({ path: join(SHOTS, 'agent-quickstart-configure.png'), fullPage: false })
  await ctx.close()
})

test('phone: it stacks and the body never scrolls sideways', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await open(page)

  await expect(page.getByText('What do you want to build?')).toBeVisible()
  await expect(page.getByLabel('Describe your agent')).toBeVisible()

  const scrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(scrolls, 'body must not scroll horizontally').toBe(false)

  await page.screenshot({ path: join(SHOTS, 'agent-quickstart-phone.png'), fullPage: true })
  await ctx.close()
})

test('a template card is reachable and operable by keyboard, and it rings', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await open(page)

  const card = page.getByRole('button', { name: 'Start from Deep researcher' })
  await card.focus()
  await expect(card).toBeFocused()

  // The focus law lives in globals.css and keys off [tabindex] among others — a card
  // that takes focus and shows nothing is worse than one that cannot be reached.
  const ring = await card.evaluate((el) => {
    const s = getComputedStyle(el)
    return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor }
  })
  expect(ring.style, 'the focused card draws an outline').not.toBe('none')
  expect(parseFloat(ring.width), 'the outline has real width').toBeGreaterThan(0)

  // Enter picks it — the same thing a click does.
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  await expect(page.getByRole('button', { name: /Step 2: Configure/ })).toBeVisible()
  await expect(page.locator('input[value="researcher"]').first()).toBeVisible()

  await ctx.close()
})

test('the board\'s New Agent button is the SAME door as the quickstart', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.route('**/*', mock)
  await primeSession(page, ACCOUNT)
  await page.goto(`${BASE_URL}/agents`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="product-content"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(1200)

  // Whichever New-Agent affordance the board is showing (header button or empty
  // state), it must LAND on the quickstart — not open a second, differently-shaped
  // create form in a side pane.
  const cta = page.getByRole('button', { name: /New Agent/i }).filter({ visible: true }).first()
  await cta.click()
  await page.waitForTimeout(900)

  expect(new URL(page.url()).pathname).toBe('/agents/quickstart')
  await expect(page.getByText('What do you want to build?')).toBeVisible()

  await ctx.close()
})
