/**
 * Model families — the ONE vendor grouping the unified model browser renders: the
 * house-brand **Zen** first, then EVERY model vendor the api.hanzo.ai gateway serves.
 *
 * Data-driven, resolved through the ONE brand resolver (`~/components/ui/brand`), NOT
 * a second hand-rolled matcher list. `familyOf` runs a model's id (then its provider)
 * through `brandForModel`, so a gateway-served model — the DigitalOcean lane tags every
 * third-party model provider "do-ai" with NO per-vendor field — still resolves to its
 * TRUE vendor by id: `gpt-4o`/`o3`→OpenAI, `claude-opus-4-8`→Anthropic, `llama-3.3-70b`
 * →Meta, `deepseek-v3.2`→DeepSeek, `gemma-4-31b`→Google, `qwen3-coder`→Qwen, `glm-5`
 * →Zhipu, `kimi-k2`→Moonshot, `nemotron-3-ultra-550b`→NVIDIA, `minimax-m2.5`→MiniMax.
 * The house Zen records (`zen*`, provider "hanzo") collapse to the one Zen family.
 *
 * NEVER drops a model: a vendor the resolver doesn't know yet lands in an honest
 * catch-all ("Other models") rather than vanishing — the regression this fixes was
 * every `do-ai` model (OpenAI, Claude, …) silently dropped because its provider string
 * matched no curated family. Because the family, its header logo, and its brand hue all
 * come from the SAME resolver, grouping/colour/icon stay in lockstep (families ↔ brand).
 *
 * Only CURRENT-GEN CHAT models list: non-chat modalities (embedding · rerank · tts ·
 * asr/audio · image · video · guard/moderation) and sunset generations (zen4-*, qwen2-*)
 * are filtered out — the same set Hanzo Chat's picker shows.
 *
 * Pure + unit-tested — no IO, no host coupling. The view layer (ModelCatalogModule)
 * just renders `groupByFamily(catalog)`.
 */
import { modelId, modelType, modelDisplayName, type CatalogEntry } from './aicatalog'
import { brandForModel, brandLabel, type BrandKey } from '~/components/ui/brand'

/**
 * The default model every Hanzo surface preselects — the Models page pills, the
 * Chat surface, and the assistant. It is **Enso**, the house frontier family: a
 * caller who has not chosen gets Hanzo's own model, not a cheaper stand-in.
 *
 * `enso-flash` is the free rung of that family, so a trial or $5-welcome balance
 * still gets a 200 on the first message — the property the old Zen default was
 * picked for, kept, on the better family. A caller who wants the flagship's
 * judgement selects `enso`; one who wants the panel selects `enso-ultra`.
 *
 * The Playground's `defaultModelId` independently resolves the same non-premium
 * flagship from the live catalog, so every surface agrees on one default.
 */
export const DEFAULT_MODEL = 'enso-flash'

/** One vendor family: a stable id (the canonical brand key), its vendor label, and
 *  the brand key `ProviderLogo` resolves to a mark + hue. */
export type Family = {
  /** Stable family key — the canonical brand key (`zen`, `openai`, `anthropic`, …). */
  id: string
  /** Vendor display label (`brandLabel`) — the real vendor name; "Zen" for the house. */
  label: string
  /** Brand key `ProviderLogo` resolves to the family's mark + hue. */
  logo: string
}

const has = (s: string, ...subs: string[]): boolean => subs.some((x) => s.includes(x))

/**
 * The KNOWN vendor families in DISPLAY ORDER — the house brand **Zen** first, then
 * every gateway vendor that carries a curated mark (`brand-marks.ts`). One brand key
 * per family, so the family, its header logo, and its hue all resolve from the ONE
 * brand resolver (`familyOf` handles any OTHER resolvable vendor + the catch-all).
 */
const FAMILY_BRANDS: BrandKey[] = [
  // Contract order (hanzo.chat): the house brands first (Enso, then legacy Zen), then
  // the two flagship proprietary vendors (Anthropic, OpenAI), then every other vendor
  // ALPHABETICAL by label. `familyRank` enforces this at grouping time; this registry
  // mirrors it for the family marks/labels.
  'enso', 'zen', 'anthropic', 'openai',
  'deepseek', 'google', 'meta', 'minimax', 'mistral', 'moonshot', 'nvidia', 'qwen', 'xai', 'zhipu',
]

export const FAMILIES: Family[] = FAMILY_BRANDS.map((key) => ({ id: key, label: brandLabel(key), logo: key }))

/** The honest catch-all for a vendor the brand resolver doesn't recognize yet — its
 *  models still list (grouped + labelled "Other models") rather than vanishing. */
const OTHER_FAMILY: Family = { id: 'other', label: 'Other models', logo: 'other' }

/**
 * The family a model belongs to — resolved through the ONE brand resolver
 * (`brandForModel` tries the model id FIRST, then the provider). The house brands
 * (`zen*`, provider "hanzo") collapse to the one Zen family; a recognized third-party
 * vendor gets its own family; an unrecognized vendor → the honest catch-all. NEVER
 * null — a chat model is never dropped for want of a curated family. PURE.
 */
export function familyOf(m: CatalogEntry): Family {
  const brand = brandForModel(modelId(m), (m.provider ?? '').trim())
  if (!brand) return OTHER_FAMILY
  const id = brand === 'hanzo' ? 'zen' : brand
  return { id, label: brandLabel(brand), logo: id }
}

/**
 * True for a chat-capable model — Text or Vision (VL/omni). Non-chat modalities
 * (embedding · rerank · audio/tts/asr · image) and guard/moderation models are
 * excluded, so the browser lists only models you can actually chat/agent with.
 * PURE.
 */
export function isChatModel(m: CatalogEntry): boolean {
  const id = modelId(m).toLowerCase()
  // Meta-routers (`router:general`, …) are a ROUTING policy, not a model you pick —
  // they belong in the Routing tab, and carry no display name (would render blank).
  if (/^router[:\-]/.test(id)) return false
  const kind = modelType(m) // Text | Vision | Image | Audio | Embedding | Rerank | Agent
  if (kind !== 'Text' && kind !== 'Vision') return false
  const hay = `${id} ${(m.name ?? '').toLowerCase()}`
  return !has(hay, 'guard', 'moderation', 'safeguard')
}

/** The always-non-empty display label for a model row: name, else the raw id. PURE. */
export function displayLabel(m: CatalogEntry): string {
  return modelDisplayName(m) || modelId(m)
}

/**
 * True for a CURRENT-GEN model — sunset generations are dropped: Zen 4 (garbage
 * output, superseded by zen5/zen3) and Qwen 2 (house rule: qwen3+ only). PURE.
 */
export function isCurrentGen(m: CatalogEntry): boolean {
  const id = modelId(m).toLowerCase()
  if (/(^|[\/-])zen4/.test(id)) return false
  if (/qwen-?2(\.|-|$)/.test(id)) return false
  return true
}

/** True for a duplicate free-tier alias (`…:free`) — collapsed to its priced twin. */
export function isFreeAlias(m: CatalogEntry): boolean {
  return modelId(m).toLowerCase().endsWith(':free')
}

/** A family with its resolved, sorted member models (for the browser sections). */
export type FamilyGroup = {
  id: string
  label: string
  logo: string
  models: CatalogEntry[]
  /** How many of the family's models are servable right now (live). */
  available: number
}

/** Available-first, then the house default (`DEFAULT_MODEL`) up top, then name asc. PURE. */
function sortMembers(models: CatalogEntry[]): CatalogEntry[] {
  return [...models].sort((a, b) => {
    const av = Number(b.available) - Number(a.available)
    if (av) return av
    const da = modelId(a).toLowerCase() === DEFAULT_MODEL ? -1 : 0
    const db = modelId(b).toLowerCase() === DEFAULT_MODEL ? -1 : 0
    if (da !== db) return da - db
    return (a.name ?? modelId(a)).localeCompare(b.name ?? modelId(b))
  })
}

/** The families pinned to the TOP of every picker, in order: the house brands (Enso,
 *  then legacy Zen) then the two flagship proprietary vendors. This is the hanzo.chat
 *  family order, shared by the model selector AND the Models browser — ONE ordering. */
const PINNED_FAMILIES = ['enso', 'zen', 'anthropic', 'openai'] as const

/** Family display rank: the pinned families in order, then every OTHER resolvable
 *  vendor at one shared rank (→ sorted ALPHABETICALLY by label by the caller's tiebreak),
 *  then the honest catch-all ("Other models") always last. */
function familyRank(id: string): number {
  const i = PINNED_FAMILIES.indexOf(id as (typeof PINNED_FAMILIES)[number])
  if (i >= 0) return i
  if (id === OTHER_FAMILY.id) return Number.MAX_SAFE_INTEGER
  return PINNED_FAMILIES.length
}

/** Options for `groupModelsByFamily`. */
export type GroupModelsOptions = {
  /**
   * Chat-only — keep just current-gen text/vision models (the hanzo.chat picker set).
   * Default `true`. When `false`, EVERY modality is grouped (image/video/audio/
   * embedding) for a modality-specific picker — still current-gen and de-aliased.
   */
  chatOnly?: boolean
}

/**
 * Group the catalog into vendor families — the pinned families first (Enso, Zen,
 * Anthropic, OpenAI) then every other vendor alphabetically — NEVER dropping a model
 * for want of a curated family (an unrecognized vendor lands in the honest catch-all).
 * `chatOnly` (default) keeps only current-gen chat models; set it false for a
 * modality-specific picker. PURE — the ONE place the app's family grouping is decided.
 * This is the console-local twin of `@hanzo/ui/models` `groupModelsByFamily` (the
 * console runs @hanzo/gui, not the shadcn build, so the taxonomy lives here — see
 * `ModelSelector`).
 */
export function groupModelsByFamily(catalog: CatalogEntry[], opts: GroupModelsOptions = {}): FamilyGroup[] {
  const chatOnly = opts.chatOnly ?? true
  const buckets = new Map<string, { family: Family; models: CatalogEntry[] }>()
  for (const m of catalog) {
    if (chatOnly && !isChatModel(m)) continue
    if (!isCurrentGen(m) || isFreeAlias(m)) continue
    const family = familyOf(m)
    const b = buckets.get(family.id)
    if (b) b.models.push(m)
    else buckets.set(family.id, { family, models: [m] })
  }
  return [...buckets.values()]
    .sort((a, b) => familyRank(a.family.id) - familyRank(b.family.id) || a.family.label.localeCompare(b.family.label))
    .map(({ family, models }) => {
      const sorted = sortMembers(models)
      return { id: family.id, label: family.label, logo: family.logo, models: sorted, available: sorted.filter((mm) => mm.available).length }
    })
}

/** Chat-only family grouping — the hanzo.chat picker set (the historical name, kept as
 *  the DRY default over `groupModelsByFamily`). PURE. */
export function groupByFamily(catalog: CatalogEntry[]): FamilyGroup[] {
  return groupModelsByFamily(catalog, { chatOnly: true })
}

/**
 * The catalog's suggested models — one live model per pinned family, in the
 * pinned order (the house default naturally leads: `sortMembers` puts it at the
 * top of the Enso family). `exclude` drops models the caller already shows
 * elsewhere (the user's own Recent trail), compared case-insensitively. Only
 * genuinely servable models are ever suggested. PURE.
 */
export function suggestedModels(groups: FamilyGroup[], exclude: readonly string[] = []): CatalogEntry[] {
  const skip = new Set(exclude.map((s) => s.toLowerCase()))
  const out: CatalogEntry[] = []
  for (const g of groups) {
    if (!(PINNED_FAMILIES as readonly string[]).includes(g.id)) continue
    const m = g.models.find((x) => x.available && !skip.has(modelId(x).toLowerCase()))
    if (m) out.push(m)
  }
  return out
}

/** Filter grouped families by a query (name/id/provider), dropping empty families. PURE. */
export function filterFamilies(groups: FamilyGroup[], q: string): FamilyGroup[] {
  const t = q.trim().toLowerCase()
  if (!t) return groups
  const out: FamilyGroup[] = []
  for (const g of groups) {
    const models = g.models.filter((m) => {
      const hay = `${modelId(m)} ${m.name ?? ''} ${m.provider ?? ''} ${g.label}`.toLowerCase()
      return hay.includes(t)
    })
    if (models.length) out.push({ ...g, models, available: models.filter((m) => m.available).length })
  }
  return out
}

/** Total models across families (the browser's "N models" header). PURE. */
export function totalModels(groups: FamilyGroup[]): number {
  return groups.reduce((n, g) => n + g.models.length, 0)
}
