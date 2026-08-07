/**
 * Entitlements — the ONE place the console decides which products a customer org
 * has enabled (out-of-box each org assembles its own backend from the catalog).
 *
 * A normal customer's sidebar/palette show ONLY the products the org is
 * entitled to (the always-on essentials + whatever it has enabled/paid for); an
 * "Add product" flow enables more. A super admin bypasses this entirely (sees the
 * whole catalog — the gating is a customer concern).
 *
 * TRANSPORT (single change-point): the real endpoint is being built in parallel —
 *   GET  /v1/orgs/{org}/entitlements  → { enabled: string[] }   (product ids)
 *   POST /v1/orgs/{org}/entitlements  { add?: string[]; remove?: string[] }
 * routed through the console's hardened `/v1` user-bearer proxy (org resolved
 * server-side from the Bearer owner). Swapping the mock for the real backend is
 * this file alone. Until it lands the GET 404s and the caller treats the set as
 * `null` = UNGATED (show everything) — so there is zero regression pre-launch.
 *
 * The pure helpers (ALWAYS_ON_PRODUCTS, entitledSet, filterEntitled, nextEnabled)
 * carry no React/I/O and are unit-tested in isolation; `EntitlementsApi` is the
 * thin `/v1` client over them.
 */
import { restGet, restPost, cloudProxyV1Url } from './api/client'

/** The GET shape (product ids the org has enabled beyond the always-on set). */
export type Entitlements = { enabled: string[] }

/** The POST patch — add and/or remove product ids. */
export type EntitlementPatch = { add?: string[]; remove?: string[] }

/**
 * Product ids EVERY org gets out-of-box — never entitlement-gated. The org /
 * account management + money essentials without which the console is unusable
 * (you must always be able to see your home, pay, and manage your org). Everything
 * else is opt-in via "Add product". Kept deliberately tiny and orthogonal.
 */
export const ALWAYS_ON_PRODUCTS: readonly string[] = [
  'overview', // the home board
  'billing', // the Billing Center (money is never gated)
  'usage', // spend/usage visibility
  'settings', // org settings
  'team', // members
  'profile', // the signed-in user's own profile
  'api-keys', // credentials to call the API
  'platform', // the project HUB — create/deploy/ship a project (first-class, every org)
  // The deploy FRONT DOOR (apps, sites, domains, and the CD/CI/storage readings).
  // Always-on for the same reason 'platform' is: shipping your own code is not a
  // separate SKU, and it grants no backend reach — every head it reads was already
  // reachable, and cloud still enforces authz and the spend gate server-side. Gating
  // it would hide the primary section of platform.<brand> behind "Add product".
  'deploy',
  'tracker', // native @hanzo/gui issue tracker — first-class work surface, every org (peer of the HUB; replaces the retired Huly/hanzo.team)
  'guide', // the Business AI launch checklist — foundational onboarding, every org (like 'platform')
  'company', // self-service incorporation — the formation wizard, foundational for every org (peer of 'platform')
  'captable', // the org's capitalization ledger — foundational company surface, every org (peer of 'company')
]

/**
 * THE LAUNCH SET — what a new signup sees on console.hanzo.ai tonight.
 *
 * We are launching with hanzo.chat, hanzo.app and the console, so the console
 * shows exactly what those need and nothing else. Every other product in the
 * catalog (the whole cloud: compute, data, network, security, web3, the app
 * suite, the fleet admin) is BETA — present, routable, and invisible until an
 * org holds the beta flag. A superadmin always sees everything.
 *
 * This is an ALLOW-LIST on purpose: a new product added to the catalog is
 * hidden by DEFAULT and joins the launch only when someone names it here. The
 * inverse (a deny-list) leaks every future addition onto a customer's first
 * screen.
 *
 * The set: the AI plane the two products run on, the credential to call it,
 * the money surfaces, org/account management, and the beta door itself.
 */
export const LAUNCH_PRODUCTS: readonly string[] = [
  // the console itself
  'overview', // the home board
  'beta-features', // the door to everything else — never behind its own flag
  // the AI plane hanzo.chat + hanzo.app run on
  'chat', // hanzo.chat
  'models', // the model catalog
  'playground', // try a model
  'api-keys', // the credential both products call with
  'usage', // what the AI cost
  'logs', // the request log for those calls
  // money
  'billing',
  'plans',
  // org + account
  'settings',
  'team',
  'profile',
]

/** True when a product is part of tonight's launch surface. */
export const isLaunchProduct = (id: string): boolean => LAUNCH_PRODUCTS.includes(id)

/** True when a product is always-on (implicit, never stored in `enabled`). */
export const isAlwaysOn = (id: string): boolean => ALWAYS_ON_PRODUCTS.includes(id)

/**
 * The full set of product ids a customer may SEE, or `null` when ungated. `null`
 * `enabled` (the endpoint hasn't landed / hasn't loaded) → `null` = show
 * everything (no regression). Otherwise the always-on essentials ∪ the enabled ids.
 */
export function entitledSet(enabled: string[] | null | undefined): Set<string> | null {
  if (enabled == null) return null
  return new Set<string>([...ALWAYS_ON_PRODUCTS, ...enabled])
}

/**
 * Keep only the entries a viewer may see. A super admin sees EVERYTHING
 * (`showAdmin`); an ungated set (`null`) shows everything (endpoint not landed);
 * otherwise keep the always-on + enabled ids. Pure, generic over `{ id }` so the
 * catalog and command palette all gate through this ONE predicate.
 */
export function filterEntitled<T extends { id: string }>(
  entries: readonly T[],
  enabled: string[] | null | undefined,
  showAdmin: boolean,
): T[] {
  if (showAdmin) return [...entries]
  const set = entitledSet(enabled)
  if (!set) return [...entries]
  return entries.filter((e) => set.has(e.id))
}

/**
 * The next `enabled` list after applying a patch — deduped, sorted, and with the
 * always-on ids stripped (they are implicit, never persisted). Mirrors the POST
 * semantics so the UI can optimistically preview a change with the same result the
 * backend would compute. Remove wins over add for the same id in one patch.
 */
/**
 * Keep only the entries a viewer's BETA standing admits. Pure and generic like
 * `filterEntitled`, and the same one-predicate rule: a superadmin sees
 * everything, a beta org sees everything, everyone else loses `beta: true`
 * entries. Fails CLOSED — callers that have not asked the enablement plane
 * pass `showBeta: false` and beta surfaces stay hidden.
 */
export function filterBeta<T extends { id: string; beta?: boolean }>(
  entries: readonly T[],
  showBeta: boolean,
  showAdmin: boolean,
): T[] {
  if (showAdmin || showBeta) return [...entries]
  // Beta is the COMPLEMENT of the launch set: outside it, or stamped.
  return entries.filter((e) => isLaunchProduct(e.id) && e.beta !== true)
}

export function nextEnabled(current: readonly string[], patch: EntitlementPatch): string[] {
  const set = new Set<string>(current)
  for (const id of patch.add ?? []) if (id) set.add(id)
  for (const id of patch.remove ?? []) set.delete(id)
  return [...set].filter((id) => !isAlwaysOn(id)).sort()
}

/** Defensive normalizer — an honest, deduped `{ enabled: string[] }` from any shape. */
function normalize(raw: unknown): Entitlements {
  const arr =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as { enabled?: unknown }).enabled
      : Array.isArray(raw)
        ? raw
        : undefined
  const enabled = Array.isArray(arr)
    ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []
  return { enabled: [...new Set(enabled)] }
}

const url = (org: string): string =>
  cloudProxyV1Url(`orgs/${encodeURIComponent(org)}/entitlements`)

/** The `/v1/orgs/{org}/entitlements` client (the ONE swap point for the real API). */
export const EntitlementsApi = {
  /** The org's enabled product ids. Throws `ApiError` (status 404) until the endpoint lands. */
  async get(org: string): Promise<Entitlements> {
    return normalize(await restGet<unknown>(url(org)))
  },
  /** Enable/disable products; returns the new enabled set. */
  async update(org: string, patch: EntitlementPatch): Promise<Entitlements> {
    return normalize(await restPost<unknown>(url(org), patch))
  },
}
