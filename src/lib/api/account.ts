/** Account/session API.
 *
 * Identity is @hanzo/iam ONLY. `session()` resolves the signed-in account from the
 * IAM SDK: it reads the (auto-refreshed) access token and projects the OIDC userinfo
 * claims into the console's `Account` shape. There is NO casibase cookie / BFF
 * code-exchange / durable-console-session path any more — the IAM PKCE token is the
 * single credential (the API client carries it as a Bearer on every `/v1` call).
 */
import { ApiError, originV1Url, post, postForm, restGet, restPatch } from './client'
import {
  iamValidAccessToken,
  iamUserInfo,
  iamExpiresInSeconds,
  iamHasSession,
  iamSignOut,
} from '~/lib/auth/iam'
import { refreshSession } from '~/lib/auth/refresh'
import { config } from '~/config'
import { type Account } from './types'

/** Result of resolving the current session: the account + the IAM access-token
 *  lifetime (seconds) so the provider can arm its proactive refresh timer. */
export type SessionResult = { account: Account | null; expiresIn: number | null }

/**
 * The cross-surface per-user preference plane (cloud `apps/prefs`): GET reads the
 * caller's own document, PATCH merges keys into it, and both authenticate on the
 * Bearer the client already attaches.
 *
 * It replaces `ai/preferences`, which is the AI gateway's casibase handler and
 * authenticates on a casibase SESSION — no Bearer satisfies it, so every save from
 * this console was refused with "Please sign in first" while the user was signed in.
 * That endpoint also had no read at all, which is why preferences used to be recovered
 * from a snapshot of the identity token's claims; this one answers both halves.
 */
const PREFS_PATH = 'prefs'

/** The prefs plane's wire shape — the document plus when it was last written. */
type PrefsDocument = { prefs?: Record<string, unknown>; updatedAt?: number }

/** Project the IAM OIDC userinfo claims onto the console `Account` shape. */
function accountFromClaims(claims: Record<string, unknown>): Account | null {
  const str = (k: string): string | undefined => {
    const v = claims[k]
    return typeof v === 'string' && v ? v : undefined
  }
  // The deployed OIDC userinfo may omit `owner`, and `sub` is the user UUID (not
  // owner/name). Resolve owner: explicit claim -> sub-prefix (older owner/name
  // tokens) -> the console's configured IAM org. A valid session must NEVER
  // dead-end at account=null (that loops /signin).
  const sub = str('sub') ?? ''
  const owner =
    str('owner') ??
    str('organization') ??
    (sub.includes('/') ? sub.split('/')[0] : undefined) ??
    config.iamOrgName
  const name =
    str('name') ??
    str('preferred_username') ??
    str('email') ??
    (sub.includes('/') ? sub.split('/')[1] : sub)
  if (!owner || !name) return null
  const props = claims['properties']
  return {
    owner,
    name,
    // The IAM user id, carried through rather than discarded. It was already
    // decoded here and used only to BACK-DERIVE owner/name; the stable id itself
    // was dropped, so nothing downstream could identify this user as the same
    // one hanzo.ai and hanzo.chat see. Empty on a token that carries no `sub`,
    // and absent is left absent — never substituted with owner/name, which is a
    // different id space.
    userId: sub || undefined,
    type: str('type') ?? 'normal-user',
    displayName: str('displayName') ?? str('display_name'),
    email: str('email'),
    avatar: str('avatar') ?? str('picture'),
    organization: owner,
    isAdmin: claims['isAdmin'] === true || claims['is_admin'] === true,
    properties: props && typeof props === 'object' ? (props as Record<string, string>) : undefined,
  }
}

/** Decode a JWT payload's claims (base64url), or null if the token isn't a JWT. */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const c = JSON.parse(json)
    return c && typeof c === 'object' ? (c as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * The profile photo, which the access token does not carry and never will.
 *
 * Identity above is read from the token's own claims — self-contained, no round
 * trip, and immune to `getUserInfo()` answering null on a 200, which once
 * dead-ended the session into a /signin loop. That is the right source and this
 * does not move it. But IAM puts the avatar on `picture` in the USERINFO
 * response ONLY (`internal/oidc/userinfo.go`), deliberately: an avatar is a
 * bounded data URI, so carrying it would add kilobytes to every JWT on every
 * request for a value almost nothing reads. hanzoai/app's `lib/profile.ts`
 * states the same contract from the writing side.
 *
 * So the token is authoritative for WHO you are and silent about your picture,
 * and reading only the token meant `account.avatar` was undefined for every
 * user, forever — the account menu fell back to initials no matter what anyone
 * uploaded. One fetch fills exactly that gap.
 *
 * Best-effort and cached by design. A failure, a signed-out 401, or a user with
 * no photo all resolve to "no avatar" — never a broken session, because a
 * missing picture must not cost anyone their sign-in. The cache is keyed by
 * identity so switching accounts cannot show the previous face, and it holds
 * the miss too: a user with no photo should cost one request, not one per load.
 */
let avatarCache: { key: string; url: string | undefined } | null = null

async function withAvatar(account: Account): Promise<Account> {
  if (account.avatar) return account
  const key = `${account.owner}/${account.name}`
  if (avatarCache?.key !== key) {
    let url: string | undefined
    try {
      const info = await iamUserInfo()
      const pic = info?.['picture'] ?? info?.['avatar']
      if (typeof pic === 'string' && pic) url = pic
    } catch {
      /* no photo is not a session failure */
    }
    avatarCache = { key, url }
  }
  return avatarCache.url ? { ...account, avatar: avatarCache.url } : account
}

/** Drop the cached photo — sign-out, so the next account never inherits this face. */
function forgetAvatar(): void {
  avatarCache = null
}

export const AccountApi = {
  /**
   * Resolve the current session from IAM: a valid access token (refreshed if
   * needed) + its userinfo claims projected onto `Account`. Returns null when
   * signed out. Self-heals: a stale access token with a live refresh token is
   * silently refreshed by the SDK before the claims are read.
   */
  session: async (): Promise<SessionResult> => {
    let token = await iamValidAccessToken()
    // A transient IAM blip (network / a 5xx from the token endpoint) yields a null
    // token even though the browser still holds a session — don't boot the user to the
    // sign-in card on a hiccup at load. Retry via the ONE resilient, single-flight
    // refresh before concluding signed-out; an anonymous visitor (no stored token)
    // skips it (iamHasSession is false) and resolves signed-out immediately.
    if (!token && iamHasSession() && (await refreshSession())) {
      token = await iamValidAccessToken()
    }
    if (!token) return { account: null, expiresIn: null }
    // Resolve identity from the access-token JWT claims directly — self-contained
    // and immune to the SDK's getUserInfo() returning null on a 200 (which dead-ended
    // the session and looped /signin). Fall back to userinfo only if not a JWT.
    const claims = decodeJwtClaims(token) ?? (await iamUserInfo())
    if (!claims) return { account: null, expiresIn: null }
    const account = accountFromClaims(claims)
    if (!account) return { account: null, expiresIn: null }
    return { account: await withAvatar(account), expiresIn: iamExpiresInSeconds() }
  },

  /** The current signed-in account, or null. */
  current: async (): Promise<Account | null> => (await AccountApi.session()).account,

  /** Sign out: clear the IAM tokens (client) and best-effort the casibase session. */
  signout: async (): Promise<void> => {
    forgetAvatar()
    iamSignOut()
    try {
      await post('signout')
    } catch {
      /* best-effort */
    }
  },

  /**
   * The caller's own cross-product preference document — theme, pinned nav, and
   * whatever else a surface saves. `{}` when nothing has been saved yet (a 200 with
   * an empty document, never a 404), so a first-time user still renders.
   */
  preferences: async (): Promise<Record<string, unknown>> => {
    const r = await restGet<PrefsDocument>(originV1Url(PREFS_PATH))
    return r?.prefs ?? {}
  },

  /**
   * Save the preference keys this surface owns, leaving every other key alone: the
   * merge is shallow and server-side, so two products (or two tabs) do not clobber
   * each other. Returns the whole document after the merge.
   *
   * Self-scoped on the backend — the subject is the `<owner>/<name>` identity built
   * from the validated Bearer and is the mandatory predicate on the write, so there is
   * no path to another user's preferences.
   */
  updatePreferences: async (
    partial: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const r = await restPatch<PrefsDocument>(originV1Url(PREFS_PATH), partial)
    return r?.prefs ?? {}
  },

  /**
   * Set the signed-in user's profile photo. Returns the URL it is served from,
   * which cloud has already written onto the IAM user row — so the change is
   * visible to every product, not just this tab.
   *
   * Self-scoped on the backend: the subject comes from the validated token, so
   * there is no way to name a different user's photo.
   */
  setAvatar: async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file, file.name)
    const r = await postForm<{ avatar?: string }>('avatar', form)
    if (!r.avatar) throw new ApiError('The server accepted the photo but returned no URL')
    return r.avatar
  },
}
