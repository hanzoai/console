/**
 * e2e: Tags — the org's tag manager, rendered.
 *
 * Runs against a LOCAL fixture server with the network mocked, and asserts the two
 * things this surface is FOR, by driving it rather than probing it:
 *
 *  1. Per-SITE browser pixels — the list shows each site's configured platforms and its
 *     publishable key; opening one seeds the four inputs from the stored config; typing
 *     an id and saving sends `PATCH /v1/projects/:slug` with `{tags:{…}}` — the WHOLE
 *     set, which is what makes removal expressible — and never a slug in the body.
 *  2. Per-ORG destinations — the cards are built from the server's OWN declared spec
 *     (`fields` + `secrets`), the credential input is a real password field, connecting
 *     sends the secret under its camelCase name, and the secret is NOWHERE in the DOM
 *     afterwards (it was sealed to KMS server-side and is never returned).
 *
 * Plus the honest states: the preview reports what the door will ACTUALLY serve, the
 * install snippet names api.hanzo.ai (not the console origin), and 390px does not
 * scroll the body sideways.
 *
 * Run: BASE_URL=http://localhost:4000 npx playwright test tags
 */
import { test, expect, type Route } from '@playwright/test'
import { requireFixtureServer } from './_fixture'
import { primeSession } from './_session'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000'
requireFixtureServer()
const SHOTS = join(process.cwd(), 'e2e-shots')

/** Two sites under one org, carrying DIFFERENT pixels — the reason tags are per-site. */
const SITES = [
  {
    id: 'proj_1',
    org: 'hanzo',
    slug: 'landing',
    name: 'Landing',
    status: 'live',
    liveUrl: 'https://landing.hanzo.app',
    key: 'pk-landing123',
    tags: { ga4: 'G-LANDING', meta: '179001' },
    createdAt: 1,
    updatedAt: 2,
  },
  {
    id: 'proj_2',
    org: 'hanzo',
    slug: 'docs-site',
    name: 'Docs',
    status: 'live',
    liveUrl: 'https://docs.hanzo.app',
    key: 'pk-docs456',
    tags: {},
    createdAt: 1,
    updatedAt: 2,
  },
]

/** The resolved door answer for the landing site — cloud's `{tags:[…]}` shape. */
const DOOR = {
  tags: [
    { platform: 'ga4', type: 'ga', id: 'G-LANDING' },
    { platform: 'meta', type: 'meta', id: '179001' },
  ],
}

/** Two destination cards, each DECLARING its own fields + KMS secret names. */
const DESTINATIONS = {
  destinations: [
    {
      platform: 'ga4',
      name: 'Google Analytics 4',
      category: 'Analytics',
      connected: false,
      enabled: false,
      live: false,
      config: {},
      fields: [{ key: 'measurementId', label: 'Measurement ID', required: true, example: 'G-XXXXXXX' }],
      secrets: ['api_secret'],
    },
    {
      platform: 'meta',
      name: 'Meta (Facebook & Instagram)',
      category: 'Advertising',
      connected: true,
      enabled: true,
      live: true,
      account: 'Acme Ads',
      config: { pixelId: '179001' },
      fields: [
        { key: 'pixelId', label: 'Pixel ID', required: true, example: '1234567890' },
        { key: 'testEventCode', label: 'Test event code', required: false, example: 'TEST1234' },
      ],
      secrets: ['access_token'],
    },
  ],
}

const API_RE = /\/(v1|cloud|ai|billing|commerce|telemetry|vm|superbase|admin|paas|integrations|auth\/refresh)(\/|$|\?)/

/** Every write the page makes, so a body can be asserted rather than assumed. */
type Sent = { method: string; path: string; body: string }

function mocker(sent: Sent[]) {
  return async (route: Route) => {
    const req = route.request()
    if (req.resourceType() === 'document') return route.continue()
    const url = new URL(req.url())
    const p = url.pathname
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (req.method() !== 'GET') sent.push({ method: req.method(), path: p, body: req.postData() ?? '' })

    // The public tag door — the RESOLVED set, keyed by the site's pk-.
    if (p === '/v1/tags') {
      return json(url.searchParams.get('key') === 'pk-landing123' ? DOOR : { tags: [] })
    }
    // The org's destinations, and one platform's connect.
    if (p === '/v1/destinations') return json(DESTINATIONS)
    if (/^\/v1\/destinations\/[^/]+$/.test(p)) {
      if (req.method() === 'DELETE') return route.fulfill({ status: 204, body: '' })
      // A connect answers the same status card the reads do — and carries NO secret.
      return json({
        platform: 'ga4',
        name: 'Google Analytics 4',
        category: 'Analytics',
        connected: true,
        enabled: true,
        live: true,
        config: { measurementId: 'G-NEWPROP' },
        fields: DESTINATIONS.destinations[0].fields,
        secrets: ['api_secret'],
      })
    }
    // One site: seeded on GET, and the PATCH echoes the tag set it was sent.
    const one = p.match(/^\/v1\/projects\/([^/]+)$/)
    if (one) {
      const site = SITES.find((s) => s.slug === one[1]) ?? SITES[0]
      if (req.method() === 'PATCH') {
        const tags = (JSON.parse(req.postData() || '{}') as { tags?: Record<string, string> }).tags ?? {}
        return json({ ...site, tags })
      }
      return json(site)
    }
    if (p === '/v1/projects') return json(SITES)

    const sameOrigin = url.origin === new URL(BASE_URL).origin
    if (sameOrigin && !API_RE.test(p)) return route.continue()
    return json({ status: 'ok', msg: '', data: [], data2: 0 })
  }
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }))

test('per-site pixels: list → edit → save sends the WHOLE tag set to that site', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  const sent: Sent[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', mocker(sent))
  await primeSession(page)

  await page.goto(`${BASE_URL}/tags`, { waitUntil: 'domcontentloaded' })

  // The list is real: both sites, the configured platforms, and the publishable key.
  await expect(page.getByText('Landing', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('docs-site', { exact: true })).toBeVisible()
  await expect(page.getByText('ga4', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('pk-landing123', { exact: true })).toBeVisible()
  // The un-tagged site says so honestly rather than showing an empty chip row.
  await expect(page.getByText('None', { exact: true })).toBeVisible()

  // Open the site → its editor seeds from the STORED config.
  await page.getByText('Landing', { exact: true }).first().click()
  const ga4 = page.getByPlaceholder('G-XXXXXXXXXX')
  await expect(ga4).toHaveValue('G-LANDING', { timeout: 20_000 })

  // The preview reports what the DOOR will serve — not the form's own contents.
  await expect(page.getByText('Will inject')).toBeVisible()
  await expect(page.getByText('G-LANDING').last()).toBeVisible()

  // The install snippet names the PUBLIC api host and this site's key.
  const snippet = page.getByText(/api\.hanzo\.ai\/v1\/event\.js/)
  await expect(snippet).toBeVisible()
  await expect(snippet).toContainText('pk-landing123')
  await expect(snippet).not.toContainText('/api/v1/')

  await page.screenshot({ path: join(SHOTS, 'tags-site.png'), fullPage: true })

  // Add a TikTok id and drop Meta by clearing it — then save.
  await page.getByPlaceholder('CXXXXXXXXXXXXXXXXXXX').fill('C4TIKTOK')
  await page.getByPlaceholder('1234567890123456').fill('')
  await page.getByRole('button', { name: /save pixels/i }).click()

  // Scope to the write under test — the console also PATCHes /v1/prefs on its own.
  const patches = () => sent.filter((s) => s.method === 'PATCH' && s.path.startsWith('/v1/projects/'))
  await expect.poll(() => patches().length, { timeout: 20_000 }).toBeGreaterThan(0)
  const patch = patches()[0]
  expect(patch.path).toBe('/v1/projects/landing')
  const body = JSON.parse(patch.body) as { tags: Record<string, string>; slug?: string }
  // The WHOLE set is sent: the kept id, the new one, and Meta ABSENT — which is how a
  // pixel is removed at all, since a present object replaces the set.
  expect(body.tags).toEqual({ ga4: 'G-LANDING', tiktok: 'C4TIKTOK' })
  expect(body).not.toHaveProperty('slug')

  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([])
  await ctx.close()
})

test('org destinations: the form is the SERVER spec, and the credential never renders', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  const sent: Sent[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', mocker(sent))
  await primeSession(page)

  await page.goto(`${BASE_URL}/tags/destinations`, { waitUntil: 'domcontentloaded' })

  // Both platforms render, with the connected one's stored non-secret id and the
  // KMS secret NAME (never a value).
  await expect(page.getByText('Google Analytics 4')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Meta (Facebook & Instagram)')).toBeVisible()
  await expect(page.getByText('179001')).toBeVisible()
  await expect(page.getByText(/Access token held in KMS/i)).toBeVisible()
  // The page says which scope it writes — the whole reason it is a separate route.
  await expect(page.getByText(/whole organization/i)).toBeVisible()

  await page.screenshot({ path: join(SHOTS, 'tags-destinations.png'), fullPage: true })

  // Connect GA4 — the fields come from ITS declared spec, not a hardcoded shape.
  await page
    .getByRole('button', { name: /^Connect$/ })
    .first()
    .click()
  const measurement = page.getByPlaceholder('G-XXXXXXX')
  await expect(measurement).toBeVisible({ timeout: 20_000 })

  // The credential input is a REAL password field — the value is never on screen.
  const secret = page.locator('input[type="password"]').first()
  await expect(secret).toBeVisible()

  await measurement.fill('G-NEWPROP')
  await secret.fill('super-secret-value')
  await page.getByRole('button', { name: /^Connect$/ }).last().click()

  const posts = () => sent.filter((s) => s.method === 'POST' && s.path.startsWith('/v1/destinations/'))
  await expect.poll(() => posts().length, { timeout: 20_000 }).toBeGreaterThan(0)
  const post = posts()[0]
  expect(post.path).toBe('/v1/destinations/ga4')
  const body = JSON.parse(post.body) as Record<string, unknown>
  // The secret rides under the camelCase of its KMS name; the id under the field key.
  expect(body).toMatchObject({ measurementId: 'G-NEWPROP', apiSecret: 'super-secret-value' })

  // After the round trip the credential is nowhere in the document — it was sealed
  // server-side and no read returns it.
  await expect(page.getByText('super-secret-value')).toHaveCount(0)
  expect(await page.content()).not.toContain('super-secret-value')

  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([])
  await ctx.close()
})

test('390px: both surfaces stack and the body never scrolls sideways', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const sent: Sent[] = []
  await page.route('**/*', mocker(sent))
  await primeSession(page)

  for (const path of ['/tags', '/tags/destinations']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(path === '/tags' ? 'Landing' : 'Google Analytics 4').first()).toBeVisible({
      timeout: 30_000,
    })
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth, `${path} scrolls sideways at 390px`).toBe(clientWidth)
  }

  await page.screenshot({ path: join(SHOTS, 'tags-mobile.png'), fullPage: true })
  await ctx.close()
})
