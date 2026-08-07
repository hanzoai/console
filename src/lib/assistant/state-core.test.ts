import { describe, expect, it } from 'vitest'

import { honest } from './state-core'

const refused = (message: string) => ({ kind: 'signin' as const, message })

describe('honest — a 401 explained by whether the session is actually live', () => {
  it('does not tell a signed-in user their session expired', () => {
    // Measured live: the composer answered "Your session expired" while that very page
    // held a working token — the request had simply carried no credential. Sending that
    // user to sign in again could not have fixed anything.
    expect(honest(refused('Invalid API key format'), 3600).kind).toBe('access')
  })

  it('still says sign in when there is no live credential to send', () => {
    expect(honest(refused('Not authorized'), null).kind).toBe('signin')
  })

  it('treats a lapsed token as no credential, not as a live session', () => {
    expect(honest(refused('Not authorized'), 0).kind).toBe('signin')
  })

  it('leaves every other kind exactly as classified', () => {
    for (const kind of ['billing', 'access', 'unavailable', 'not-initialized', 'error'] as const) {
      expect(honest({ kind, message: 'm' }, 3600)).toEqual({ kind, message: 'm' })
    }
  })

  it('carries the message the backend sent, so no copy is invented', () => {
    expect(honest(refused('the token count exceeds the model'), 3600).message).toBe(
      'the token count exceeds the model',
    )
  })
})
