import { describe, expect, it } from 'vitest'

import { curlFor, eventsFrom, inspectorRoute, renderOutput, terminalFor } from './logic'

describe('renderOutput', () => {
  it('pretty-prints JSON and passes strings through', () => {
    expect(renderOutput({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(renderOutput('plain')).toBe('plain')
  })

  it('truncates a huge payload with an honest marker', () => {
    const out = renderOutput('x'.repeat(25000), 100)
    expect(out.startsWith('x'.repeat(100))).toBe(true)
    expect(out).toContain('24900 more characters truncated')
  })
})

describe('inspectorRoute', () => {
  it('routes each id prefix to the right /v1 GET', () => {
    expect(inspectorRoute('agent_abc')).toEqual({ path: 'agents/agent_abc', kind: 'agent', label: 'Agent' })
    expect(inspectorRoute('fn_hello')).toEqual({ path: 'functions/fn_hello', kind: 'function', label: 'Function' })
    expect(inspectorRoute('flow_1')).toEqual({ path: 'automations/flows/flow_1', kind: 'flow', label: 'Automation flow' })
    expect(inspectorRoute('run_9')).toEqual({ path: 'automations/runs/run_9', kind: 'run', label: 'Automation run' })
    expect(inspectorRoute('prompt_x')).toEqual({ path: 'prompts/prompt_x', kind: 'prompt', label: 'Prompt' })
    expect(inspectorRoute('trace_z')).toEqual({ path: 'o11y/traces/trace_z', kind: 'trace', label: 'Trace' })
  })

  it('maps an sk-/pk- key to the account key status (never a secret path)', () => {
    for (const k of ['sk-live-xyz', 'pk-123']) {
      expect(inspectorRoute(k)).toEqual({ path: 'iam/keys', kind: 'key', label: 'API key' })
    }
  })

  it('accepts a raw resource/name path as the fallback', () => {
    expect(inspectorRoute('agents/my-agent')).toEqual({ path: 'agents/my-agent', kind: 'resource', label: 'Resource' })
    expect(inspectorRoute('/v1/models/zen5')).toEqual({ path: 'models/zen5', kind: 'resource', label: 'Resource' })
  })

  it('refuses empty, a URL, traversal, and an unrecognized bare token', () => {
    expect(inspectorRoute('')).toHaveProperty('error')
    expect(inspectorRoute('https://evil.com/x')).toHaveProperty('error')
    expect(inspectorRoute('agents/../admin')).toHaveProperty('error')
    expect(inspectorRoute('justaword')).toHaveProperty('error')
    // `sk-` and `pk-` are the only key shapes — any other prefix is unrecognized.
    expect(inspectorRoute('xk-abc')).toHaveProperty('error')
  })
})

describe('show code', () => {
  it('builds a real curl with the bearer key, from any path form', () => {
    expect(curlFor('models')).toBe('curl https://api.hanzo.ai/v1/models \\\n  -H "Authorization: Bearer $HANZO_API_KEY"')
    expect(curlFor('/v1/agents')).toContain('https://api.hanzo.ai/v1/agents')
  })
})

describe('eventsFrom', () => {
  const rec = (o: Partial<Parameters<typeof eventsFrom>[0][number]>) => ({
    id: 'i', requestId: '', model: '', product: '', agent: '', status: '', cents: 0, at: null, ...o,
  })

  it('projects ledger rows into typed platform events, newest first', () => {
    const out = eventsFrom([
      rec({ id: 'a', model: 'zen5', status: 'success', at: 100, cents: 12 }),
      rec({ id: 'b', model: 'glm', status: 'error', at: 300 }),
      rec({ id: 'c', agent: 'bot', status: 'success', at: 200 }),
    ])
    expect(out.map((e) => e.id)).toEqual(['b', 'c', 'a']) // newest first (300,200,100)
    expect(out[0].type).toBe('request.failed')
    expect(out[1].type).toBe('agent.run.succeeded')
    expect(out[2].type).toBe('request.succeeded')
  })

  it('prefers the gateway requestId as the event id and is honest-empty', () => {
    expect(eventsFrom([rec({ id: 'x', requestId: 'req_1', at: 1 })])[0].id).toBe('req_1')
    expect(eventsFrom([])).toEqual([])
  })
})

describe('cloud shell — where the terminal is', () => {
  it('addresses the API host, not the console origin — a frame cannot ride the /v1 proxy', () => {
    expect(terminalFor('https://api.hanzo.ai', 'm_abc', 'tok', 'dock')).toBe(
      'https://api.hanzo.ai/v1/sandboxes/m_abc/terminal?ticket=tok&arg=dock',
    )
  })

  it('tolerates a trailing slash and escapes what it interpolates', () => {
    expect(terminalFor('https://api.hanzo.ai/', 'm_1', 't', 'dock')).toContain(
      'api.hanzo.ai/v1/sandboxes/m_1/terminal',
    )
    // An id is hex and a ticket is base64url, but neither is trusted to be: an
    // unescaped `&` would silently truncate the credential.
    expect(terminalFor('https://api.hanzo.ai', 'a/b', 'x&y=z', 'p 1')).toBe(
      'https://api.hanzo.ai/v1/sandboxes/a%2Fb/terminal?ticket=x%26y%3Dz&arg=p%201',
    )
  })

  it('names a session, so reopening the dock reattaches instead of starting over', () => {
    expect(terminalFor('https://api.hanzo.ai', 'm_1', 't', 'dock')).toContain('arg=dock')
  })
})
