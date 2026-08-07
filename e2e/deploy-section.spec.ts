/**
 * e2e: the Deploy section — mocked-network render + RESPONSIVE proof.
 *
 * Runs against a LOCAL server (BASE_URL=http://localhost:4000) with the whole
 * network mocked, so the shapes asserted here are the shapes cloud actually
 * serves (bare arrays for projects/apps/sites, `{applications}` for the CD
 * projection, `{builds}` for CI, `{buckets}` for storage) and nothing depends on
 * live estate data.
 *
 * It proves: the section renders in the console's own chrome (left nav, org
 * switcher, dark cards), the unified board folds APPS and SITES into one list,
 * each of the six sub-pages renders its own panel, the deploy FORM opens and
 * validates without posting, and at 390px the body never scrolls horizontally.
 * Screenshots at desktop (1440) and mobile (390).
 *
 * Run: BASE_URL=http://localhost:4000 npx playwright test deploy-section
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { requireFixtureServer } from './_fixture'
import { primeSession } from './_session'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000'
const SHOTS = join(process.cwd(), 'e2e-shots')

requireFixtureServer()

/** `GET /v1/platform/projects` — a bare array, as `apps/platform` serves it. */
const PROJECTS = [{ id: 'p1', org: 'hanzo', slug: 'web', name: 'Web', applications: 2, createdAt: 1_700_000_000_000 }]

/** `GET /v1/platform/projects/web/apps` — bare `appList`. */
const APPS = [
  {
    id: 'a1',
    org: 'hanzo',
    projectId: 'p1',
    slug: 'api',
    name: 'api',
    source: 'git',
    repo: { url: 'https://git.hanzo.ai/hanzoai/api.git', branch: 'main' },
    domains: ['api.hanzo.app', 'api.example.com'],
    status: 'live',
    phase: 'Running',
    health: 'green',
    replicas: 2,
    port: 8080,
    env: [],
    updatedAt: 1_754_400_000_000,
  },
  {
    id: 'a2',
    org: 'hanzo',
    projectId: 'p1',
    slug: 'worker',
    name: 'worker',
    source: 'git',
    repo: { url: 'https://git.hanzo.ai/hanzoai/worker.git' },
    domains: [],
    status: 'building',
    replicas: 1,
    env: [],
    updatedAt: 1_754_300_000_000,
  },
]

/** `GET /v1/platform/sites` — bare `projectsProjects`. */
const SITES = [
  {
    id: 's1',
    org: 'hanzo',
    slug: 'docs',
    name: 'docs',
    repo: { url: 'https://git.hanzo.ai/hanzoai/docs.git' },
    framework: 'next',
    status: 'live',
    liveUrl: 'https://docs.hanzo.app',
    createdAt: 1_754_000_000_000,
    updatedAt: 1_754_350_000_000,
  },
]

/** `GET /v1/deploy/applications` — the reconciliation projection. */
const CD = {
  applications: [
    {
      name: 'api',
      namespace: 'tenant-hanzo',
      image: { repository: 'ghcr.io/hanzoai/api', tag: 'v1.4.2' },
      phase: 'Running',
      health: 'Healthy',
      sync: 'Synced',
      replicas: 2,
      readyReplicas: 2,
      liveTag: 'v1.4.2',
    },
    {
      name: 'worker',
      namespace: 'tenant-hanzo',
      image: { repository: 'ghcr.io/hanzoai/worker', tag: 'v0.9.1' },
      phase: 'Progressing',
      health: 'Progressing',
      sync: 'OutOfSync',
      replicas: 1,
      readyReplicas: 0,
      liveTag: 'v0.9.0',
    },
  ],
}

/** `GET /v1/builds`. */
const BUILDS = {
  builds: [
    { id: 'b1', repo: 'hanzoai/api', commit: '9f2c1ab77d10', tag: 'v1.4.2', status: 'succeeded', startedAt: '2026-08-05T18:04:00Z', duration: '2m14s' },
    { id: 'b2', repo: 'hanzoai/worker', commit: '3ac9de00b412', tag: 'v0.9.1', status: 'building', startedAt: '2026-08-05T18:22:00Z', duration: '' },
  ],
}

/** `GET /v1/s3/buckets` — Unix SECONDS on `createdAt`, as the S3 app serves it. */
const BUCKETS = { buckets: [{ name: 'docs-site', createdAt: 1_754_000_000 }, { name: 'media', createdAt: 1_750_000_000 }] }

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Mock every read the section makes, then answer everything else with an empty
 * object so an unmocked call renders an honest empty state instead of hanging.
 * Registered BEFORE `primeSession`, whose IAM handlers must win (Playwright
 * matches routes in reverse registration order).
 */
async function mockNetwork(page: Page): Promise<void> {
  await page.route('**/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/v1/platform/projects')) return json(route, PROJECTS)
    if (path.includes('/v1/platform/projects/') && path.endsWith('/apps')) return json(route, APPS)
    if (path.endsWith('/v1/platform/sites')) return json(route, SITES)
    if (path.endsWith('/v1/deploy/applications')) return json(route, CD)
    if (path.endsWith('/v1/builds')) return json(route, BUILDS)
    if (path.endsWith('/v1/s3/buckets')) return json(route, BUCKETS)
    return json(route, {})
  })
  await primeSession(page)
}

/**
 * Open a Deploy tab and wait for THAT tab's panel to paint.
 *
 * Keyed on the panel's own test id rather than a heading role: the console
 * renders through Tamagui/react-native-web, where a `<Text>` title carries no
 * implicit heading role, so `getByRole('heading')` matches nothing here.
 */
async function openDeploy(page: Page, tab = ''): Promise<void> {
  await page.goto(`${BASE_URL}/deploy${tab ? `/${tab}` : ''}`, { waitUntil: 'domcontentloaded' })
  const id = tab === '' ? 'deploy-board' : `deploy-panel-${tab}`
  await expect(page.getByTestId(id)).toBeVisible({ timeout: 45_000 })
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }))

test('the board folds apps and sites into one list, in the console chrome', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openDeploy(page)

  // Both backends, one board — the whole point of the section.
  const board = page.getByTestId('deploy-board')
  await expect(board.getByText('api', { exact: true })).toBeVisible()
  await expect(board.getByText('docs', { exact: true })).toBeVisible()
  await expect(board.getByText('api.hanzo.app', { exact: true })).toBeVisible()

  // The counts are derived from the rows, never fabricated: 2 apps + 1 site,
  // two of which the backend itself calls live.
  await expect(board.getByText('Deployments', { exact: true })).toBeVisible()
  await expect(board.getByText('3', { exact: true })).toBeVisible()
  await expect(board.getByText('Sites', { exact: true })).toBeVisible()

  // It is IN the console, not a bolt-on page: the shell's breadcrumb trail sits
  // above it, and its level-2 nav is DECLARED. That strip hides itself at lg+ —
  // the sidebar rail owns level 2 there — so it is asserted present, not visible.
  await expect(page.getByTestId('subnav-deploy')).toHaveCount(1)
  await expect(page.getByText('Home', { exact: true }).first()).toBeVisible()

  await page.screenshot({ path: join(SHOTS, 'deploy-board-desktop.png'), fullPage: false })
})

test('CD, CI and Storage each read their own canonical head', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1000 })

  // CD — the reconciliation projection, showing declared → running drift.
  await openDeploy(page, 'cd')
  const cd = page.getByTestId('deploy-panel-cd')
  await expect(cd.getByText('Synced', { exact: true })).toBeVisible()
  await expect(cd.getByText('OutOfSync', { exact: true })).toBeVisible()
  await expect(cd.getByText('v0.9.1 → v0.9.0', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(SHOTS, 'deploy-cd.png') })

  // CI — the native build records.
  await openDeploy(page, 'ci')
  const ci = page.getByTestId('deploy-panel-ci')
  await expect(ci.getByText('hanzoai/api', { exact: true })).toBeVisible()
  await expect(ci.getByText('9f2c1ab77d10', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(SHOTS, 'deploy-ci.png') })

  // Storage — org buckets.
  await openDeploy(page, 'storage')
  await expect(page.getByTestId('deploy-panel-storage').getByText('docs-site', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(SHOTS, 'deploy-storage.png') })
})

test('Domains lists EVERY bound host, including the custom one', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await openDeploy(page, 'domains')
  const domains = page.getByTestId('deploy-panel-domains')
  // `api` carries two hosts; a view folded to the primary would hide the second —
  // which is precisely the domain someone bound on purpose.
  await expect(domains.getByText('api.hanzo.app', { exact: true })).toBeVisible()
  await expect(domains.getByText('api.example.com', { exact: true })).toBeVisible()
  await expect(domains.getByText('docs.hanzo.app', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(SHOTS, 'deploy-domains.png') })
})

test('Apps and Sites narrow the SAME board', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await openDeploy(page, 'apps')
  const apps = page.getByTestId('deploy-panel-apps')
  await expect(apps.getByText('worker', { exact: true })).toBeVisible()
  await expect(apps.getByText('docs', { exact: true })).toHaveCount(0)

  await openDeploy(page, 'sites')
  const sites = page.getByTestId('deploy-panel-sites')
  await expect(sites.getByText('docs', { exact: true })).toBeVisible()
  await expect(sites.getByText('worker', { exact: true })).toHaveCount(0)
})

test('the deploy form opens, derives a name, and refuses a bad host without posting', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1200 })

  // A refused form must not create anything. Scoped to the DEPLOY writes —
  // the console shell PATCHes its own UI preferences on navigation, which is
  // unrelated traffic and would make a blanket "no writes" assertion a lie.
  const writes: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (r.method() !== 'GET' && (u.includes('/v1/platform/') || u.includes('/v1/projects'))) {
      writes.push(`${r.method()} ${u}`)
    }
  })

  await openDeploy(page)
  await page.getByRole('button', { name: 'New deployment' }).click()
  const form = page.getByTestId('new-deploy')
  await expect(form).toBeVisible()

  // The name follows the repo until someone edits it by hand.
  await form.getByPlaceholder('https://git.hanzo.ai/hanzoai/console.git').fill('https://git.hanzo.ai/hanzoai/console.git')
  // `exact` matters: the repo field's own placeholder CONTAINS "console".
  await expect(form.getByPlaceholder('console', { exact: true })).toHaveValue('console')

  // A URL in the host field is refused in the form, before any request.
  await form.getByPlaceholder('app.example.com').fill('https://bad.example.com')
  // The form REFUSES rather than posting: Deploy is disabled and says why. Scoped
  // to the form because "Deploy" is also the nav item and the breadcrumb leaf.
  await expect(form.getByRole('alert')).toContainText('https://')
  await expect(form.getByRole('button', { name: 'Deploy', exact: true })).toBeDisabled()

  // Correcting the host clears the refusal and arms the button.
  await form.getByPlaceholder('app.example.com').fill('app.example.com')
  await expect(form.getByRole('alert')).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Deploy', exact: true })).toBeEnabled()

  await page.screenshot({ path: join(SHOTS, 'deploy-form.png') })
  expect(writes, 'a rejected form must not create an app or a site').toEqual([])
})

test('every env var is SEALED by default, and only a named one opens', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 1440, height: 1400 })
  await openDeploy(page)
  await page.getByRole('button', { name: 'New deployment' }).click()
  const form = page.getByTestId('new-deploy')

  // Credential names a key-NAME regex would have missed, plus plain config.
  await form.getByRole('textbox').last().fill('STRIPE_SK=sk_live_x\nGH_PAT=ghp_x\nDB_PASS=hunter2\nPORT=8080')
  const vars = form.getByTestId('env-vars')
  await expect(vars).toBeVisible()

  // Default is sealed for ALL FOUR — including the three the old regex let through.
  for (const key of ['STRIPE_SK', 'GH_PAT', 'DB_PASS', 'PORT']) {
    await expect(vars.getByRole('button', { name: `${key} Sealed` })).toHaveAttribute('aria-pressed', 'true')
  }

  // Opening PORT opens ONLY PORT.
  await vars.getByRole('button', { name: 'PORT Public' }).click()
  await expect(vars.getByRole('button', { name: 'PORT Public' })).toHaveAttribute('aria-pressed', 'true')
  await expect(vars.getByRole('button', { name: 'STRIPE_SK Sealed' })).toHaveAttribute('aria-pressed', 'true')

  await page.screenshot({ path: join(SHOTS, 'deploy-env-secrets.png') })

  // A Public mark must not outlive its line: delete PORT, retype it, and it comes
  // back SEALED like any new variable rather than inheriting the old mark.
  const env = form.getByRole('textbox').last()
  await env.fill('STRIPE_SK=sk_live_x')
  await expect(vars.getByRole('button', { name: 'PORT Sealed' })).toHaveCount(0)
  await env.fill('STRIPE_SK=sk_live_x\nPORT=9090')
  await expect(vars.getByRole('button', { name: 'PORT Sealed' })).toHaveAttribute('aria-pressed', 'true')
})

test('a half-loaded board names the gap and shows no count it cannot know', async ({ page }) => {
  // Sites answer; the APPS fan-out fails. The board must not render "Apps 0".
  await page.route('**/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/v1/platform/projects')) return json(route, PROJECTS)
    if (path.includes('/v1/platform/projects/') && path.endsWith('/apps')) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
    }
    if (path.endsWith('/v1/platform/sites')) return json(route, SITES)
    return json(route, {})
  })
  await primeSession(page)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await openDeploy(page)
  const board = page.getByTestId('deploy-board')
  await expect(board.getByRole('status')).toContainText('Apps could not be fully loaded')
  // The site that DID load still renders — a partial read is not an outage.
  await expect(board.getByText('docs', { exact: true })).toBeVisible()
  // Sites is knowable (1); Apps and the totals are not.
  await expect(board.getByText('1', { exact: true })).toBeVisible()
  await expect(board.getByText('—', { exact: true }).first()).toBeVisible()

  // The Domains list inherits the same gap, and says so.
  await openDeploy(page, 'domains')
  await expect(page.getByTestId('deploy-panel-domains').getByRole('status')).toContainText('Apps could not be fully loaded')
  await page.screenshot({ path: join(SHOTS, 'deploy-partial.png') })
})

test('at 390px the body never scrolls horizontally', async ({ page }) => {
  await mockNetwork(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openDeploy(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page must not scroll sideways on a phone').toBeLessThanOrEqual(1)

  await page.screenshot({ path: join(SHOTS, 'deploy-board-mobile.png'), fullPage: false })
})
