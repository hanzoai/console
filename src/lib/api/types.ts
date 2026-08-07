/**
 * Types for the unified Hanzo Cloud `/v1` backend resources.
 *
 * These mirror the Go models served by `hanzoai/cloud`. Fields are kept to the
 * surface the console reads/writes; the backend tolerates extra/missing keys, so
 * we model the meaningful ones and allow passthrough for the rest.
 */

/** Common ownership/identity fields on every casibase object. */
export type Owned = {
  owner: string
  name: string
  createdTime?: string
  displayName?: string
}

/** A model or storage provider (`/v1/*-provider`). */
export type Provider = Owned & {
  category: 'Model' | 'Storage' | 'Embedding' | 'Blockchain' | (string & {})
  type: string
  subType?: string
  clientId?: string
  clientSecret?: string
  apiKey?: string
  apiVersion?: string
  region?: string
  providerUrl?: string
  compatibleProvider?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  enableThinking?: boolean
  inputPricePerThousandTokens?: number
  outputPricePerThousandTokens?: number
  currency?: string
  state?: 'Active' | 'Inactive' | (string & {})
  isDefault?: boolean
  isRemote?: boolean
  // Passthrough for fields the editor doesn't surface but the backend round-trips.
  [key: string]: unknown
}

/**
 * A model route (`/v1/*-model-route`).
 *
 * Keyed by `owner`/`modelName` (NOT `owner/name` — the backend uses modelName as
 * the identity). Maps a user-facing model name to a primary provider + upstream
 * model id, with two fallbacks, pricing overrides, and visibility flags.
 */
export type ModelRoute = Owned & {
  modelName?: string
  provider?: string
  upstream?: string
  ownedBy?: string
  fallback1Provider?: string
  fallback1Upstream?: string
  fallback2Provider?: string
  fallback2Upstream?: string
  premium?: boolean
  hidden?: boolean
  inputPricePerMillion?: number
  outputPricePerMillion?: number
  enabled?: boolean
  state?: string
  updatedTime?: string
  [key: string]: unknown
}

/**
 * A knowledge store (`/v1/*-store`).
 *
 * The RAG/chat surface config: storage + model + embedding providers, chunking
 * and search strategy, chat welcome copy, and limits. Keyed by `owner/name`.
 */
export type Store = Owned & {
  title?: string
  storageProvider?: string
  storageSubpath?: string
  imageProvider?: string
  splitProvider?: string
  searchProvider?: string
  modelProvider?: string
  embeddingProvider?: string
  agentProvider?: string
  textToSpeechProvider?: string
  speechToTextProvider?: string
  memoryLimit?: number
  frequency?: number
  limitMinutes?: number
  knowledgeCount?: number
  suggestionCount?: number
  welcome?: string
  welcomeTitle?: string
  welcomeText?: string
  prompt?: string
  themeColor?: string
  state?: string
  isDefault?: boolean
  [key: string]: unknown
}

/** A chat session (`/v1/*-chat`). Keyed by `owner/name`. */
export type Chat = Owned & {
  type?: string
  user?: string
  store?: string
  category?: string
  messageCount?: number
  tokenCount?: number
  updatedTime?: string
  [key: string]: unknown
}

/**
 * A chat message (`/v1/ai/messages`).
 *
 * `author` is "AI" for assistant turns, otherwise the user. `text` is the
 * content; `reasonText` carries any reasoning trace.
 */
export type Message = Owned & {
  chat?: string
  author?: string
  text?: string
  reasonText?: string
  replyTo?: string
  [key: string]: unknown
}

/** The signed-in account (`/v1/iam/get-account`). */
export type Account = {
  owner: string
  name: string
  /**
   * The Hanzo IAM user id — the OIDC `sub` claim, a UUID. This is the ONE
   * identifier for this user across every Hanzo property: hanzo.ai and
   * hanzo.chat know them by the same value.
   *
   * `owner`/`name` are the org and the login handle, and their pair (`hanzo/z`)
   * is an org-relative REFERENCE, not a user id — it changes if either part is
   * renamed, and it says nothing about the same user on another surface. Use
   * this for anything that must join across properties; use owner/name for
   * display and for org-scoped API paths.
   */
  userId?: string
  /** casibase user type; "anonymous-user" means no real sign-in. */
  type?: string
  displayName?: string
  email?: string
  avatar?: string
  organization?: string
  isAdmin?: boolean
  accessToken?: string
  /** Arbitrary per-user key/value store on the IAM account. NOT where user
   * customizations live — those are the preference document (`AccountApi.preferences`),
   * which is read live rather than recovered from a snapshot in these claims. */
  properties?: Record<string, string>
  [key: string]: unknown
}

/** Standard list query parameters shared by every paged endpoint. */
export type ListParams = {
  owner?: string
  page?: number
  pageSize?: number
  field?: string
  value?: string
  sortField?: string
  sortOrder?: string
}

/** Map ListParams to the backend's query keys (`p` not `page`). */
export const listQuery = (p: ListParams = {}): Record<string, string | number | undefined> => ({
  owner: p.owner,
  p: p.page,
  pageSize: p.pageSize,
  field: p.field,
  value: p.value,
  sortField: p.sortField,
  sortOrder: p.sortOrder,
})
