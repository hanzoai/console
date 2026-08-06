import { describe, expect, it } from 'vitest'

import {
  apmWindow,
  normalizeService,
  normalizeServices,
  normalizeEdge,
  normalizeDependencies,
  normalizeTopOperations,
  normalizeHosts,
  normalizePods,
  normalizeNodes,
  normalizeException,
  normalizeExceptions,
  normalizeDashboard,
  normalizeDashboards,
  listQueryPayload,
  serviceFilterExpression,
  pickService,
  serviceHealthOf,
  parseListRows,
  toIso,
  normalizeLogRow,
  normalizeLogs,
  normalizeTraceSpan,
  normalizeSpans,
  type ServiceRow,
} from './apm'

describe('apmWindow', () => {
  it('produces ns strings and ms numbers for the same window', () => {
    const w = apmWindow(3600)
    expect(w.endMs - w.startMs).toBe(3600 * 1000)
    // ns = ms * 1e6
    expect(w.startNs).toBe(String(w.startMs * 1_000_000))
    expect(w.endNs).toBe(String(w.endMs * 1_000_000))
    // ns strings are integer-only (no exponent) so O11y parses them
    expect(w.startNs).toMatch(/^\d+$/)
    expect(w.endNs).toMatch(/^\d+$/)
  })
})

describe('normalizeService', () => {
  it('maps the O11y ServiceItem wire shape', () => {
    const row = normalizeService({
      serviceName: 'cloud-api',
      p99: 125_000_000,
      avgDuration: 40_000_000,
      numCalls: 1200,
      callRate: 3.4,
      numErrors: 12,
      errorRate: 1,
      num4XX: 5,
      fourXXRate: 0.4,
    })
    expect(row.serviceName).toBe('cloud-api')
    expect(row.p99).toBe(125_000_000)
    expect(row.numCalls).toBe(1200)
    expect(row.errorRate).toBe(1)
  })

  it('degrades missing/garbage fields to safe defaults, never throws', () => {
    expect(normalizeService(undefined)).toEqual({
      serviceName: '',
      p99: 0,
      avgDuration: 0,
      numCalls: 0,
      callRate: 0,
      numErrors: 0,
      errorRate: 0,
      num4XX: 0,
      fourXXRate: 0,
    })
    expect(normalizeService({ serviceName: 'x', p99: 'NaN', numCalls: null }).p99).toBe(0)
  })
})

describe('normalizeServices', () => {
  it('reads a bare array and drops nameless rows', () => {
    const out = normalizeServices([{ serviceName: 'a', numCalls: 1 }, { serviceName: '' }, { numCalls: 2 }])
    expect(out).toHaveLength(1)
    expect(out[0].serviceName).toBe('a')
  })
  it('reads a {data:[…]} envelope', () => {
    const out = normalizeServices({ data: [{ serviceName: 'b' }] })
    expect(out.map((s) => s.serviceName)).toEqual(['b'])
  })
  it('garbage → []', () => {
    expect(normalizeServices(null)).toEqual([])
    expect(normalizeServices('nope')).toEqual([])
  })
})

describe('normalizeEdge / normalizeDependencies', () => {
  it('maps a dependency edge', () => {
    const e = normalizeEdge({ parent: 'gateway', child: 'cloud-api', callCount: 900, callRate: 2.1, errorRate: 0.5, p99: 1e8, p95: 8e7, p50: 3e7 })
    expect(e.parent).toBe('gateway')
    expect(e.child).toBe('cloud-api')
    expect(e.callCount).toBe(900)
    expect(e.p50).toBe(3e7)
  })
  it('drops edges missing an endpoint', () => {
    const out = normalizeDependencies([{ parent: 'a', child: 'b' }, { parent: 'a' }, { child: 'b' }])
    expect(out).toHaveLength(1)
  })
})

describe('normalizeTopOperations', () => {
  it('reads name/operation and drops nameless', () => {
    const out = normalizeTopOperations([{ name: 'GET /v1/x', numCalls: 5 }, { operation: 'POST /v1/y', numCalls: 3 }, { numCalls: 1 }])
    expect(out.map((o) => o.name)).toEqual(['GET /v1/x', 'POST /v1/y'])
  })
})

describe('normalizeHosts', () => {
  it('maps host records + derives name/os from meta when absent', () => {
    const out = normalizeHosts({
      type: 'list',
      total: 2,
      records: [
        { hostName: 'node-1', active: true, os: 'linux', cpu: 0.42, memory: 0.6, wait: 0.01, load15: 1.2 },
        { active: false, cpu: 0.1, memory: 0.2, meta: { 'host.name': 'node-2', 'os.type': 'linux' } },
      ],
    })
    expect(out.total).toBe(2)
    expect(out.hasData).toBe(true)
    expect(out.records[0].hostName).toBe('node-1')
    expect(out.records[0].active).toBe(true)
    expect(out.records[1].hostName).toBe('node-2')
    expect(out.records[1].os).toBe('linux')
  })
  it('empty records → hasData false, total 0', () => {
    const out = normalizeHosts({ type: 'list', records: [], total: 0 })
    expect(out.hasData).toBe(false)
    expect(out.total).toBe(0)
  })
  it('reads a nested {data:{records}} envelope', () => {
    const out = normalizeHosts({ data: { records: [{ hostName: 'h' }], total: 1 } })
    expect(out.records[0].hostName).toBe('h')
  })
})

describe('normalizePods', () => {
  it('maps pod records, phase counts, and namespace/name from meta', () => {
    const out = normalizePods({
      records: [
        {
          podCPU: 0.25,
          podCPURequest: 0.5,
          podMemory: 1e8,
          restartCount: 3,
          countByPhase: { pending: 1, running: 4, succeeded: 0, failed: 0, unknown: 0 },
          meta: { 'k8s.pod.name': 'cloud-api-abc', 'k8s.namespace.name': 'hanzo' },
        },
      ],
      total: 1,
    })
    const p = out.records[0]
    expect(p.podName).toBe('cloud-api-abc')
    expect(p.namespace).toBe('hanzo')
    expect(p.restarts).toBe(3)
    expect(p.phase.running).toBe(4)
  })
})

describe('normalizeNodes', () => {
  it('maps node usage/allocatable and condition counts', () => {
    const out = normalizeNodes({
      records: [
        {
          nodeCPUUsage: 1.5,
          nodeCPUAllocatable: 4,
          nodeMemoryUsage: 2e9,
          nodeMemoryAllocatable: 8e9,
          countByCondition: { ready: 1, notReady: 0, unknown: 0 },
          meta: { 'k8s.node.name': 'pool-1-xyz' },
        },
      ],
      total: 1,
    })
    const n = out.records[0]
    expect(n.nodeName).toBe('pool-1-xyz')
    expect(n.cpuUsage).toBe(1.5)
    expect(n.condition.ready).toBe(1)
  })
})

describe('normalizeException / normalizeExceptions', () => {
  it('maps a grouped error (the O11y Error struct)', () => {
    const e = normalizeException({
      exceptionType: 'RuntimeError',
      exceptionMessage: 'nil pointer',
      exceptionCount: 42,
      serviceName: 'cloud-api',
      groupID: 'g123',
      lastSeen: '2026-07-01T10:00:00Z',
      firstSeen: '2026-06-30T09:00:00Z',
    })
    expect(e.exceptionType).toBe('RuntimeError')
    expect(e.exceptionCount).toBe(42)
    expect(e.groupID).toBe('g123')
  })
  it('drops fully-empty rows but keeps message-only rows', () => {
    const out = normalizeExceptions([
      { exceptionType: 'E', exceptionCount: 1 },
      { exceptionMessage: 'just a message' },
      {},
    ])
    expect(out).toHaveLength(2)
  })
})

describe('normalizeDashboard / normalizeDashboards', () => {
  it('reads O11y nested data.{title,description,tags,widgets}', () => {
    const d = normalizeDashboard({
      uuid: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'z@hanzo.ai',
      data: { title: 'API health', description: 'RED', tags: ['prod', 'api'], widgets: [{}, {}, {}] },
    })
    expect(d.uuid).toBe('u1')
    expect(d.title).toBe('API health')
    expect(d.tags).toEqual(['prod', 'api'])
    expect(d.widgetCount).toBe(3)
    expect(d.createdBy).toBe('z@hanzo.ai')
  })
  it('falls back to top-level title and defaults an untitled dashboard', () => {
    expect(normalizeDashboard({ uuid: 'u2', title: 'Top level' }).title).toBe('Top level')
    expect(normalizeDashboard({ uuid: 'u3' }).title).toBe('Untitled dashboard')
  })
  it('reads a {status,data:[…]} list and drops uuid-less rows', () => {
    const out = normalizeDashboards({ status: 'success', data: [{ uuid: 'a', data: { title: 'A' } }, { data: { title: 'no uuid' } }] })
    expect(out.map((d) => d.uuid)).toEqual(['a'])
  })
})

// ── The o11y v5 query_range contract, transcribed from the SERVER ─────────────
//
// These literals come from `QueryRangeRequest` / `CompositeQuery` / `QueryEnvelope` in
// github.com/hanzoai/o11y v1.5.58 — the server's own definition of what it will accept.
// They are deliberately NOT imported from `./apm`. The suite this replaced imported the
// builder and then asserted that the builder built what the builder was written to build
// (`p.compositeQuery.queryType === 'builder'`), which is true of any builder and stayed
// green for as long as it took someone to notice that production had been answering 400
// to every Logs and Traces load. A payload test is only worth running if the expectation
// comes from the other side of the wire.

/** `QueryRangeRequest.requestType` — the accepted result kinds. */
const REQUEST_TYPES = ['scalar', 'time_series', 'raw', 'raw_stream', 'trace', 'distribution']
/** `QueryEnvelope.type` — the accepted query kinds. Note `builder` is NOT one of them. */
const QUERY_TYPES = [
  'builder_query',
  'builder_formula',
  'builder_sub_query',
  'builder_join',
  'builder_trace_operator',
  'promql',
  'datastore_sql',
]
/** `CompositeQuery` has exactly ONE field. Anything else is rejected by name. */
const COMPOSITE_FIELDS = ['queries']
/**
 * The retired v3 envelope, field by field. The server refuses each of these explicitly
 * (`400 unknown field "queryType" in composite query`, then "panelType", then
 * "builderQueries"), so any one of them anywhere in the body is a 400 waiting to ship.
 */
const V3_KEYS = ['queryType', 'panelType', 'builderQueries', 'dataSource', 'aggregateOperator']

/**
 * Every object key in a JSON tree, in visit order. Arrays are walked as containers, so a
 * key buried in `compositeQuery.queries[0].spec.filter` is still seen — a check that
 * only looked at the top level would quietly stop matching the moment the shape nested.
 */
function everyKey(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) {
    for (const x of v) everyKey(x, out)
    return out
  }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out.push(k)
      everyKey(x, out)
    }
  }
  return out
}

describe('everyKey (the forbidden-key walk itself)', () => {
  it('descends through objects AND arrays, so nothing hides below the top level', () => {
    expect(everyKey({ a: 1, b: { c: [{ d: 2 }] } })).toEqual(['a', 'b', 'c', 'd'])
  })
  it('returns [] for a leaf — which is why every caller asserts it found keys', () => {
    expect(everyKey(null)).toEqual([])
    expect(everyKey('nope')).toEqual([])
  })
})

describe('listQueryPayload — pinned to the o11y v5 query_range contract', () => {
  const w = apmWindow(3600)
  /** The payload as it goes over the WIRE: `JSON.stringify` is what the transport sends,
   *  and it is where an `undefined`-valued key disappears. Assert on that, not on the
   *  in-memory object the server never sees. */
  const wire = (signal: 'logs' | 'traces', limit: number, service?: string): Record<string, unknown> =>
    JSON.parse(JSON.stringify(listQueryPayload(signal, w, limit, service))) as Record<string, unknown>

  const cases = [
    { name: 'org-wide logs', body: wire('logs', 100) },
    { name: 'service-scoped logs', body: wire('logs', 100, 'iam') },
    { name: 'org-wide traces', body: wire('traces', 50) },
    { name: 'service-scoped traces', body: wire('traces', 50, 'gateway') },
  ]

  it('emits a requestType the server accepts, on every payload it can build', () => {
    expect(cases.length, 'no payloads under test — this asserts nothing').toBeGreaterThan(0)
    for (const c of cases) {
      expect(REQUEST_TYPES, `${c.name}: requestType must be one the server accepts`).toContain(c.body.requestType)
    }
  })

  it('compositeQuery carries ONLY `queries`, a non-empty array of accepted envelopes', () => {
    for (const c of cases) {
      const composite = c.body.compositeQuery as Record<string, unknown>
      expect(composite, `${c.name}: compositeQuery is missing`).toBeTruthy()
      expect(Object.keys(composite).sort(), `${c.name}: compositeQuery must have exactly one field`).toEqual(COMPOSITE_FIELDS)
      const queries = composite.queries as { type?: unknown }[]
      expect(Array.isArray(queries), `${c.name}: compositeQuery.queries must be an array`).toBe(true)
      expect(queries.length, `${c.name}: compositeQuery.queries is empty — no envelope was inspected`).toBeGreaterThan(0)
      for (const q of queries) {
        expect(QUERY_TYPES, `${c.name}: envelope type must be one the server accepts`).toContain(q.type)
      }
    }
  })

  it('no v3 envelope key survives ANYWHERE in the serialized body', () => {
    for (const c of cases) {
      const keys = everyKey(c.body)
      expect(keys.length, `${c.name}: the key walk visited nothing, so it proves nothing`).toBeGreaterThan(0)
      expect(keys.filter((k) => V3_KEYS.includes(k)), `${c.name}: retired v3 keys must not reach the wire`).toEqual([])
    }
  })

  it('describes the read: schemaVersion, the ms window, the signal, and the page', () => {
    const p = wire('logs', 100)
    expect(p.schemaVersion).toBe('v1')
    expect(p.start).toBe(w.startMs)
    expect(p.end).toBe(w.endMs)
    expect(p.requestType).toBe('raw') // whole rows back, not an aggregate
    const spec = ((p.compositeQuery as { queries: { spec: Record<string, unknown> }[] }).queries[0]).spec
    expect(spec.name).toBe('A')
    expect(spec.signal).toBe('logs')
    expect(spec.limit).toBe(100)
    expect(spec.offset).toBe(0)
    expect(wire('traces', 50).compositeQuery).toMatchObject({ queries: [{ spec: { signal: 'traces' } }] })
  })

  it('clamps the row limit into [1,1000] and floors it', () => {
    const limitOf = (n: number): unknown =>
      ((wire('logs', n).compositeQuery as { queries: { spec: { limit: unknown } }[] }).queries[0]).spec.limit
    expect(limitOf(99999)).toBe(1000)
    expect(limitOf(0)).toBe(1)
    expect(limitOf(12.9)).toBe(12)
  })

  it('the org-wide stream carries no filter and no order (nothing to scope)', () => {
    const spec = ((wire('logs', 100).compositeQuery as { queries: { spec: Record<string, unknown> }[] }).queries[0]).spec
    expect(spec.filter).toBeUndefined()
    expect(spec.order).toBeUndefined()
  })

  it('a service scope adds the v5 filter EXPRESSION and a newest-first order', () => {
    const spec = ((wire('logs', 100, 'iam').compositeQuery as { queries: { spec: Record<string, unknown> }[] }).queries[0]).spec
    expect(spec.filter).toEqual({ expression: "service.name = 'iam'" })
    expect(spec.order).toEqual([{ key: { name: 'timestamp' }, direction: 'desc' }])
  })
})

describe('serviceFilterExpression (scope a logs/traces query to one OTel service.name)', () => {
  it('builds the v5 filter expression — one string, not a v3 {key,op,value} item', () => {
    expect(serviceFilterExpression('vector')).toBe("service.name = 'vector'")
  })
  it('escapes the backslash and the quote so a name cannot break out of the literal', () => {
    expect(serviceFilterExpression("it's")).toBe("service.name = 'it\\'s'")
    expect(serviceFilterExpression('a\\b')).toBe("service.name = 'a\\\\b'")
  })
})

describe('pickService (RED-metrics row for a product, by candidate names)', () => {
  const rows: ServiceRow[] = [
    { serviceName: 'iam', p99: 1, avgDuration: 1, numCalls: 5, callRate: 1, numErrors: 0, errorRate: 0, num4XX: 0, fourXXRate: 0 },
    { serviceName: 'cloud', p99: 1, avgDuration: 1, numCalls: 9, callRate: 2, numErrors: 0, errorRate: 0, num4XX: 0, fourXXRate: 0 },
  ]
  it('exact-matches the first candidate that exists', () => {
    expect(pickService(rows, ['iam'])?.serviceName).toBe('iam')
    // tries candidates in order — a missing first, then a hit.
    expect(pickService(rows, ['ai', 'cloud'])?.serviceName).toBe('cloud')
  })
  it('returns null on no match (→ honest empty, never another service)', () => {
    expect(pickService(rows, ['nope'])).toBeNull()
    expect(pickService(rows, [null, undefined, ''])).toBeNull()
    expect(pickService([], ['iam'])).toBeNull()
  })
})

describe('serviceHealthOf (RED verdict for one service)', () => {
  const row = (over: Partial<ServiceRow>): ServiceRow => ({
    serviceName: 'iam', p99: 125_000_000, avgDuration: 40_000_000, numCalls: 1200, callRate: 3.4, numErrors: 12, errorRate: 1, num4XX: 5, fourXXRate: 0.4, ...over,
  })
  it('converts ns latency → ms and reads the (already-percent) error rate', () => {
    const h = serviceHealthOf(row({}))!
    expect(h.service).toBe('iam')
    expect(h.p99Ms).toBe(125) // 125e6 ns → 125 ms
    expect(h.avgMs).toBe(40)
    expect(h.errorRatePct).toBe(1)
    expect(h.callRate).toBe(3.4)
    expect(h.numCalls).toBe(1200)
  })
  it('rolls a RED verdict: <1% green, ≥1% yellow, ≥5% red', () => {
    expect(serviceHealthOf(row({ errorRate: 0.2 }))!.tone).toBe('green')
    expect(serviceHealthOf(row({ errorRate: 1 }))!.tone).toBe('yellow')
    expect(serviceHealthOf(row({ errorRate: 7 }))!.tone).toBe('red')
  })
  it('is null when the service reported no calls (nothing to fabricate a verdict from)', () => {
    expect(serviceHealthOf(row({ numCalls: 0 }))).toBeNull()
    expect(serviceHealthOf(null)).toBeNull()
    expect(serviceHealthOf(row({ serviceName: '' }))).toBeNull()
  })
})

/** A v5 `requestType: raw` response, as the server sends it. */
const rawResponse = (rows: unknown[]): unknown => ({
  status: 'success',
  data: { type: 'raw', data: { results: [{ queryName: 'A', rows }] } },
})

describe('parseListRows', () => {
  it('reads rows from the v5 location data.data.results[].rows', () => {
    const body = rawResponse([{ timestamp: '1', data: { body: 'a' } }, { timestamp: '2', data: { body: 'b' } }])
    expect(parseListRows(body)).toHaveLength(2)
  })
  it('concatenates the rows of every result in the response', () => {
    const body = { data: { data: { results: [{ queryName: 'A', rows: [{ data: {} }] }, { queryName: 'B', rows: [{ data: {} }, { data: {} }] }] } } }
    expect(parseListRows(body)).toHaveLength(3)
  })
  it('does NOT read the retired v3 locations — one shape, and it is the current one', () => {
    expect(parseListRows({ data: { result: [{ list: [{ timestamp: '1', data: { body: 'a' } }] }] } })).toEqual([])
    expect(parseListRows({ data: { newResult: { data: { result: [{ list: [{ timestamp: '1', data: {} }] }] } } } })).toEqual([])
  })
  it('returns [] for empty/garbage/missing shapes (never throws)', () => {
    expect(parseListRows(null)).toEqual([])
    expect(parseListRows({})).toEqual([])
    expect(parseListRows({ data: { data: { results: null } } })).toEqual([])
    expect(parseListRows({ data: { data: { results: [{ rows: null }] } } })).toEqual([])
    expect(parseListRows('nope')).toEqual([])
  })
})

describe('toIso', () => {
  const iso = '2026-07-03T00:00:00.000Z'
  const ms = Date.parse(iso)
  it('passes an ISO string through unchanged', () => {
    expect(toIso(iso)).toBe(iso)
  })
  it('treats a plain ms number as ms', () => {
    expect(toIso(ms)).toBe(iso)
  })
  it('collapses nanosecond epochs to ms', () => {
    expect(toIso(String(ms * 1_000_000))).toBe(iso)
    expect(toIso(ms * 1_000_000)).toBe(iso)
  })
  it('promotes a seconds epoch to ms', () => {
    expect(toIso(Math.floor(ms / 1000))).toBe(iso)
  })
  it('returns empty for null/blank/NaN', () => {
    expect(toIso(undefined)).toBe('')
    expect(toIso(null)).toBe('')
    expect(toIso('')).toBe('')
    expect(toIso('not-a-date')).toBe('not-a-date') // non-numeric string is treated as ISO passthrough
  })
})

describe('normalizeLogRow / normalizeLogs', () => {
  it('projects a O11y log row into {id,timestamp,severity,service,body}', () => {
    const isoT = '2026-07-03T00:00:00.000Z'
    const ns = String(Date.parse(isoT) * 1_000_000) // ns epoch as O11y emits
    const row = {
      timestamp: ns,
      data: { id: 'log-1', severity_text: 'ERROR', 'service.name': 'iam', body: 'boom' },
    }
    const l = normalizeLogRow(row, 0)
    expect(l.id).toBe('log-1')
    expect(l.severity).toBe('error') // lowercased
    expect(l.service).toBe('iam')
    expect(l.body).toBe('boom')
    expect(l.timestamp).toBe(isoT)
  })
  it('tolerates column-name variants and synthesizes an id when absent', () => {
    const l = normalizeLogRow({ timestamp: 5, data: { level: 'warn', serviceName: 'cloud', message: 'hi' } }, 3)
    expect(l.severity).toBe('warn')
    expect(l.service).toBe('cloud')
    expect(l.body).toBe('hi')
    expect(l.id).toBe('5-3') // ts-idx fallback
  })
  it('lifts service.name out of the v5 resources_string map (it is a RESOURCE attribute)', () => {
    const l = normalizeLogRow(
      {
        timestamp: '2026-07-03T00:00:00Z',
        data: {
          body: 'request served',
          severity_text: 'INFO',
          resources_string: { 'service.name': 'cloud-api', 'deployment.environment': 'main' },
          attributes_string: { 'client.address': '10.0.0.1', 'http.request.method': 'GET' },
        },
      },
      0,
    )
    expect(l.service).toBe('cloud-api')
    expect(l.body).toBe('request served')
    expect(l.severity).toBe('info')
  })
  it('leaves service empty when the row carries no service.name anywhere (never invented)', () => {
    const l = normalizeLogRow({ timestamp: 5, data: { body: 'orphan', attributes_string: { error: 'boom' } } }, 0)
    expect(l.service).toBe('')
    expect(l.body).toBe('orphan')
  })
  it('prefers a materialized top-level column over a same-named nested attribute', () => {
    const l = normalizeLogRow({ timestamp: 1, data: { body: 'column', attributes_string: { body: 'attribute' } } }, 0)
    expect(l.body).toBe('column')
  })
  it('maps a full v5 query_range logs response, newest-first order preserved', () => {
    const rows = normalizeLogs(rawResponse([{ timestamp: '2', data: { body: 'newer' } }, { timestamp: '1', data: { body: 'older' } }]))
    expect(rows.map((r) => r.body)).toEqual(['newer', 'older'])
  })
  it('empty result → empty list (honest empty, not a throw)', () => {
    expect(normalizeLogs(rawResponse([]))).toEqual([])
  })
})

describe('normalizeTraceSpan / normalizeSpans', () => {
  it('projects a span row into {id,traceId,name,service,durationNano,status}', () => {
    const row = {
      timestamp: 1751500800000,
      data: { spanID: 's1', traceID: 't1', name: 'GET /v1/chat', serviceName: 'gateway', durationNano: 12345, statusCode: '200' },
    }
    const s = normalizeTraceSpan(row, 0)
    expect(s.id).toBe('s1')
    expect(s.traceId).toBe('t1')
    expect(s.name).toBe('GET /v1/chat')
    expect(s.service).toBe('gateway')
    expect(s.durationNano).toBe(12345)
    expect(s.status).toBe('200')
  })
  it('durationNano is null when absent/blank (honest —, not 0)', () => {
    expect(normalizeTraceSpan({ data: { spanID: 's' } }, 0).durationNano).toBeNull()
    expect(normalizeTraceSpan({ data: { spanID: 's', durationNano: '' } }, 0).durationNano).toBeNull()
  })
  it('reads the v5 trace column names (trace_id / span_id / duration_nano / service.name)', () => {
    const s = normalizeTraceSpan(
      {
        timestamp: '2026-07-03T00:00:00Z',
        data: {
          trace_id: 't1',
          span_id: 's1',
          name: 'GET /v1/chat',
          duration_nano: 12345,
          resources_string: { 'service.name': 'gateway' },
        },
      },
      0,
    )
    expect(s.id).toBe('s1')
    expect(s.traceId).toBe('t1')
    expect(s.service).toBe('gateway')
    expect(s.durationNano).toBe(12345)
  })
  it('maps a full v5 query_range traces response', () => {
    expect(normalizeSpans(rawResponse([{ timestamp: '1', data: { trace_id: 't', name: 'op' } }]))).toHaveLength(1)
  })
})
