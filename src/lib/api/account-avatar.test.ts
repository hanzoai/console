/**
 * AccountApi.setAvatar — the profile photo, which until now could not be set at
 * all (the card rendered `avatar` read-only and pointed at an IAM that has no
 * way to write one either).
 *
 * What matters at THIS seam is small and worth pinning: the file travels as a
 * multipart part named `file` (the server reads exactly that part), the answered
 * URL is returned so the card can render the new photo immediately, and a failure
 * carries the SERVER'S reason — "a profile photo must be a PNG, JPEG, GIF or
 * WebP image" is actionable where "Request failed" is not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const postForm = vi.fn()
vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client')
  return {
    ApiError: actual.ApiError,
    originV1Url: actual.originV1Url,
    post: vi.fn(),
    postForm: (...a: unknown[]) => postForm(...a),
    restGet: vi.fn(),
    restPatch: vi.fn(),
  }
})
vi.mock('~/lib/auth/iam', () => ({
  iamValidAccessToken: vi.fn(),
  iamHasSession: vi.fn(() => false),
  iamUserInfo: vi.fn(),
  iamExpiresInSeconds: vi.fn(),
  iamSignOut: vi.fn(),
}))

import { AccountApi } from './account'
import { ApiError } from './client'

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'me.png', { type: 'image/png' })

describe('AccountApi.setAvatar', () => {
  beforeEach(() => postForm.mockReset())

  it('sends the image as the multipart part named "file" and returns the served URL', async () => {
    const url = 'https://api.hanzo.ai/v1/avatar/hanzo/u-antje/' + 'a'.repeat(64)
    postForm.mockResolvedValueOnce({ avatar: url })

    expect(await AccountApi.setAvatar(png())).toBe(url)

    const [path, form] = postForm.mock.calls[0] as [string, FormData]
    expect(path).toBe('avatar')
    // The server reads the part named `file`; any other name is a 400.
    const part = form.get('file')
    expect(part).toBeInstanceOf(File)
    expect((part as File).name).toBe('me.png')
  })

  it("surfaces the server's own reason for a refusal", async () => {
    postForm.mockRejectedValueOnce(
      new ApiError('a profile photo must be a PNG, JPEG, GIF or WebP image', 415),
    )
    await expect(AccountApi.setAvatar(png())).rejects.toThrow(/PNG, JPEG, GIF or WebP/)
  })

  // A 200 with no URL would leave the card rendering the OLD photo while the
  // caller believed it changed. Better to say so.
  it('refuses a success that carries no URL', async () => {
    postForm.mockResolvedValueOnce({})
    await expect(AccountApi.setAvatar(png())).rejects.toThrow(/no URL/i)
  })
})
