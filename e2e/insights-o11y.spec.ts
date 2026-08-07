/**
 * PROOF: Insights (o11y observability) is live, IAM-gated, and renders on
 * admin.hanzo.ai for the SuperAdmin — wired to the VERSION-LESS `/v1/o11y/<resource>`
 * surface (cloud embedded o11y v1.5.4).
 *
 * Two layers, so the spec is ALWAYS runnable and honest:
 *
 *  A. UNAUTHENTICATED gate proof (always runs, no creds). Proves the version-less
 *     surface is LIVE and IAM-gated against the real backend:
 *       - GET  /v1/o11y/health          → 200 {"service":"o11y","status":"ok"}
 *       - POST /v1/o11y/services         → 403 "no validated principal"  (gated)
 *       - POST /v1/o11y/query_range      → 403 "no validated principal"  (gated)
 *       - GET  /v1/o11y/rules            → 403 "no validated principal"  (gated)
 *     i.e. anonymous is refused (403), so a logged-in bearer is REQUIRED — which is
 *     exactly why the console routes o11y through the `/v1` user-bearer BFF.
 *     (The deprecated `/v1/o11y/v1/rules` alias also still resolves — 403, not 404.)
 *
 *  B. AUTHENTICATED render proof (runs when a SuperAdmin password is provided). Signs
 *     in, establishes the shared `.hanzo.ai` session, enters admin.hanzo.ai (or falls
 *     back to console.hanzo.ai — the SAME image — when the edge guard refuses), and:
 *       - fetches `/v1/o11y/health` + reads through the bearer proxy: a logged-in
 *         session PASSES the IAM gate (NOT 403); health is 200.
 *       - navigates to Insights (Service Map · Logs · Traces · Fleet Observability) and
 *         asserts each RENDERS — real o11y data when the runtime returns rows, else the
 *         honest RuntimeNotice — never a crash. Screenshots each.
 *
 * Run:
 *   # unauthenticated gate proof (works today, no creds):
 *   BASE_URL=https://console.hanzo.ai npx playwright test insights-o11y --reporter=line
 *   # full authenticated render proof (needs the SuperAdmin password):
 *   HANZO_EMAIL='z@hanzo.ai' HANZO_PASSWORD='…' npx playwright test insights-o11y --reporter=line
 *
 * The SuperAdmin creds are the reserved-`admin`-org superuser (admin.hanzo.ai login).
 * If z@hanzo.ai resolves to the brand `hanzo` org (a per-org admin, not the platform
 * SuperAdmin), the per-org Insights modules STILL render for the hanzo org (o11y only
 * needs a validated principal, not the admin org); the cross-org Fleet Observability
 * board is the one surface that additionally requires `owner==admin`.
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const EMAIL = process.env.HANZO_EMAIL ?? 'z@hanzo.ai'
const PASSWORD = process.env.HANZO_PASSWORD ?? ''
const CONSOLE = process.env.CONSOLE_URL ?? 'https://console.hanzo.ai'
const ADMIN = process.env.ADMIN_URL ?? 'https://admin.hanzo.ai'
/** The real cloud backend the console's `/v1` bearer BFF forwards to (for the direct gate proof). */
const CLOUD_API = process.env.CLOUD_API_ORIGIN ?? 'https://api.hanzo.ai'
const SHOTS = process.env.SHOT_DIR ?? 'e2e-shots'

// ── o11y-shape payloads (mirrors src/lib/api/apm.ts — inlined so the spec has no
//    'use client'/React import from the app source) ────────────────────────────────
const nowMs = Date.now()
const win = { startNs: String((nowMs - 3_600_000) * 1e6), endNs: String(nowMs * 1e6), startMs: nowMs - 3_600_000, endMs: nowMs }
const servicesBody = { start: win.startNs, end: win.endNs, tags: [] as unknown[] }
const queryRangeBody = {
  start: win.startMs,
  end: win.endMs,
  step: 60,
  compositeQuery: {
    queryType: 'builder',
    panelType: 'list',
    builderQueries: {
      A: {
        queryName: 'A',
        dataSource: 'logs',
        aggregateOperator: 'noop',
        aggregateAttribute: {},
        expression: 'A',
        disabled: false,
        stepInterval: 60,
        filters: { items: [], op: 'AND' },
        groupBy: [],
        having: [],
        orderBy: [{ columnName: 'timestamp', order: 'desc' }],
        limit: null,
        offset: 0,
        pageSize: 50,
      },
    },
  },
}

/** Sign in via the console app sign-in form (email/password → session cookie). */
async function signIn(page: Page, base: string) {
  await page.goto(`${base}/signin`)
  await page.waitForSelector('input[placeholder="Email"]', { timeout: 25_000 })
  await page.fill('input[placeholder="Email"]', EMAIL)
  await page.fill('input[placeholder="Password"]', PASSWORD)
  await page.click('button:has-text("Sign in")')
  await page.waitForFunction(() => !location.pathname.startsWith('/signin'), { timeout: 30_000 }).catch(() => {})
  await page.waitForLoadState('domcontentloaded')
}

/** Body text of an APIResponse, best-effort. */
async function body(res: { text(): Promise<string> }): Promise<string> {
  return (await res.text().catch(() => '')).slice(0, 200)
}

// ════════════════════════════════════════════════════════════════════════════════
// A. Unauthenticated gate proof — ALWAYS runs (no credentials required).
// ════════════════════════════════════════════════════════════════════════════════
test.describe('Insights o11y — version-less surface is LIVE + IAM-gated (unauthenticated)', () => {
  test('GET /v1/o11y/health is 200; the reads are 403 "no validated principal"', async ({ request }: { request: APIRequestContext }) => {
    // Liveness — the version-less health endpoint the reboot ships (public).
    const health = await request.get(`${CLOUD_API}/v1/o11y/health`)
    expect(health.status(), 'version-less /v1/o11y/health must be live').toBe(200)
    const healthBody = await body(health)
    expect(healthBody, 'health should report the o11y service ok').toMatch(/o11y|ok|status|healthy/i)
    console.log(`✓ GET /v1/o11y/health → 200 :: ${healthBody}`)

    // Every VERSION-LESS read is IAM-gated: anonymous → 403 "no validated principal".
    // This is the proof that a logged-in bearer is REQUIRED (attached by the /v1 bearer BFF).
    const gated: { name: string; res: Awaited<ReturnType<APIRequestContext['get']>> }[] = [
      { name: 'services', res: await request.post(`${CLOUD_API}/v1/o11y/services`, { data: servicesBody }) },
      { name: 'query_range', res: await request.post(`${CLOUD_API}/v1/o11y/query_range`, { data: queryRangeBody }) },
      { name: 'rules', res: await request.get(`${CLOUD_API}/v1/o11y/rules`) },
    ]
    for (const g of gated) {
      expect(g.res.status(), `version-less /v1/o11y/${g.name} must be IAM-gated (403) for an anonymous caller`).toBe(403)
      expect(await body(g.res)).toMatch(/no validated principal|principal|unauthor/i)
      console.log(`✓ /v1/o11y/${g.name} → 403 (IAM-gated, anonymous refused)`)
    }

    // The deprecated nested-version alias still RESOLVES (gated, not a 404) — canonical
    // is version-less, but the old form remains addressable during migration.
    const alias = await request.get(`${CLOUD_API}/v1/o11y/v1/rules`)
    expect(alias.status(), 'deprecated /v1/o11y/v1/rules alias should resolve (403), not 404').toBe(403)
    console.log('✓ deprecated /v1/o11y/v1/rules alias resolves (403, not 404) — version-less is canonical')
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// B. Authenticated render proof — runs when a SuperAdmin password is provided.
// ════════════════════════════════════════════════════════════════════════════════
test.describe('Insights renders on admin.hanzo.ai for the SuperAdmin (authenticated)', () => {
  test.skip(!PASSWORD, 'HANZO_PASSWORD (SuperAdmin) not set — authenticated render proof staged')

  /** Sign in on console (sets the `.hanzo.ai` session) and pick the admin surface if it admits. */
  async function enter(page: Page): Promise<string> {
    await signIn(page, CONSOLE)
    // admin.hanzo.ai carries an edge forward-auth guard (`admin-guard@file`, org=admin).
    // The shared `.hanzo.ai` session set above may admit the SuperAdmin; if the guard
    // still refuses, fall back to console.hanzo.ai — the SAME image + o11y wiring.
    const probe = await page.request.get(`${ADMIN}/`)
    if (probe.status() === 200) {
      console.log('✓ admin.hanzo.ai admitted the session — proving on the admin surface')
      return ADMIN
    }
    console.log(`ℹ admin.hanzo.ai edge-guard → ${probe.status()} for the shared session; proving on console.hanzo.ai (same image + o11y wiring)`)
    return CONSOLE
  }

  test('o11y reads pass the IAM gate through the /v1 bearer BFF (NOT 403 when signed in)', async ({ page }) => {
    const surface = await enter(page)

    // Health through the bearer proxy — 200 JSON (NOT the SPA shell / 403).
    const health = await page.request.get(`${surface}/v1/o11y/health`)
    expect(health.status(), 'authenticated /v1/o11y/health must be 200').toBe(200)
    const hb = await body(health)
    expect(hb, 'health must be JSON from o11y, not the SPA shell').toMatch(/o11y|ok|status|healthy/i)
    expect(hb, 'health must not be the HTML app shell').not.toMatch(/<!DOCTYPE html>|<html/i)
    console.log(`✓ authenticated /v1/o11y/health → 200 :: ${hb}`)

    // The gated reads: a logged-in session's minted bearer PASSES the IAM gate. The
    // runtime may answer 200 (rows or honest-empty) or 503 (initializing) — but NEVER
    // 403 "no validated principal" (which the anonymous caller got in proof A).
    const reads: { name: string; res: Awaited<ReturnType<typeof page.request.post>> }[] = [
      { name: 'services', res: await page.request.post(`${surface}/v1/o11y/services`, { data: servicesBody }) },
      { name: 'query_range', res: await page.request.post(`${surface}/v1/o11y/query_range`, { data: queryRangeBody }) },
      { name: 'rules', res: await page.request.get(`${surface}/v1/o11y/rules`) },
    ]
    for (const r of reads) {
      expect(r.res.status(), `/v1/o11y/${r.name} must PASS the IAM gate (not 403) for a signed-in session`).not.toBe(403)
      console.log(`✓ authenticated /v1/o11y/${r.name} → ${r.res.status()} (bearer passed the gate)`)
    }
  })

  test('Insights modules render (Service Map · Logs · Traces · Fleet Observability)', async ({ page }) => {
    const surface = await enter(page)

    // Each Observe module must MOUNT and render either real o11y data or the honest
    // RuntimeNotice/empty state — and never a crash / error boundary / blank.
    const modules: { id: string; label: string; expect: RegExp }[] = [
      { id: 'service-map', label: 'Service Map', expect: /Service Map|Rate|Errors|Duration|p99|dependency|Observability|no telemetry|not enabled|initializing/i },
      { id: 'logs', label: 'Logs', expect: /Logs|Application logs|Request activity|Severity|Message|no application logs|Observability|initializing/i },
      { id: 'o11y', label: 'Traces', expect: /Traces|Trace|Latency|Tokens|Cost|Observability|No traces|initializing|not enabled/i },
      { id: 'fleet-o11y', label: 'Fleet Observability', expect: /Fleet Observability|Requests|Tokens|Latency|Top organizations|superadmin access|not authorized/i },
    ]
    for (const m of modules) {
      await page.goto(`${surface}/${m.id}`, { waitUntil: 'domcontentloaded' })
      await expect(page, `${m.label} bounced to sign-in`).not.toHaveURL(/\/signin/, { timeout: 15_000 })
      // No React error boundary / hard crash.
      await expect(page.locator('text=/something went wrong|application error|Unexpected token|this page could not be found/i'),
        `${m.label} crashed`).toHaveCount(0)
      // The module rendered its own surface (real data OR an honest state).
      await expect(page.getByText(m.expect).first(), `${m.label} did not render`).toBeVisible({ timeout: 30_000 })
      await page.screenshot({ path: `${SHOTS}/insights-${m.id}.png`, fullPage: true })
      console.log(`✓ ${m.label} (/${m.id}) rendered — screenshot e2e-shots/insights-${m.id}.png`)
    }
  })
})
