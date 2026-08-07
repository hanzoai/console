import { describe, it, expect, vi, beforeEach } from 'vitest'

// The IAM seam, both halves. The access TOKEN answers who you are; USERINFO is the
// only place IAM publishes the avatar (`picture`) — deliberately, so a bounded data
// URI never rides every JWT. `userinfoCalls` counts the round trips so the cache can
// be asserted rather than assumed.
const token = vi.hoisted(() => ({ value: null as string | null }))
const userinfo = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
  calls: 0,
  throws: false,
}))

vi.mock('~/lib/auth/iam', () => ({
  iamValidAccessToken: async () => token.value,
  iamUserInfo: async () => {
    userinfo.calls++
    if (userinfo.throws) throw new Error('userinfo unreachable')
    return userinfo.value
  },
  iamExpiresInSeconds: () => 3600,
  iamSignOut: () => {},
}))

const { AccountApi } = await import('~/lib/api/account')

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`
}

// The claim set hanzo.id issues. Note what is NOT here: no `avatar`, no `picture`.
// That absence IS the contract — reading only these is why the console showed
// initials for every user who had uploaded a photo.
const CLAIMS = { iss: 'https://hanzo.id', sub: 'u-1', owner: 'hanzo', name: 'z', email: 'z@hanzo.ai' }
const PHOTO = 'data:image/webp;base64,UklGRhoAAABXRUJQ'

describe('the profile photo the token does not carry', () => {
  beforeEach(async () => {
    token.value = null
    userinfo.value = null
    userinfo.calls = 0
    userinfo.throws = false
    await AccountApi.signout() // drops the cached photo between cases
  })

  it('reads the photo from userinfo when the token has none', async () => {
    token.value = jwt(CLAIMS)
    userinfo.value = { picture: PHOTO }
    const { account } = await AccountApi.session()
    expect(account?.avatar).toBe(PHOTO)
  })

  it('prefers the token when it DOES carry one, and asks userinfo nothing', async () => {
    token.value = jwt({ ...CLAIMS, avatar: 'data:image/png;base64,FROMTOKEN' })
    userinfo.value = { picture: PHOTO }
    const { account } = await AccountApi.session()
    expect(account?.avatar).toBe('data:image/png;base64,FROMTOKEN')
    expect(userinfo.calls).toBe(0)
  })

  it('costs ONE round trip across repeated loads — including for a user with no photo', async () => {
    token.value = jwt(CLAIMS)
    userinfo.value = { picture: PHOTO }
    await AccountApi.session()
    await AccountApi.session()
    await AccountApi.session()
    expect(userinfo.calls).toBe(1)

    await AccountApi.signout()
    userinfo.value = {} // no photo — the MISS must cache too, or it refetches forever
    userinfo.calls = 0
    await AccountApi.session()
    await AccountApi.session()
    expect(userinfo.calls).toBe(1)
  })

  it('never shows the previous account’s face after a switch', async () => {
    token.value = jwt(CLAIMS)
    userinfo.value = { picture: PHOTO }
    expect((await AccountApi.session()).account?.avatar).toBe(PHOTO)

    // A different principal, same tab, no sign-out in between.
    token.value = jwt({ ...CLAIMS, owner: 'maxpower', name: 'dave' })
    userinfo.value = {}
    expect((await AccountApi.session()).account?.avatar).toBeUndefined()
  })

  it('a failing userinfo costs the photo, never the session', async () => {
    token.value = jwt(CLAIMS)
    userinfo.throws = true
    const { account } = await AccountApi.session()
    expect(account?.owner).toBe('hanzo')
    expect(account?.name).toBe('z')
    expect(account?.avatar).toBeUndefined()
  })
})
