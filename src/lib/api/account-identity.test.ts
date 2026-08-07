import { describe, it, expect, vi, beforeEach } from 'vitest'

// The IAM seam. `session()` reads a valid access token and projects its claims onto
// the console `Account`; mocking the token lets the projection be asserted directly.
const token = vi.hoisted(() => ({ value: null as string | null }))

vi.mock('~/lib/auth/iam', () => ({
  iamValidAccessToken: async () => token.value,
  iamHasSession: () => token.value != null,
  iamUserInfo: async () => null,
  iamExpiresInSeconds: () => 3600,
  iamSignOut: () => {},
}))

const { AccountApi } = await import('~/lib/api/account')

/** Build an unsigned JWT carrying `claims` — only the payload is ever decoded. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`
}

/** The claim set hanzo.id actually issues (trimmed to what this projection reads). */
const IAM_CLAIMS = {
  iss: 'https://hanzo.id',
  sub: '2d4d67ab-30f1-474e-b81f-f60461852259',
  owner: 'hanzo',
  organization: 'hanzo',
  email: 'z@hanzo.ai',
  preferred_username: 'z',
  name: 'Zach Kelling',
}

describe('account identity from IAM claims', () => {
  beforeEach(() => {
    token.value = null
  })

  it('carries the IAM user id (the `sub` claim) onto the account', async () => {
    token.value = jwt(IAM_CLAIMS)

    const account = await AccountApi.current()

    // This is the value every Hanzo property identifies this user by. It was
    // previously decoded, used only to back-derive owner/name, and dropped — so
    // nothing downstream could join this user to their hanzo.ai or hanzo.chat
    // activity.
    expect(account?.userId).toBe('2d4d67ab-30f1-474e-b81f-f60461852259')
  })

  it('keeps the user id distinct from the org-relative owner/name reference', async () => {
    token.value = jwt(IAM_CLAIMS)

    const account = await AccountApi.current()

    // owner/name still resolve (display + org-scoped API paths depend on them) —
    // but they are a DIFFERENT id space, and identifying by them is what counted
    // one user twice across surfaces.
    expect(account?.owner).toBe('hanzo')
    expect(account?.name).toBe('Zach Kelling')
    expect(account?.userId).not.toBe(`${account?.owner}/${account?.name}`)
  })

  it('leaves the user id absent rather than substituting owner/name', async () => {
    // A token with no `sub` has no IAM user id. Filling it with the actor ref would
    // silently reintroduce the cross-surface split this field exists to fix.
    const { sub: _dropped, ...noSub } = IAM_CLAIMS
    token.value = jwt(noSub)

    const account = await AccountApi.current()

    expect(account).not.toBeNull()
    expect(account?.userId).toBeUndefined()
  })

  it('has no account at all when signed out', async () => {
    token.value = null
    expect(await AccountApi.current()).toBeNull()
  })
})
