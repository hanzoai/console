/**
 * LIVE probe of the o11y (O11y) backend through the console's own /v1 bearer BFF.
 * Logs in as z@hanzo.ai and, from the AUTHENTICATED page context, fetches each
 * candidate endpoint exactly as the Observe modules now do — same-origin
 * `<origin>/v1/o11y/<resource>` (the VERSION-LESS canonical surface; the `/v1`
 * catch-all mints the caller's IAM bearer). Prints the HTTP status + a body
 * snippet per endpoint so we know what returns real data vs 404/403 before we build.
 *
 * Not a pass/fail test — a discovery harness. Run:
 *   BASE_URL=https://console.hanzo.ai HANZO_PASSWORD='…' npx playwright test probe-o11y --reporter=line
 */
import { test, type Page } from '@playwright/test'

const EMAIL = process.env.HANZO_EMAIL ?? 'z@hanzo.ai'
const PASSWORD = process.env.HANZO_PASSWORD ?? ''
const BASE_URL = process.env.BASE_URL ?? 'https://console.hanzo.ai'

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`)
  await page.waitForSelector('input[placeholder="Email"]', { timeout: 20_000 })
  await page.fill('input[placeholder="Email"]', EMAIL)
  await page.fill('input[placeholder="Password"]', PASSWORD)
  await page.click('button:has-text("Sign in")')
  const base = new URL(BASE_URL).origin
  // Resilient: the post-login target may be '/' (dashboard) OR '/onboard' (org gate)
  // OR it may just set the session cookie while staying put briefly. Wait for the
  // sign-in form to DISAPPEAR (we left the /signin gate), whatever the destination.
  await page
    .waitForFunction(() => !document.querySelector('input[placeholder="Password"]'), { timeout: 90_000 })
    .catch(() => {})
  // Give the session cookie + any redirect a moment to settle, then land on '/'.
  await page.goto(base, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(2500)
}

/** now() epoch — O11y wants ns for services/errors, ms for infra. */
const nowMs = Date.now()
const endNs = String(nowMs * 1_000_000)
const startNs = String((nowMs - 60 * 60 * 1000) * 1_000_000) // 1h window
const endMs = nowMs
const startMs = nowMs - 60 * 60 * 1000

type Probe = { name: string; path: string; method: 'GET' | 'POST'; body?: unknown }

const PROBES: Probe[] = [
  // ── Health (sanity: proves the runtime is reachable) ──
  { name: 'health', path: 'o11y/health', method: 'GET' },
  { name: 'version', path: 'o11y/version', method: 'GET' },
  // ── Dashboards ──
  { name: 'dashboards.list', path: 'o11y/dashboards', method: 'GET' },
  // ── Service map / APM ──
  { name: 'services.list', path: 'o11y/services/list', method: 'GET' },
  { name: 'services', path: 'o11y/services', method: 'POST', body: { start: startNs, end: endNs, tags: [] } },
  { name: 'dependency_graph', path: 'o11y/dependency_graph', method: 'POST', body: { start: startNs, end: endNs, tags: [] } },
  { name: 'service.top_operations', path: 'o11y/service/top_operations', method: 'POST', body: { start: startNs, end: endNs, service: '' } },
  // ── Logs / traces (the one true read — composite query_range) ──
  {
    name: 'query_range',
    path: 'o11y/query_range',
    method: 'POST',
    body: {
      schemaVersion: 'v1',
      start: startMs,
      end: endMs,
      requestType: 'raw',
      compositeQuery: { queries: [{ type: 'builder_query', spec: { name: 'A', signal: 'logs', limit: 50, offset: 0 } }] },
    },
  },
  // ── Infra ──
  { name: 'hosts.list', path: 'o11y/hosts/list', method: 'POST', body: { start: startMs, end: endMs, filters: { op: 'AND', items: [] } } },
  { name: 'pods.list', path: 'o11y/pods/list', method: 'POST', body: { start: startMs, end: endMs, filters: { op: 'AND', items: [] } } },
  { name: 'nodes.list', path: 'o11y/nodes/list', method: 'POST', body: { start: startMs, end: endMs, filters: { op: 'AND', items: [] } } },
  { name: 'namespaces.list', path: 'o11y/namespaces/list', method: 'POST', body: { start: startMs, end: endMs, filters: { op: 'AND', items: [] } } },
  { name: 'clusters.list', path: 'o11y/clusters/list', method: 'POST', body: { start: startMs, end: endMs, filters: { op: 'AND', items: [] } } },
  // ── Exceptions ──
  { name: 'listErrors', path: 'o11y/listErrors', method: 'POST', body: { start: startNs, end: endNs, limit: 50, order: 'descending', orderParam: 'exceptionCount' } },
  { name: 'countErrors', path: 'o11y/countErrors', method: 'POST', body: { start: startNs, end: endNs } },
  // ── Alerts ──
  { name: 'rules', path: 'o11y/rules', method: 'GET' },
]

test('probe o11y endpoints (live, authenticated)', async ({ page }) => {
  test.setTimeout(180_000)
  // Credentialed discovery harness — skip cleanly without a password (never a hard
  // fail); set HANZO_PASSWORD to run the live authenticated probe.
  test.skip(!PASSWORD, 'HANZO_PASSWORD required for the live o11y probe')
  await signIn(page)

  const results = await page.evaluate(
    async ({ probes }: { probes: Probe[] }) => {
      const out: { name: string; status: number; ok: boolean; snippet: string }[] = []
      for (const p of probes) {
        try {
          const res = await fetch(`${window.location.origin}/v1/${p.path}`, {
            method: p.method,
            credentials: 'include',
            headers: p.body !== undefined ? { 'Content-Type': 'application/json' } : {},
            body: p.body !== undefined ? JSON.stringify(p.body) : undefined,
          })
          const text = await res.text()
          out.push({ name: p.name, status: res.status, ok: res.ok, snippet: text.slice(0, 240) })
        } catch (e) {
          out.push({ name: p.name, status: -1, ok: false, snippet: String(e).slice(0, 240) })
        }
      }
      return out
    },
    { probes: PROBES },
  )

  console.log('\n================ O11Y LIVE PROBE ================')
  for (const r of results) {
    console.log(`\n[${r.status}] ${r.name}`)
    console.log(`   ${r.snippet.replace(/\n/g, ' ')}`)
  }
  console.log('\n================ END PROBE ================\n')
})
