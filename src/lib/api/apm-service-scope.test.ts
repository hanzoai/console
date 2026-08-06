/**
 * End-to-end proof of the per-product o11y wiring: the REAL `ApmApi.logs` /
 * `ApmApi.serviceHealth` calls, with the transport (`./client`) mocked, so the test
 * asserts BOTH that the per-product query is BUILT with the service filter AND that a
 * realistic O11y response is MAPPED to real, service-scoped view-models. This is the
 * "the query builds + maps real responses" gate for the per-product Status/Logs/Metrics.
 *
 * The request bodies and responses here are the o11y v5 dialect — `compositeQuery.queries`
 * out, `data.data.results[].rows` back. The v3 shapes this file used to carry were not
 * merely stale: the server 400s them, so the suite was proving the console could build a
 * request production had never once accepted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const restPost = vi.fn()
vi.mock('./client', () => ({
  originV1Url: (p: string) => `/v1/${p}`,
  cloudProxyV1Url: (p: string) => `/v1/${p}`,
  restPost: (...a: unknown[]) => restPost(...a),
  restGet: vi.fn(),
}))

import { ApmApi, apmWindow } from './apm'

type Spec = { name: string; signal: string; limit: number; offset: number; filter?: { expression: string }; order?: unknown[] }
type Body = { requestType: string; compositeQuery: { queries: { type: string; spec: Spec }[] } }

/** A v5 `requestType: raw` response, as the server sends it. */
const rawResponse = (rows: unknown[]): unknown => ({
  status: 'success',
  data: { type: 'raw', data: { results: [{ queryName: 'A', rows }] } },
})

/** The single builder-query spec the call put on the wire. Fails loudly rather than
 *  returning undefined, so a test that resolved NO request can never read as a pass. */
function sentSpec(): Spec {
  expect(restPost.mock.calls.length, 'no request was sent — there is nothing to assert about').toBeGreaterThan(0)
  const [, body] = restPost.mock.calls[0] as [string, Body]
  const queries = body?.compositeQuery?.queries
  expect(Array.isArray(queries) && queries.length > 0, 'the body carried no compositeQuery.queries').toBe(true)
  return queries[0].spec
}

describe('ApmApi.logs — the per-product o11y query builds with the service filter + maps real rows', () => {
  beforeEach(() => restPost.mockReset())

  it('sends a service.name filter and normalizes a real O11y logs response to service-scoped rows', async () => {
    restPost.mockResolvedValueOnce(
      rawResponse([
        {
          timestamp: '2026-07-03T00:00:00Z',
          data: { id: 'l1', severity_text: 'INFO', body: 'signed in', resources_string: { 'service.name': 'iam' } },
        },
      ]),
    )

    const rows = await ApmApi.logs(apmWindow(3600), 500, 'iam')

    // 1) the outgoing query carried the per-service filter expression
    const [url, body] = restPost.mock.calls[0] as [string, Body]
    // Version-less canonical o11y surface, addressed via the /v1 bearer BFF.
    expect(url).toBe('/v1/o11y/query_range')
    expect(body.requestType).toBe('raw')
    const spec = sentSpec()
    expect(spec.signal).toBe('logs')
    expect(spec.filter).toEqual({ expression: "service.name = 'iam'" })

    // 2) the real response maps to real, normalized rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ service: 'iam', severity: 'info', body: 'signed in' })
  })

  it('re-filters client-side so a runtime that ignored the filter cannot leak another service onto the page', async () => {
    restPost.mockResolvedValueOnce(
      rawResponse([
        { timestamp: '2', data: { body: 'mine', resources_string: { 'service.name': 'iam' } } },
        { timestamp: '1', data: { body: 'not mine', resources_string: { 'service.name': 'kms' } } },
      ]),
    )
    const rows = await ApmApi.logs(apmWindow(3600), 500, 'iam')
    expect(rows.map((r) => r.body)).toEqual(['mine'])
  })

  it('sends NO filter for the org-wide stream (the Observe Logs board)', async () => {
    restPost.mockResolvedValueOnce(rawResponse([]))
    await ApmApi.logs(apmWindow(3600), 500)
    const spec = sentSpec()
    expect(spec.signal).toBe('logs')
    expect(spec.filter).toBeUndefined()
  })

  it('scopes a trace search the same way, over signal: traces', async () => {
    restPost.mockResolvedValueOnce(rawResponse([{ timestamp: '1', data: { span_id: 's1', trace_id: 't1', name: 'op', resources_string: { 'service.name': 'gateway' } } }]))
    const spans = await ApmApi.traceSearch(apmWindow(3600), 50, 'gateway')
    const spec = sentSpec()
    expect(spec.signal).toBe('traces')
    expect(spec.filter).toEqual({ expression: "service.name = 'gateway'" })
    expect(spans.map((s) => s.service)).toEqual(['gateway'])
  })
})

describe('ApmApi.serviceHealth — picks the product service RED metrics from the live list', () => {
  beforeEach(() => restPost.mockReset())

  it('returns the ServiceHealth for the matching candidate, mapping ns→ms + the RED verdict', async () => {
    restPost.mockResolvedValueOnce([
      { serviceName: 'gateway', p99: 5_000_000, numCalls: 3, errorRate: 0 },
      { serviceName: 'iam', p99: 90_000_000, avgDuration: 20_000_000, numCalls: 500, callRate: 4, errorRate: 2 },
    ])
    const h = await ApmApi.serviceHealth(apmWindow(3600), 'iam')
    expect(h).toMatchObject({ service: 'iam', p99Ms: 90, avgMs: 20, errorRatePct: 2, tone: 'yellow', numCalls: 500, callRate: 4 })
  })

  it('tries candidates in order (o11y service.name, then the operator app name)', async () => {
    restPost.mockResolvedValueOnce([{ serviceName: 'cloud', p99: 10_000_000, numCalls: 42, errorRate: 0 }])
    // first candidate `ai` is absent → falls to `cloud` (the operator/service name)
    const h = await ApmApi.serviceHealth(apmWindow(3600), 'ai', 'cloud')
    expect(h?.service).toBe('cloud')
  })

  it('is honest null when the product service reported no telemetry in the window', async () => {
    restPost.mockResolvedValueOnce([{ serviceName: 'other', numCalls: 10 }])
    expect(await ApmApi.serviceHealth(apmWindow(3600), 'iam')).toBeNull()
  })
})
