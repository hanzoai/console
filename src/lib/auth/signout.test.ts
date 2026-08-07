import { describe, it, expect, vi } from 'vitest'

// Only the issuer origin matters here; the rest of `config` is irrelevant to the
// URL under test, so the mock stays the size of the dependency.
vi.mock('~/config', () => ({ config: { iamUrl: 'https://hanzo.id' } }))

const { iamSignOutUrl } = await import('~/lib/auth/iam')

const HERE = 'https://console.hanzo.ai'
const back = (u: string) => new URL(u).searchParams.get('post_logout_redirect_uri')!

/**
 * Signing out has to end the session at the ISSUER, not just in this tab.
 *
 * `iamSignOut()` drops this browser's tokens and nothing else. That is half of it,
 * and the half nobody notices: the `iam_session_id` cookie lives on hanzo.id, this
 * origin cannot touch it, and the very next thing the app does is bounce to
 * /signin — which asks the issuer for a code from the EXISTING session. Measured
 * against production before the fix: clear the tokens the way this module did, and
 * silent SSO still answered `status: ok` with a code, so the user landed straight
 * back in the console they had just left.
 */
describe('sign-out ends the session at the issuer', () => {
  it('points at RP-initiated logout on the ISSUER, not this origin', () => {
    const u = new URL(iamSignOutUrl(HERE))
    expect(u.origin).toBe('https://hanzo.id')
    expect(u.pathname).toBe('/v1/iam/oauth/logout')
  })

  it('returns the browser to an absolute URL on THIS origin', () => {
    // RP-initiated logout redirects; a bare path would be resolved against the
    // ISSUER, landing the user on hanzo.id/signin instead of the console's.
    expect(back(iamSignOutUrl(HERE, '/signin'))).toBe(`${HERE}/signin`)
  })

  it('defaults to /signin, so a caller cannot forget where to land', () => {
    expect(back(iamSignOutUrl(HERE))).toBe(`${HERE}/signin`)
  })

  it('refuses a return leg that leaves this origin', () => {
    // An absolute URL beats a base in `new URL`, so without the check the IdP
    // would be handed an open redirect to hand back. A foreign return is never
    // what sign-out meant — fall back to our own sign-in page.
    expect(back(iamSignOutUrl(HERE, 'https://evil.example.com/steal'))).toBe(`${HERE}/signin`)
    expect(back(iamSignOutUrl(HERE, '//evil.example.com/steal'))).toBe(`${HERE}/signin`)
  })

  it('is a pure function of its inputs — no window, so SSR cannot throw', () => {
    // This module is imported by server-rendered code. Every sibling guards
    // `typeof window === 'undefined'`; this one has nothing to guard, which is
    // why the test can run in the repo's node environment at all.
    expect(typeof globalThis.window).toBe('undefined')
    expect(() => iamSignOutUrl(HERE)).not.toThrow()
  })
})
