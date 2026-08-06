import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  AgentsApi,
  canonicalStatus,
  normalizeAgent,
  normalizeAgents,
  normalizeActivity,
  normalizeMetrics,
  normalizeAgentDetail,
  deriveAgentStats,
  healthBreakdown,
  topByInvocations,
  deriveActivity,
  filterAgents,
  paginate,
  summedSeries,
  trendPct,
  fmtInt,
  fmtCompact,
  fmtPct,
  fmtDuration,
  fmtUsd,
  fmtBytes,
  fmtVersion,
  fmtRelative,
  type Agent,
} from './agents'

/** A minimal agent factory for the pure-logic tests. */
const agent = (over: Partial<Agent> = {}): Agent => ({
  id: over.id ?? 'a1',
  name: over.name ?? 'Agent 1',
  status: over.status ?? 'active',
  ...over,
})

describe('canonicalStatus', () => {
  it('folds synonyms into the four canonical buckets', () => {
    expect(canonicalStatus('running')).toBe('active')
    expect(canonicalStatus('DEPLOYED')).toBe('active')
    expect(canonicalStatus('paused')).toBe('idle')
    expect(canonicalStatus('failed')).toBe('error')
    expect(canonicalStatus('provisioning')).toBe('draft')
  })
  it('treats absent as draft and unknown non-empty as idle', () => {
    expect(canonicalStatus(undefined)).toBe('draft')
    expect(canonicalStatus('')).toBe('draft')
    expect(canonicalStatus('weird-state')).toBe('idle')
  })
})

describe('normalizeAgent', () => {
  it('reads a flat enriched row and canonicalizes status', () => {
    const a = normalizeAgent({
      id: 'sup', name: 'Support', status: 'running', version: '1.4.2', model: 'zen-omni',
      invocations30d: 1200, successRate: 0.98, avgLatencyMs: 320, errors30d: 24,
      lastInvocationAt: '2026-06-01T00:00:00Z', tools: ['http', 'mcp'],
    })
    expect(a).toMatchObject({ id: 'sup', name: 'Support', status: 'active', version: '1.4.2', model: 'zen-omni', invocations30d: 1200, tools: 2 })
    expect(a?.rawStatus).toBe('running')
  })

  it('reads a nested CRD-ish row (metadata/spec/metrics/resources)', () => {
    const a = normalizeAgent({
      metadata: { name: 'triage', creationTimestamp: '2026-05-01T00:00:00Z' },
      spec: { model: { name: 'gpt-4o-mini' }, status: 'paused', description: 'Triage tickets' },
      metrics: { invocations: 42, successRate: 91, avgLatencyMs: 800 },
      resources: { cpuVcpuHours: 12, memGbHours: 30, storageIoBytes: 2048, costCents: 1234 },
    })
    expect(a).toMatchObject({ id: 'triage', name: 'triage', status: 'idle', model: 'gpt-4o-mini', invocations30d: 42, cpuVcpuHours: 12, costCents: 1234 })
    // 91 read as a 0..100 percent → coerced to a 0..1 ratio.
    expect(a?.successRate).toBeCloseTo(0.91, 5)
  })

  it('drops rows with no id/name', () => {
    expect(normalizeAgent({})).toBeNull()
    expect(normalizeAgent({ description: 'no name' })).toBeNull()
  })
})

describe('normalizeAgents (envelope-agnostic)', () => {
  it('reads under agents / data / items / rows or a bare array', () => {
    const rows = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }]
    for (const payload of [rows, { agents: rows }, { data: rows }, { items: rows }, { rows }]) {
      expect(normalizeAgents(payload)).toHaveLength(2)
    }
    expect(normalizeAgents(null)).toEqual([])
    expect(normalizeAgents({ nope: rows })).toEqual([])
  })
})

describe('deriveAgentStats', () => {
  it('sums invocations and invocation-weights rates/latency', () => {
    const agents = [
      agent({ id: '1', status: 'active', invocations30d: 100, successRate: 1, avgLatencyMs: 100 }),
      agent({ id: '2', status: 'idle', invocations30d: 300, successRate: 0.9, avgLatencyMs: 200 }),
    ]
    const s = deriveAgentStats(agents)
    expect(s.total).toBe(2)
    expect(s.active).toBe(1)
    expect(s.idle).toBe(1)
    expect(s.invocations30d).toBe(400)
    // weighted success = (100*1 + 300*0.9)/400 = 0.925
    expect(s.successRate).toBeCloseTo(0.925, 5)
    // weighted latency = (100*100 + 300*200)/400 = 175
    expect(s.avgLatencyMs).toBeCloseTo(175, 5)
    // errors derived = 400*(1-0.925) = 30
    expect(s.errors30d).toBe(30)
  })

  it('returns null metrics when no row reports them', () => {
    const s = deriveAgentStats([agent({ invocations30d: undefined, successRate: undefined, avgLatencyMs: undefined })])
    expect(s.invocations30d).toBeNull()
    expect(s.successRate).toBeNull()
    expect(s.avgLatencyMs).toBeNull()
    expect(s.errors30d).toBeNull()
  })
})

describe('healthBreakdown', () => {
  it('counts agents per canonical status', () => {
    const b = healthBreakdown([
      agent({ status: 'active' }), agent({ status: 'active' }), agent({ status: 'idle' }), agent({ status: 'error' }),
    ])
    expect(b).toEqual({ active: 2, idle: 1, error: 1, draft: 0 })
  })
})

describe('topByInvocations', () => {
  it('ranks agents with real invocation counts, desc, capped', () => {
    const top = topByInvocations([
      agent({ id: 'a', invocations30d: 10 }),
      agent({ id: 'b', invocations30d: 90 }),
      agent({ id: 'c', invocations30d: undefined }),
      agent({ id: 'd', invocations30d: 0 }),
    ], 2)
    expect(top.map((a) => a.id)).toEqual(['b', 'a'])
  })
})

describe('deriveActivity', () => {
  it('emits invoked/updated/created events from real timestamps only, newest first', () => {
    const events = deriveActivity([
      agent({ id: '1', name: 'One', lastInvocationAt: '2026-06-02T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', version: '1.0.0' }),
      agent({ id: '2', name: 'Two', status: 'error', lastInvocationAt: '2026-06-03T00:00:00Z' }),
      agent({ id: '3', name: 'Three', createdAt: '2026-05-01T00:00:00Z' }),
      agent({ id: '4', name: 'Nada' }), // no timestamps → contributes nothing
    ])
    expect(events[0]).toMatchObject({ agent: 'Two', kind: 'failed' }) // newest + errored
    expect(events.some((e) => e.agent === 'One' && e.kind === 'updated')).toBe(true)
    expect(events.some((e) => e.agent === 'Three' && e.kind === 'created')).toBe(true)
    expect(events.some((e) => e.agent === 'Nada')).toBe(false)
  })
})

describe('filterAgents', () => {
  const agents = [
    agent({ id: '1', name: 'Support', description: 'help desk', status: 'active', model: 'zen' }),
    agent({ id: '2', name: 'Triage', description: 'sort issues', status: 'idle', model: 'gpt' }),
  ]
  it('filters by status tab', () => {
    expect(filterAgents(agents, { status: 'active' }).map((a) => a.id)).toEqual(['1'])
    expect(filterAgents(agents, { status: 'all' })).toHaveLength(2)
  })
  it('filters by free-text across name/description/model/version', () => {
    expect(filterAgents(agents, { search: 'sort' }).map((a) => a.id)).toEqual(['2'])
    expect(filterAgents(agents, { search: 'zen' }).map((a) => a.id)).toEqual(['1'])
    expect(filterAgents(agents, { search: 'nomatch' })).toEqual([])
  })
})

describe('paginate', () => {
  it('clamps the page and slices', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i)
    expect(paginate(rows, 1, 10)).toMatchObject({ page: 1, totalPages: 3 })
    expect(paginate(rows, 99, 10)).toMatchObject({ page: 3 })
    expect(paginate(rows, 3, 10).rows).toEqual([20, 21, 22, 23, 24])
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, totalPages: 1, rows: [] })
  })
})

describe('summedSeries + trendPct', () => {
  it('sums aligned multi-line buckets', () => {
    expect(summedSeries([
      { key: 'a', points: [{ t: '', v: 1 }, { t: '', v: 2 }] },
      { key: 'b', points: [{ t: '', v: 10 }, { t: '', v: 20 }] },
    ])).toEqual([11, 22])
  })
  it('computes a second-half-vs-first-half delta, null when too short or zero base', () => {
    expect(trendPct([1, 1, 2, 2])).toBeCloseTo(100, 5)
    expect(trendPct([1, 2])).toBeNull()
    expect(trendPct([0, 0, 5, 5])).toBeNull()
  })
})

describe('normalizeActivity', () => {
  it('maps known kinds and defaults unknown to invoked', () => {
    const feed = normalizeActivity({ activity: [
      { id: 'e1', kind: 'failed', agent: 'A', at: '2026-06-01T00:00:00Z' },
      { type: 'weird', name: 'B' },
    ] })
    expect(feed[0]).toMatchObject({ kind: 'failed', agent: 'A' })
    expect(feed[1]).toMatchObject({ kind: 'invoked', agent: 'B' })
  })
})

describe('normalizeMetrics', () => {
  it('reads series + resource rollup, degrading missing resource to null', () => {
    const m = normalizeMetrics({
      series: [{ key: 'a', points: [{ t: 't0', v: 3 }, { time: 't1', value: 4 }] }],
      resource: { cpuVcpuHours: 5, cost: 1.5 },
    })
    expect(m.series[0].points).toEqual([{ t: 't0', v: 3 }, { t: 't1', v: 4 }])
    expect(m.resource.cpuVcpuHours).toBe(5)
    expect(m.resource.costCents).toBe(150) // dollars → cents
    expect(m.resource.memGbHours).toBeNull()
    expect(m.resource.storageIoBytes).toBeNull()
  })
  it('returns empty series + all-null resource for an empty payload', () => {
    expect(normalizeMetrics({})).toEqual({ series: [], resource: { cpuVcpuHours: null, memGbHours: null, storageIoBytes: null, costCents: null } })
  })
})

describe('normalizeAgentDetail', () => {
  it('reads the row + its recent activity, and unwraps an { agent } envelope', () => {
    const d = normalizeAgentDetail({ agent: { id: 'a', name: 'A', status: 'active' }, activity: [{ id: 'x', kind: 'invoked', agent: 'A', at: '2026-06-01T00:00:00Z' }] })
    expect(d).toMatchObject({ id: 'a', name: 'A' })
    expect(d?.recentActivity).toHaveLength(1)
  })
})

describe('formatters', () => {
  it('render em-dash for missing and format present values', () => {
    expect(fmtInt(undefined)).toBe('—')
    expect(fmtInt(1234)).toBe('1,234')
    expect(fmtCompact(1234)).toBe('1.23K')
    expect(fmtCompact(null)).toBe('—')
    expect(fmtPct(0.923)).toBe('92.3%')
    expect(fmtPct(1)).toBe('100%')
    expect(fmtPct(null)).toBe('—')
    expect(fmtDuration(320)).toBe('320ms')
    expect(fmtDuration(1240)).toBe('1.24s')
    expect(fmtUsd(1234)).toBe('$12.34')
    expect(fmtUsd(null)).toBe('—')
    expect(fmtBytes(2048)).toBe('2.0 KB')
    expect(fmtBytes(null)).toBe('—')
    expect(fmtVersion('1.2.3')).toBe('v1.2.3')
    expect(fmtVersion('v9')).toBe('v9')
    expect(fmtVersion(null)).toBe('—')
  })
  it('fmtRelative is now-injectable', () => {
    const now = new Date('2026-06-10T00:00:00Z').getTime()
    expect(fmtRelative('2026-06-10T00:00:00Z', now)).toBe('just now')
    expect(fmtRelative('2026-06-09T00:00:00Z', now)).toBe('1d ago')
    expect(fmtRelative(undefined, now)).toBe('—')
  })
})

/**
 * The single-agent routes (`GET`/`DELETE /v1/agents/:name`) are keyed on the agent's
 * org-unique NAME — its backend handle — NOT the display `id` (`agent_…`). Passing the
 * id 404s ("agent not found"), which is exactly what left the detail-pane activity empty
 * and made the Delete button a silent no-op. These pin that `get`/`remove` build the
 * name path (and URL-encode it), so that regression can't return.
 */
describe('AgentsApi — single-agent routes are name-keyed', () => {
  // Two hosts, and the split is the point: ORIGIN is where the PAGE is served, API
  // (`CANONICAL_API_URL`) is where every `/v1` call goes. They no longer coincide.
  const ORIGIN = 'https://console.hanzo.ai'
  const API = 'https://api.hanzo.ai'
  let calls: { url: string; method: string }[] = []

  beforeEach(() => {
    calls = []
    ;(globalThis as { window?: unknown }).window = {
      location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    }
    vi.stubGlobal('fetch', (url: string, init?: { method?: string }) => {
      calls.push({ url, method: (init?.method ?? 'GET').toUpperCase() })
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'agent_8c25', name: 'des', model: 'zen', status: 'ready' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as { window?: unknown }).window
  })

  it('get(name) fetches /v1/agents/:name (the NAME handle, not the agent_ id)', async () => {
    await AgentsApi.get('des')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${API}/v1/agents/des`)
    // The `agent_…` display id must NEVER be the path segment — that is the 404 bug.
    expect(calls[0].url).not.toContain('agent_')
  })

  it('remove(name) DELETEs /v1/agents/:name', async () => {
    await AgentsApi.remove('des')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].url).toBe(`${API}/v1/agents/des`)
  })

  it('URL-encodes a name with reserved characters', async () => {
    await AgentsApi.get('a b/c')
    expect(calls[0].url).toBe(`${API}/v1/agents/a%20b%2Fc`)
  })
})
