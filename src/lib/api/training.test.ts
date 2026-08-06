import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import {
  TrainingApi,
  DEFAULT_LORA,
  LLAMA_TARGET_MODULES,
  normClientInfo,
  normClientDetail,
  normLoraConfig,
  normForwardBackward,
  normSampleResult,
} from './training'

/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

type Call = { url: string; method: string; body: unknown }

/** Stub `fetch` so each call is captured and answered with `resp` (JSON by default). */
function stubFetch(resp: (call: Call) => { status?: number; body: unknown; contentType?: string }) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url, method, body })
    const r = resp({ url, method, body })
    const contentType = r.contentType ?? 'application/json'
    const payload = contentType.includes('json') ? JSON.stringify(r.body) : String(r.body)
    return Promise.resolve(new Response(payload, { status: r.status ?? 200, headers: { 'content-type': contentType } }))
  })
  return calls
}

beforeEach(() => {
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
})

// ── Pure normalizers (tolerant; snake_case canonical, camelCase accepted) ────────────

describe('training normalizers', () => {
  it('normLoraConfig fills defaults and reads target_modules / camelCase', () => {
    expect(normLoraConfig(undefined)).toEqual({ rank: DEFAULT_LORA.rank, alpha: DEFAULT_LORA.alpha, target_modules: [] })
    expect(normLoraConfig({ rank: 8, alpha: 16, target_modules: ['q_proj', 'v_proj'] })).toEqual({
      rank: 8,
      alpha: 16,
      target_modules: ['q_proj', 'v_proj'],
    })
    expect(normLoraConfig({ r: '4', lora_alpha: '8', targetModules: ['o_proj'] })).toEqual({
      rank: 4,
      alpha: 8,
      target_modules: ['o_proj'],
    })
  })

  it('normClientInfo tolerates missing fields and camelCase', () => {
    const info = normClientInfo({
      id: 'client_a1',
      base_model: 'HuggingFaceTB/SmolLM2-135M',
      status: 'ready',
      trainable_params: 442368,
      forward_backward_calls: 3,
      optim_steps: 2,
      last_loss: 1.234,
      lora_config: { rank: 16, alpha: 32, target_modules: [...LLAMA_TARGET_MODULES] },
    })
    expect(info.id).toBe('client_a1')
    expect(info.status).toBe('ready')
    expect(info.trainable_params).toBe(442368)
    expect(info.forward_backward_calls).toBe(3)
    expect(info.optim_steps).toBe(2)
    expect(info.last_loss).toBeCloseTo(1.234)
    expect(info.lora_config.target_modules).toHaveLength(7)

    // Missing counters default to 0; camelCase base model + status fall back honestly.
    const sparse = normClientInfo({ clientId: 'c2', baseModel: 'zen-nano', state: 'loading' })
    expect(sparse.id).toBe('c2')
    expect(sparse.base_model).toBe('zen-nano')
    expect(sparse.status).toBe('loading')
    expect(sparse.forward_backward_calls).toBe(0)
    expect(sparse.optim_steps).toBe(0)
    expect(sparse.last_loss).toBeUndefined()
  })

  it('normClientDetail reads loss_history (and lossHistory)', () => {
    expect(normClientDetail({ id: 'c', status: 'ready', loss_history: [2.1, 1.8, 1.5] }).loss_history).toEqual([2.1, 1.8, 1.5])
    expect(normClientDetail({ id: 'c', status: 'ready', lossHistory: ['3', '2'] }).loss_history).toEqual([3, 2])
    expect(normClientDetail({ id: 'c', status: 'ready' }).loss_history).toEqual([])
  })

  it('normForwardBackward keeps only finite numeric metrics', () => {
    const r = normForwardBackward({ loss: 1.5, num_tokens: 42, metrics: { grad_norm: 0.9, skip: 'nope', lr: 0.0001 } })
    expect(r.loss).toBeCloseTo(1.5)
    expect(r.num_tokens).toBe(42)
    expect(r.metrics).toEqual({ grad_norm: 0.9, lr: 0.0001 })
  })

  it('normSampleResult reads sequences / samples / completions with text fallback', () => {
    expect(normSampleResult({ sequences: [{ tokens: [1, 2], text: ' Paris' }] }).sequences).toEqual([{ tokens: [1, 2], text: ' Paris' }])
    expect(normSampleResult({ samples: [{ completion: ' 4' }] }).sequences).toEqual([{ tokens: [], text: ' 4' }])
    expect(normSampleResult({}).sequences).toEqual([])
  })
})

// ── Wire contract (URL + method + body) on the canonical API host ─────────────────────

describe('TrainingApi wire contract', () => {
  it('list() GETs /v1/training/clients and normalizes {clients}', async () => {
    const calls = stubFetch(() => ({ body: { clients: [{ id: 'c1', status: 'ready' }, { id: 'c2', status: 'loading' }] } }))
    const out = await TrainingApi.list()
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(API + '/v1/training/clients')
    expect(out.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('create() POSTs the base_model + full lora_config (7 llama targets by default)', async () => {
    const calls = stubFetch(() => ({ body: { id: 'c3', base_model: 'HuggingFaceTB/SmolLM2-135M', status: 'loading' } }))
    const out = await TrainingApi.create({ base_model: 'HuggingFaceTB/SmolLM2-135M' })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(API + '/v1/training/clients')
    expect(calls[0].body).toEqual({
      base_model: 'HuggingFaceTB/SmolLM2-135M',
      lora_config: { rank: DEFAULT_LORA.rank, alpha: DEFAULT_LORA.alpha, target_modules: [...LLAMA_TARGET_MODULES] },
    })
    expect((calls[0].body as { lora_config: { target_modules: string[] } }).lora_config.target_modules).toHaveLength(7)
    expect(out.status).toBe('loading')
  })

  it('create() honors an explicit rank/alpha', async () => {
    const calls = stubFetch(() => ({ body: { id: 'c', status: 'loading' } }))
    await TrainingApi.create({ base_model: 'm', rank: 8, alpha: 16 })
    expect(calls[0].body).toMatchObject({ lora_config: { rank: 8, alpha: 16 } })
  })

  it('get() GETs the per-client path with the id encoded', async () => {
    const calls = stubFetch(() => ({ body: { id: 'c1', status: 'ready', loss_history: [2, 1] } }))
    const out = await TrainingApi.get('c1')
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1')
    expect(out.loss_history).toEqual([2, 1])
  })

  it('remove() DELETEs the per-client path', async () => {
    const calls = stubFetch(() => ({ body: { id: 'c1', deleted: true } }))
    await TrainingApi.remove('c1')
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1')
  })

  it('forwardBackward() POSTs {data} and normalizes the result', async () => {
    const calls = stubFetch(() => ({ body: { loss: 1.42, num_tokens: 12, metrics: { grad_norm: 0.5 } } }))
    const out = await TrainingApi.forwardBackward('c1', [{ prompt: 'a', completion: 'b' }])
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1/forward_backward')
    expect(calls[0].body).toEqual({ data: [{ prompt: 'a', completion: 'b' }] })
    expect(out.loss).toBeCloseTo(1.42)
    expect(out.num_tokens).toBe(12)
  })

  it('optimStep() POSTs {adam_params} and returns the step count', async () => {
    const calls = stubFetch(() => ({ body: { optim_steps: 5 } }))
    const out = await TrainingApi.optimStep('c1', { lr: 1e-4 })
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1/optim_step')
    expect(calls[0].body).toEqual({ adam_params: { lr: 1e-4 } })
    expect(out.optim_steps).toBe(5)
  })

  it('sample() POSTs prompt + sampling_params and reads sequences', async () => {
    const calls = stubFetch(() => ({ body: { sequences: [{ tokens: [1], text: ' Paris' }] } }))
    const out = await TrainingApi.sample('c1', { prompt: 'The capital of France is', sampling_params: { max_tokens: 8, temperature: 0.7 }, num_samples: 1 })
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1/sample')
    expect(calls[0].body).toEqual({ prompt: 'The capital of France is', sampling_params: { max_tokens: 8, temperature: 0.7 }, num_samples: 1 })
    expect(out.sequences[0].text).toBe(' Paris')
  })

  it('saveWeights() POSTs {name} and returns {path, format}', async () => {
    const calls = stubFetch(() => ({ body: { path: '/adapters/a1', format: 'peft' } }))
    const out = await TrainingApi.saveWeights('c1', 'a1')
    expect(calls[0].url).toBe(API + '/v1/training/clients/c1/save_weights')
    expect(calls[0].body).toEqual({ name: 'a1' })
    expect(out).toEqual({ path: '/adapters/a1', format: 'peft' })
  })

  it('saveWeights() includes dir when given', async () => {
    const calls = stubFetch(() => ({ body: { path: '/x', format: 'peft' } }))
    await TrainingApi.saveWeights('c1', 'a1', '/checkpoints')
    expect(calls[0].body).toEqual({ name: 'a1', dir: '/checkpoints' })
  })

  // The engine answers 400/404/409 with a PLAIN-TEXT reason (streamed through the proxy
  // verbatim). It must surface as the ApiError message, not a generic HTTP code.
  it('surfaces a plain-text error body with its status', async () => {
    stubFetch(() => ({ status: 409, body: 'client is still loading', contentType: 'text/plain' }))
    await expect(TrainingApi.forwardBackward('c1', [{ prompt: 'a', completion: 'b' }])).rejects.toMatchObject({
      message: 'client is still loading',
      status: 409,
    })
    await expect(TrainingApi.forwardBackward('c1', [{ prompt: 'a', completion: 'b' }])).rejects.toBeInstanceOf(ApiError)
  })
})
