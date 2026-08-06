import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  StorageApi,
  normalizeBucket,
  normalizeBuckets,
  normalizeObject,
  normalizeObjects,
  normalizePresigned,
  encodeKey,
  joinKey,
  uploadTo,
} from './storage'

/** The origin the SPA is served from — deliberately NOT where the API lives. */
const ORIGIN = 'https://console.hanzo.ai'
/** The one API host every `/v1` call resolves against (config's CANONICAL_API_URL). */
const API = 'https://api.hanzo.ai'

/** Stub window + a single JSON fetch response; capture the URL the client hit. */
let lastUrl = ''
function stubJson(body: unknown, status = 200): void {
  lastUrl = ''
  ;(globalThis as { window?: unknown }).window = {
    location: { origin: ORIGIN, hostname: 'console.hanzo.ai' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  }
  vi.stubGlobal('fetch', (url: string) => {
    lastUrl = String(url)
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
}

function teardown(): void {
  vi.unstubAllGlobals()
  delete (globalThis as { window?: unknown }).window
}

// ── normalizers (pure) ────────────────────────────────────────────────────────

describe('storage normalizers', () => {
  it('normalizeBucket reads name + createdAt, and both alt keys', () => {
    expect(normalizeBucket({ name: 'photos', createdAt: 1700000000 })).toEqual({
      name: 'photos',
      createdAt: 1700000000,
    })
    // creationDate is the alternate key.
    expect(normalizeBucket({ name: 'docs', creationDate: 1700000001 })?.createdAt).toBe(1700000001)
    // A record with no name is not a bucket.
    expect(normalizeBucket({ createdAt: 1 })).toBeNull()
    expect(normalizeBucket(null)).toBeNull()
  })

  it('normalizeBuckets pulls the array from {buckets:[…]} and filters junk', () => {
    const out = normalizeBuckets({ buckets: [{ name: 'a' }, { nope: 1 }, { name: 'b' }] })
    expect(out.map((b) => b.name)).toEqual(['a', 'b'])
    // Bare array also works.
    expect(normalizeBuckets([{ name: 'x' }]).map((b) => b.name)).toEqual(['x'])
    // Empty / unreachable shapes → [].
    expect(normalizeBuckets(null)).toEqual([])
    expect(normalizeBuckets({})).toEqual([])
  })

  it('normalizeObject: a "/"-suffixed key is a folder (size 0), else a file', () => {
    const folder = normalizeObject({ key: 'sub/', size: 0 })
    expect(folder).toMatchObject({ key: 'sub/', isDir: true, size: 0 })

    const file = normalizeObject({ key: 'a.txt', size: 1234, lastModified: 1700000000, etag: 'abc' })
    expect(file).toMatchObject({ key: 'a.txt', isDir: false, size: 1234, lastModified: 1700000000, etag: 'abc' })

    // Explicit isDir flag forces a folder even without a trailing slash.
    expect(normalizeObject({ key: 'dir', isDir: true })?.isDir).toBe(true)
    // No key → not an object.
    expect(normalizeObject({ size: 1 })).toBeNull()
  })

  it('normalizeObjects pulls from {objects:[…]} (and contents) and drops junk', () => {
    const out = normalizeObjects({ objects: [{ key: 'a.txt' }, { junk: 1 }, { key: 'b/' }] })
    expect(out.map((o) => o.key)).toEqual(['a.txt', 'b/'])
    expect(out[1].isDir).toBe(true)
    // S3 raw shape sometimes nests under "contents".
    expect(normalizeObjects({ contents: [{ name: 'x.png' }] }).map((o) => o.key)).toEqual(['x.png'])
    expect(normalizeObjects(null)).toEqual([])
  })

  it('normalizePresigned reads url + method (default PUT), null without url', () => {
    expect(normalizePresigned({ url: 'https://s3/x', method: 'GET', key: 'k', expiresIn: 900 })).toEqual({
      url: 'https://s3/x',
      method: 'GET',
      key: 'k',
      expiresIn: 900,
    })
    // method defaults to PUT.
    expect(normalizePresigned({ url: 'https://s3/y', key: 'k' })?.method).toBe('PUT')
    expect(normalizePresigned({ key: 'k' })).toBeNull()
  })
})

// ── key helpers (traversal-safe path handling) ────────────────────────────────

describe('storage key helpers', () => {
  it('encodeKey percent-encodes segments but PRESERVES "/" separators', () => {
    expect(encodeKey('a/b/c.png')).toBe('a/b/c.png')
    // A space + unicode inside a segment is encoded; the slash stays literal.
    expect(encodeKey('my folder/файл.txt')).toBe('my%20folder/%D1%84%D0%B0%D0%B9%D0%BB.txt')
    // A "#" or "?" in a name must be encoded so it can't split the URL.
    expect(encodeKey('weird#name?.bin')).toBe('weird%23name%3F.bin')
  })

  it('joinKey joins a folder prefix + name with exactly one slash, no leading slash', () => {
    expect(joinKey('', 'a.txt')).toBe('a.txt')
    expect(joinKey('photos', 'a.txt')).toBe('photos/a.txt')
    expect(joinKey('photos/', 'a.txt')).toBe('photos/a.txt')
    expect(joinKey('/photos/', 'a.txt')).toBe('photos/a.txt')
    expect(joinKey('a/b/', 'c.txt')).toBe('a/b/c.txt')
  })
})

// ── transport: every call hits /v1/s3 on the canonical API host, not the page origin ─

describe('StorageApi transport (canonical API host /v1)', () => {
  beforeEach(() => stubJson({ buckets: [] }))
  afterEach(teardown)

  it('buckets() GETs /v1/s3/buckets', async () => {
    await StorageApi.buckets()
    expect(lastUrl).toBe(`${API}/v1/s3/buckets`)
  })

  it('objects() encodes the prefix as a query param', async () => {
    stubJson({ objects: [] })
    await StorageApi.objects('photos', 'a/b/')
    expect(lastUrl).toBe(`${API}/v1/s3/buckets/photos/objects?prefix=a%2Fb%2F`)
  })

  it('objects() with no prefix omits the query', async () => {
    stubJson({ objects: [] })
    await StorageApi.objects('photos')
    expect(lastUrl).toBe(`${API}/v1/s3/buckets/photos/objects`)
  })

  it('presignDownload() preserves nested key slashes in the path', async () => {
    stubJson({ url: 'https://s3.hanzo.ai/x', method: 'GET' })
    await StorageApi.presignDownload('photos', 'a/b/c.png')
    expect(lastUrl).toBe(`${API}/v1/s3/buckets/photos/objects/a/b/c.png`)
  })

  it('deleteObject() targets the object path (204 resolves)', async () => {
    stubJson(null, 204)
    await StorageApi.deleteObject('photos', 'a/b/c.png')
    expect(lastUrl).toBe(`${API}/v1/s3/buckets/photos/objects/a/b/c.png`)
  })

  it('createBucket() POSTs the name to /v1/s3/buckets', async () => {
    stubJson({ name: 'new-bucket' }, 201)
    const b = await StorageApi.createBucket('new-bucket')
    expect(lastUrl).toBe(`${API}/v1/s3/buckets`)
    expect(b?.name).toBe('new-bucket')
  })
})

// ── uploadTo: direct-to-S3 PUT (bypasses the proxy) ───────────────────────────

describe('uploadTo (presigned direct-to-S3)', () => {
  afterEach(teardown)

  it('PUTs the raw body to the presigned URL and resolves on 2xx', async () => {
    let method = ''
    let target = ''
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      target = String(url)
      method = String(init.method)
      return Promise.resolve(new Response(null, { status: 200 }))
    })
    await uploadTo('https://s3.hanzo.ai/presigned', new Blob(['x']))
    expect(method).toBe('PUT')
    expect(target).toBe('https://s3.hanzo.ai/presigned')
  })

  it('throws on a non-2xx so the caller surfaces a real failure', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 403 })))
    await expect(uploadTo('https://s3.hanzo.ai/x', new Blob(['x']))).rejects.toThrow(/403/)
  })
})
