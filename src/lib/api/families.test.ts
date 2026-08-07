import { describe, it, expect } from 'vitest'

import {
  FAMILIES,
  familyOf,
  isChatModel,
  isCurrentGen,
  isFreeAlias,
  groupByFamily,
  groupModelsByFamily,
  filterFamilies,
  suggestedModels,
  totalModels,
  displayLabel,
  DEFAULT_MODEL,
} from './families'
import type { CatalogEntry } from './aicatalog'
import { normalizeBrand, brandLabel, BRANDS } from '~/components/ui/brand'
import { BRAND_MARK } from '~/components/ui/brand-marks'

/**
 * The family taxonomy groups every model the gateway serves by its TRUE vendor — Zen
 * (house) first, then each third-party vendor — resolved through the ONE brand
 * resolver. Crucially it never DROPS a model: the DigitalOcean lane tags every
 * third-party model provider "do-ai" with `name: null` (so the merge sets name ← id),
 * and each must still resolve to its real vendor by id — the regression these fixtures
 * guard against was every `do-ai` model (OpenAI, Claude, …) silently vanishing.
 */
const m = (o: Partial<CatalogEntry>): CatalogEntry => ({ name: '', available: false, ...o }) as CatalogEntry

// House Zen (provider "hanzo" or a zen* id), current + sunset + non-chat modalities.
const zen5mini = m({ name: 'zen5-mini', available: true })
const zen5flash = m({ name: 'zen5-flash', available: true })
const zen3vl = m({ name: 'zen3-vl', available: true })
const zen3omni = m({ name: 'zen3-omni', available: true })
const zen4 = m({ name: 'zen4', available: false }) // sunset
const zen4mini = m({ name: 'zen4-mini', available: false }) // sunset
const zen3embed = m({ name: 'zen3-embedding', available: true }) // non-chat
const zen3guard = m({ name: 'zen3-guard', available: true }) // guard
const zen3image = m({ name: 'zen3-image', available: true }) // image
const zen3video = m({ name: 'zen3-video', available: true }) // video

// DigitalOcean lane (owned_by/provider "do-ai", name ← id on merge). Real live ids.
const doai = (id: string, available = true): CatalogEntry => m({ id, name: id, provider: 'do-ai', available })
const gpt4o = doai('gpt-4o')
const gpt5 = doai('gpt-5')
const o3 = doai('o3')
const gptoss = doai('gpt-oss-120b')
const claude = doai('claude-opus-4-8')
const claudeHaiku = doai('claude-3-5-haiku')
const deepseek = doai('deepseek-v3.2')
const llama = doai('llama-3.3-70b')
const gemma = doai('gemma-4-31b')
const qwen = doai('qwen3-coder')
const mistral = doai('mistral-small')
const glm = doai('glm-5')
const kimi = doai('kimi-k2.6')
const nemotron = doai('nemotron-3-ultra-550b')
const minimax = doai('minimax-m2.5')
const bge = doai('bge-m3') // embedding (no "embed" in id) — must be filtered
const wan = doai('wan2-2-t2v-a14b') // video — must be filtered
const router = doai('router:general') // routing policy — must be filtered
const mimo = doai('mimo-v2.5') // vendor the resolver doesn't know → catch-all, NOT dropped

describe('familyOf — every gateway vendor resolves by id, nothing dropped', () => {
  it('collapses the house Zen records (id or provider) to the one Zen family', () => {
    expect(familyOf(zen5mini).id).toBe('zen')
    expect(familyOf(zen3omni).id).toBe('zen')
    expect(familyOf(zen4).id).toBe('zen')
    expect(familyOf(m({ id: 'zen5', name: 'zen5', provider: 'hanzo', available: true })).id).toBe('zen')
  })

  it('resolves each do-ai third-party model to its TRUE vendor by id', () => {
    expect(familyOf(gpt4o).id).toBe('openai')
    expect(familyOf(gpt5).id).toBe('openai')
    expect(familyOf(o3).id).toBe('openai')
    expect(familyOf(gptoss).id).toBe('openai')
    expect(familyOf(claude).id).toBe('anthropic')
    expect(familyOf(deepseek).id).toBe('deepseek')
    expect(familyOf(llama).id).toBe('meta')
    expect(familyOf(gemma).id).toBe('google')
    expect(familyOf(qwen).id).toBe('qwen')
    expect(familyOf(mistral).id).toBe('mistral')
    expect(familyOf(glm).id).toBe('zhipu')
    expect(familyOf(kimi).id).toBe('moonshot')
    expect(familyOf(nemotron).id).toBe('nvidia')
    expect(familyOf(minimax).id).toBe('minimax')
  })

  it('labels the resolved family with the real vendor name', () => {
    expect(familyOf(gpt4o).label).toBe('OpenAI')
    expect(familyOf(claude).label).toBe('Anthropic')
    expect(familyOf(zen5mini).label).toBe('Zen')
  })

  it('routes an UNRECOGNIZED vendor to the honest catch-all — never null, never dropped', () => {
    const fam = familyOf(mimo)
    expect(fam.id).toBe('other')
    expect(fam.label).toBe('Other models')
  })
})

describe('filters — current-gen chat only', () => {
  it('drops non-chat modalities and guards (incl. the bare-id do-ai embedding/video)', () => {
    expect(isChatModel(zen5mini)).toBe(true)
    expect(isChatModel(zen3vl)).toBe(true)
    expect(isChatModel(gpt4o)).toBe(true)
    expect(isChatModel(claude)).toBe(true)
    expect(isChatModel(zen3embed)).toBe(false)
    expect(isChatModel(zen3image)).toBe(false)
    expect(isChatModel(zen3video)).toBe(false)
    expect(isChatModel(zen3guard)).toBe(false)
    expect(isChatModel(bge)).toBe(false)
    expect(isChatModel(wan)).toBe(false)
    expect(isChatModel(router)).toBe(false)
  })
  it('drops sunset generations (zen4, qwen2)', () => {
    expect(isCurrentGen(zen4)).toBe(false)
    expect(isCurrentGen(zen4mini)).toBe(false)
    expect(isCurrentGen(m({ id: 'qwen/qwen-2.5-72b', name: 'Qwen 2.5', provider: 'Qwen' }))).toBe(false)
    expect(isCurrentGen(zen5mini)).toBe(true)
    expect(isCurrentGen(qwen)).toBe(true)
  })
  it('flags free-tier duplicate aliases', () => {
    expect(isFreeAlias(m({ id: 'google/gemma-3-27b-it:free', name: 'Gemma free' }))).toBe(true)
    expect(isFreeAlias(gemma)).toBe(false)
  })
})

describe('displayLabel — never blank', () => {
  it('falls back to the id when the model has no display name', () => {
    expect(displayLabel(m({ id: 'zen5-flash', name: '', available: true }))).toBe('zen5-flash')
    expect(displayLabel(zen5mini)).toBe('zen5-mini')
    expect(displayLabel(gpt4o)).toBe('gpt-4o')
  })
})

describe('groupByFamily — Zen first, do-ai vendors surfaced, nothing dropped', () => {
  const catalog = [
    zen4, zen4mini, zen3guard, zen3image, zen3embed, zen3video, // all filtered out (modality/sunset)
    bge, wan, router, // filtered out (embedding/video/router)
    zen5flash, zen5mini, zen3vl, zen3omni,
    gpt4o, gpt5, o3, gptoss, claude, claudeHaiku, deepseek, llama, gemma, qwen, mistral, glm, kimi, nemotron, minimax,
    mimo, // unrecognized → catch-all
  ]
  const groups = groupByFamily(catalog)

  it('orders Zen first, then the resolved vendors, catch-all last', () => {
    expect(groups[0].id).toBe('zen')
    expect(groups[groups.length - 1].id).toBe('other')
    // OpenAI + Anthropic come before the catch-all.
    const ids = groups.map((g) => g.id)
    expect(ids).toContain('openai')
    expect(ids).toContain('anthropic')
    expect(ids.indexOf('openai')).toBeLessThan(ids.indexOf('other'))
  })

  it('surfaces the OpenAI + Claude do-ai models (the regression fix)', () => {
    const openai = groups.find((g) => g.id === 'openai')!
    expect(openai.models.map((x) => x.id).sort()).toEqual(['gpt-4o', 'gpt-5', 'gpt-oss-120b', 'o3'])
    const anthropic = groups.find((g) => g.id === 'anthropic')!
    expect(anthropic.models.map((x) => x.id).sort()).toEqual(['claude-3-5-haiku', 'claude-opus-4-8'])
  })

  it('keeps the unrecognized vendor as a catch-all row, never dropped', () => {
    const other = groups.find((g) => g.id === 'other')!
    expect(other.models.map((x) => x.id)).toEqual(['mimo-v2.5'])
  })

  it('excludes zen4/guard/image/embedding/video from Zen', () => {
    const names = groups.find((g) => g.id === 'zen')!.models.map((x) => x.name)
    expect(names).not.toContain('zen4')
    expect(names).not.toContain('zen3-guard')
    expect(names).not.toContain('zen3-image')
    expect(names).not.toContain('zen3-video')
    expect(names).toContain('zen5-mini')
    expect(names).toContain('zen3-vl')
  })

  it("defaults to the house family's free rung, and sorts it first in its own family", () => {
    // Enso is the house frontier family and its free rung is what an unchosen
    // caller gets — so a trial balance still answers on the first message.
    expect(DEFAULT_MODEL).toBe('enso-flash')
    const ensoFlash = m({ name: 'enso-flash', available: true })
    const ensoUltra = m({ name: 'enso-ultra', available: true })
    const enso = groupByFamily([ensoUltra, ensoFlash]).find((g) => g.id === 'enso')!
    expect(enso.models[0].name).toBe(DEFAULT_MODEL)
  })

  it('counts totals correctly', () => {
    expect(totalModels(groups)).toBe(groups.reduce((n, g) => n + g.models.length, 0))
  })
})

describe('filterFamilies — search across families', () => {
  const groups = groupByFamily([zen5mini, zen3vl, gpt4o, claude, llama])
  it('keeps only families with a matching model (by id)', () => {
    expect(filterFamilies(groups, 'gpt-4o').map((g) => g.id)).toEqual(['openai'])
  })
  it('matches on family label too', () => {
    expect(filterFamilies(groups, 'anthropic').map((g) => g.id)).toEqual(['anthropic'])
  })
  it('empty query returns all', () => {
    expect(filterFamilies(groups, '  ').length).toBe(groups.length)
  })
})

describe('FAMILIES registry — house first, contract order, every family mark-backed', () => {
  it('lists the house brands (Enso, Zen) + Anthropic, OpenAI first, then vendors alphabetical', () => {
    expect(FAMILIES[0].id).toBe('enso')
    expect(FAMILIES[0].label).toBe('Enso')
    expect(FAMILIES.map((f) => f.id)).toEqual([
      'enso', 'zen', 'anthropic', 'openai',
      'deepseek', 'google', 'meta', 'minimax', 'mistral', 'moonshot', 'nvidia', 'qwen', 'xai', 'zhipu',
    ])
  })
  it('labels each family with the canonical vendor name', () => {
    for (const f of FAMILIES) expect(f.label).toBe(brandLabel(f.id as never))
  })
})

/**
 * The families ↔ brand contract — the permanent guard against the "provider icon
 * blank/default" bug. Every family header + row renders `<ProviderLogo provider={
 * family.logo}>`, resolved through the ONE brand resolver (`normalizeBrand` → `BRANDS`
 * + `BRAND_MARK`); a family whose `logo` doesn't resolve falls to the neutral chip. So
 * EVERY declared family's `logo` MUST resolve to a real treatment — the first-party
 * Hanzo block-H (zen/hanzo) or a third-party `BRANDS` hue WITH its own distinct
 * `BRAND_MARK` glyph. The catch-all ("other") is intentionally NOT a declared family —
 * it renders the neutral chip and is excluded here.
 */
describe('families ↔ brand — every family renders a real colour + distinct icon (never blank)', () => {
  const HEX = /^#[0-9a-fA-F]{6}$/

  it('every declared family logo resolves through the ONE brand resolver', () => {
    for (const f of FAMILIES) {
      expect(normalizeBrand(f.logo), `family "${f.id}" logo "${f.logo}" must resolve`).not.toBeNull()
    }
  })

  it('every third-party family has a real hex colour + a distinct curated mark', () => {
    const bodies = new Set<string>()
    for (const f of FAMILIES) {
      const key = normalizeBrand(f.logo)
      if (key === null || key === 'zen' || key === 'hanzo' || key === 'enso') continue // first-party SVG mark
      expect(BRANDS[key].bg, `BRANDS[${key}].bg`).toMatch(HEX)
      const mark = BRAND_MARK[key]
      expect(mark, `family "${f.id}" (brand ${key}) must have a curated mark`).toBeDefined()
      expect(bodies.has(mark!.body), `family "${f.id}" mark must be unique`).toBe(false)
      bodies.add(mark!.body)
    }
  })

  // The live do-ai vendors, end-to-end: real live id → true vendor family → brand.
  it.each([
    ['gpt-4o', 'openai', '#000000'],
    ['claude-opus-4-8', 'anthropic', '#D97757'],
    ['deepseek-v3.2', 'deepseek', '#4D6BFE'],
    ['llama-3.3-70b', 'meta', '#0866FF'],
    ['glm-5', 'zhipu', '#3859FF'],
    ['kimi-k2.6', 'moonshot', '#16171B'],
    ['minimax-m2.5', 'minimax', '#E1483B'],
  ] as const)('a live do-ai "%s" model groups into "%s" and renders its brand colour', (id, brandKey, hex) => {
    const fam = familyOf(doai(id))
    expect(fam.id).toBe(brandKey)
    const key = normalizeBrand(fam.logo)
    expect(key).toBe(brandKey)
    if (key === null || key === 'zen' || key === 'hanzo' || key === 'enso') throw new Error('unreachable')
    expect(BRANDS[key].bg).toBe(hex)
  })
})

/**
 * Enso is the current house model line — its OWN family, rendered with the house
 * (Hanzo) mark, pinned FIRST (before legacy Zen). The contract order the unified
 * ModelSelector replicates is: Enso, Zen, Anthropic, OpenAI, then vendors alphabetical.
 */
describe('house brands + contract family order', () => {
  const enso = m({ name: 'enso', available: true })
  const ensoMini = m({ id: 'enso-mini', name: 'Enso Mini', provider: 'hanzo', available: true })

  it('resolves an enso model to its own house family (label Enso, house logo)', () => {
    expect(familyOf(enso).id).toBe('enso')
    expect(familyOf(enso).label).toBe('Enso')
    expect(familyOf(ensoMini).id).toBe('enso')
    // The Enso family renders the house (Hanzo) mark, not a third-party hue — its logo
    // resolves to the first-party brand, exactly like Zen.
    expect(normalizeBrand(familyOf(enso).logo)).toBe('enso')
  })

  it('orders Enso, Zen, Anthropic, OpenAI first, then vendors alphabetically', () => {
    const groups = groupByFamily([enso, zen5flash, gpt4o, claude, deepseek, gemma])
    expect(groups.map((g) => g.id)).toEqual(['enso', 'zen', 'anthropic', 'openai', 'deepseek', 'google'])
  })
})

describe('groupModelsByFamily — chatOnly toggles modality filtering', () => {
  it('chatOnly:false groups non-chat modalities under their family (image/video kept)', () => {
    const groups = groupModelsByFamily([zen5flash, zen3image, zen3video, zen3embed], { chatOnly: false })
    const zen = groups.find((g) => g.id === 'zen')!
    const names = zen.models.map((x) => x.name)
    expect(names).toContain('zen3-image')
    expect(names).toContain('zen3-video')
    expect(names).toContain('zen3-embedding')
  })
  it('chatOnly (default) still drops non-chat modalities', () => {
    const groups = groupModelsByFamily([zen5flash, zen3image], { chatOnly: true })
    expect(groups.find((g) => g.id === 'zen')!.models.map((x) => x.name)).not.toContain('zen3-image')
  })
})

describe('suggestedModels — one live model per pinned family, house default first', () => {
  const ensoFlash = m({ name: 'enso-flash', available: true })
  const ensoUltra = m({ name: 'enso-ultra', available: true })
  const catalog = [ensoUltra, ensoFlash, zen5flash, gpt4o, claude, deepseek]

  it('suggests the pinned families in order, led by the default model', () => {
    const s = suggestedModels(groupByFamily(catalog))
    expect(s.map((x) => x.name)).toEqual([DEFAULT_MODEL, 'zen5-flash', 'claude-opus-4-8', 'gpt-4o'])
  })

  it('never suggests an unavailable model', () => {
    const down = m({ name: 'enso-flash', available: false })
    const s = suggestedModels(groupByFamily([down, ensoUltra]))
    expect(s.map((x) => x.name)).toEqual(['enso-ultra'])
  })

  it('excludes case-insensitively and falls through to the family next rung', () => {
    const s = suggestedModels(groupByFamily(catalog), ['Enso-Flash'])
    expect(s.map((x) => x.name)).toEqual(['enso-ultra', 'zen5-flash', 'claude-opus-4-8', 'gpt-4o'])
  })

  it('an unpinned vendor is never suggested', () => {
    const s = suggestedModels(groupByFamily([deepseek]))
    expect(s).toEqual([])
  })
})
