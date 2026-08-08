'use client'

/**
 * Tags — the org's own tag manager: what a site injects in the browser, where its
 * conversions are forwarded server-side, and the one line that installs both.
 *
 * TWO SCOPES, kept apart on purpose. A browser pixel belongs to a SITE — hanzo.ai and
 * hanzo.chat carry different ids under one org — and is stored on that site's project
 * (`PATCH /v1/projects/:slug`, the `tags` map). A server-side destination belongs to the
 * ORG: cloud keys a destination row by (org, platform) alone, with no site column. So
 * the two live on separate routes and each says which scope it is writing. Drawing a
 * per-site destination switch would be a lie about where the write lands.
 *
 * The two halves are the SAME conversion, sent twice: the hosted tag fires the native
 * pixel in the page and posts to `/v1/event` with a shared `event_id`, and the server
 * forwards that event to the platform's Conversions API carrying the same id — so the
 * platform dedupes the pair instead of double-counting it. That is why one page owns
 * both, and why the browser id being PUBLIC and the API credential being KMS-sealed are
 * not an inconsistency: the pixel id ships in the page by definition, and the credential
 * never leaves the server (submitted once through `connect`, never returned by any read).
 *
 * The destination form is rendered FROM the server's own declared spec (`fields` +
 * `secrets` on each status card), never from a per-platform shape hardcoded here — so a
 * platform added upstream appears with its real inputs and no console change.
 *
 * Every state is honest: loading, a true empty state, the shared BackendStateCard on
 * 401/403/404/503, and a live preview that reports what the door will ACTUALLY serve
 * rather than echoing back what was typed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import {
  Check,
  Copy,
  ExternalLink,
  Plug,
  RefreshCw,
  Send,
  Tag,
  Trash2,
  X,
} from '@hanzogui/lucide-icons-2'

import {
  AppsApi,
  BROWSER_PLATFORMS,
  installTag,
  mergeTags,
  type App,
  type BrowserTag,
} from '~/lib/api/apps'
import {
  DestinationsApi,
  connectBody,
  destinationState,
  missingField,
  needsSecret,
  secretLabel,
  type Destination,
  type DestinationTest,
} from '~/lib/api/destinations'
import {
  BackendStateCard,
  DataTable,
  EmptyState,
  FieldRow,
  FieldText,
  PageHeader,
  PrimaryButton,
  StatusTag,
  classifyBackend,
  type BackendState,
  type Column,
} from '@hanzo/ui/product'
import { useToast } from '~/components/ui/Toast'

type Async<T> =
  | { phase: 'loading' }
  | { phase: 'error'; error: BackendState }
  | { phase: 'ready'; data: T }

const dash = (s: string) => (s.trim() ? s : '-')

/** Open an external URL in a new tab (no-opener), guarded for SSR. */
const openHref = (href: string) => {
  if (href && typeof window !== 'undefined') window.open(href, '_blank', 'noopener,noreferrer')
}

/** Copy-to-clipboard button with a transient confirmed state. */
function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked (insecure context) — the value is already visible */
    }
  }
  return (
    <Button size="$2" icon={copied ? <Check size={14} /> : <Copy size={14} />} onPress={() => void copy()}>
      {copied ? 'Copied' : label}
    </Button>
  )
}

/** A small neutral pill — the platform chips on a site row. */
function Chip({ label }: { label: string }) {
  return (
    <XStack px="$2" py="$1" rounded="$2" bg="$color3">
      <Text fontSize="$1" color="$color11">
        {label}
      </Text>
    </XStack>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <XStack gap="$2" items="baseline" justify="space-between">
      <Text fontSize="$2" color="$color10">
        {label}
      </Text>
      <Text fontSize="$2" color="$color12" numberOfLines={1}>
        {value}
      </Text>
    </XStack>
  )
}

// ── Install snippet ──────────────────────────────────────────────────────────

/**
 * The one-line install for a site. The tag resolves its own tag set from the key at
 * runtime, so this line is stable as the site's pixels change — which is the reason to
 * show it once per site rather than regenerate it per edit.
 */
function InstallCard({ appKey }: { appKey: string }) {
  const snippet = installTag(appKey)
  return (
    <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$borderColor">
      <Text fontSize="$2" fontWeight="700" color="$color11">
        Install
      </Text>
      {appKey ? (
        <>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <Text
              flex={1}
              minW={200}
              fontSize="$1"
              color="$color12"
              className="hz-mono"
              selectable
              style={{ wordBreak: 'break-all' }}
            >
              {snippet}
            </Text>
            <CopyButton value={snippet} label="Copy snippet" />
          </XStack>
          <Text fontSize="$1" color="$color10">
            Paste once in the site&rsquo;s &lt;head&gt;. Bundling instead? The track.js entry in
            @hanzo/tag takes the same key.
          </Text>
        </>
      ) : (
        <Text fontSize="$2" color="$color10">
          This site has no publishable key yet, so there is nothing to install. A key is
          minted when the site is created.
        </Text>
      )}
    </YStack>
  )
}

// ── Live preview ─────────────────────────────────────────────────────────────

/**
 * What the hosted tag will ACTUALLY inject, read from the public door. Distinct from
 * the form above it on purpose: the door drops a platform with no browser pixel and any
 * empty id, so this is the difference between "what I typed" and "what the page does".
 */
function PreviewCard({ appKey, nonce }: { appKey: string; nonce: number }) {
  const [state, setState] = useState<Async<BrowserTag[]>>({ phase: 'loading' })

  const load = useCallback(() => {
    if (!appKey) return
    setState({ phase: 'loading' })
    AppsApi.browserTags(appKey)
      .then((data) => setState({ phase: 'ready', data }))
      .catch((e) => setState({ phase: 'error', error: classifyBackend(e) }))
  }, [appKey])
  useEffect(() => {
    load()
  }, [load, nonce])

  if (!appKey) return null

  return (
    <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$borderColor">
      <XStack items="center" justify="space-between">
        <Text fontSize="$2" fontWeight="700" color="$color11">
          Will inject
        </Text>
        <Button size="$2" chromeless aria-label="Refresh preview" icon={<RefreshCw size={13} />} onPress={load} />
      </XStack>
      {state.phase === 'loading' ? (
        <XStack p="$2" justify="center">
          <Spinner size="small" color="$color11" />
        </XStack>
      ) : state.phase === 'error' ? (
        <BackendStateCard state={state.error} onRetry={load} hint="endpoint · GET /v1/tags" />
      ) : state.data.length === 0 ? (
        <Text fontSize="$2" color="$color10">
          Nothing yet — the tag will load and send events, but inject no pixels.
        </Text>
      ) : (
        state.data.map((t) => (
          <XStack key={t.platform} items="center" justify="space-between" gap="$2" py="$1">
            <Text fontSize="$2" fontWeight="600" color="$color12">
              {t.platform}
            </Text>
            <Text fontSize="$1" color="$color10" numberOfLines={1} className="hz-mono">
              {t.id}
            </Text>
          </XStack>
        ))
      )}
    </YStack>
  )
}

// ── Per-site editor ──────────────────────────────────────────────────────────

type SiteState =
  | { phase: 'loading' }
  | { phase: 'error'; error: BackendState }
  | { phase: 'ready'; app: App }

/**
 * One site's browser pixels. Self-contained by slug so the rail renders identically
 * whether opened from a row press or a `/tags/:slug` deep link.
 */
function SiteTags({ slug, onClose, onSaved }: { slug: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [state, setState] = useState<SiteState>({ phase: 'loading' })
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [nonce, setNonce] = useState(0)

  const load = useCallback(() => {
    setState({ phase: 'loading' })
    AppsApi.get(slug)
      .then((app) => {
        setState({ phase: 'ready', app })
        setDraft(app.tags)
      })
      .catch((e) => setState({ phase: 'error', error: classifyBackend(e) }))
  }, [slug])
  useEffect(() => {
    load()
  }, [load])

  const app = state.phase === 'ready' ? state.app : null

  const save = async () => {
    if (!app) return
    setSaving(true)
    try {
      const updated = await AppsApi.setTags(app.slug, mergeTags(app.tags, draft))
      setState({ phase: 'ready', app: updated })
      setDraft(updated.tags)
      setNonce((n) => n + 1)
      toast.success(`Saved tags for ${dash(updated.name || updated.slug)}`)
      onSaved()
    } catch (e) {
      toast.error('Could not save tags', classifyBackend(e).message)
    } finally {
      setSaving(false)
    }
  }

  const dirty = useMemo(() => {
    if (!app) return false
    return BROWSER_PLATFORMS.some(
      ({ platform }) => (draft[platform] ?? '').trim() !== (app.tags[platform] ?? ''),
    )
  }, [app, draft])

  return (
    <Card p="$4" gap="$3" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" justify="space-between" gap="$2">
        <Text fontSize="$5" fontWeight="800" numberOfLines={1}>
          {app ? dash(app.name || app.slug) : slug}
        </Text>
        <Button size="$2" chromeless aria-label="Close site tags" icon={<X size={16} />} onPress={onClose} />
      </XStack>

      {state.phase === 'loading' ? (
        <XStack p="$4" justify="center">
          <Spinner size="small" color="$color11" />
        </XStack>
      ) : state.phase === 'error' ? (
        <BackendStateCard state={state.error} onRetry={load} hint={`endpoint · GET /v1/projects/${slug}`} />
      ) : (
        <>
          <YStack gap="$1">
            <Fact label="Slug" value={state.app.slug} />
            {state.app.liveUrl ? <Fact label="Live URL" value={state.app.liveUrl} /> : null}
          </YStack>

          <YStack gap="$3" pt="$2" borderTopWidth={1} borderColor="$borderColor">
            <YStack gap="$1">
              <Text fontSize="$2" fontWeight="700" color="$color11">
                Browser pixels
              </Text>
              <Text fontSize="$1" color="$color10">
                These ids are public — they ship in the page. Clear one to stop injecting it.
              </Text>
            </YStack>

            {BROWSER_PLATFORMS.map(({ platform, label, example }) => (
              <FieldRow key={platform} label={label}>
                <FieldText
                  value={draft[platform] ?? ''}
                  onChange={(v: string) => setDraft((d) => ({ ...d, [platform]: v }))}
                  placeholder={example}
                  disabled={saving}
                />
              </FieldRow>
            ))}

            <XStack gap="$2" items="center" justify="flex-end">
              {dirty ? (
                <Button size="$3" disabled={saving} onPress={() => setDraft(state.app.tags)}>
                  Reset
                </Button>
              ) : null}
              <PrimaryButton size="$3" disabled={!dirty || saving} onPress={() => void save()}>
                {saving ? 'Saving…' : 'Save pixels'}
              </PrimaryButton>
            </XStack>
          </YStack>

          <PreviewCard appKey={state.app.key} nonce={nonce} />
          <InstallCard appKey={state.app.key} />
        </>
      )}
    </Card>
  )
}

// ── Sites list ───────────────────────────────────────────────────────────────

export function TagsModule({ params }: { params: Record<string, string> }) {
  const router = useRouter()
  const active = params.slug || null
  const [state, setState] = useState<Async<App[]>>({ phase: 'loading' })

  const load = useCallback(() => {
    setState({ phase: 'loading' })
    AppsApi.list()
      .then((data) => setState({ phase: 'ready', data }))
      .catch((e) => setState({ phase: 'error', error: classifyBackend(e) }))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const columns: Column<App>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Site',
        render: (a) => (
          <XStack items="center" gap="$2" minW={0}>
            <Tag size={15} color="$color10" />
            <YStack minW={0}>
              <Text fontSize="$3" fontWeight="600" color="$color12" numberOfLines={1}>
                {dash(a.name || a.slug)}
              </Text>
              <Text fontSize="$1" color="$color10" numberOfLines={1}>
                {a.slug}
              </Text>
            </YStack>
          </XStack>
        ),
      },
      {
        key: 'tags',
        header: 'Pixels',
        width: 240,
        render: (a) => {
          const on = BROWSER_PLATFORMS.filter(({ platform }) => a.tags[platform])
          return on.length === 0 ? (
            <Text fontSize="$2" color="$color10">
              None
            </Text>
          ) : (
            <XStack gap="$1" flexWrap="wrap">
              {on.map(({ platform }) => (
                <Chip key={platform} label={platform} />
              ))}
            </XStack>
          )
        },
      },
      {
        key: 'key',
        header: 'Key',
        width: 220,
        render: (a) =>
          a.key ? (
            <XStack gap="$2" items="center" minW={0}>
              <Text fontSize="$1" color="$color10" numberOfLines={1} className="hz-mono">
                {a.key}
              </Text>
              <CopyButton value={a.key} label="Copy" />
            </XStack>
          ) : (
            <Text fontSize="$2" color="$color10">
              —
            </Text>
          ),
      },
    ],
    [],
  )

  const header = (
    <PageHeader
      title="Tags"
      subtitle="Browser pixels per site, server-side conversions per organization, and the one line that installs them."
      actions={
        <XStack gap="$2">
          <Button size="$3" icon={<RefreshCw size={15} />} aria-label="Refresh" onPress={load} />
          <PrimaryButton size="$3" icon={<Plug size={16} />} onPress={() => router.push('/tags/destinations')}>
            Destinations
          </PrimaryButton>
        </XStack>
      }
    />
  )

  if (state.phase === 'error') {
    return (
      <>
        {header}
        <BackendStateCard state={state.error} onRetry={load} hint="endpoint · GET /v1/projects" />
      </>
    )
  }

  const sites = state.phase === 'ready' ? state.data : []

  if (state.phase === 'ready' && sites.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Tag}
          title="No sites yet"
          description="Tags are configured per site. Publish a site and it shows up here with its own publishable key, ready to tag."
          bullets={[
            'Each site carries its own GA4, Meta, TikTok and X ids.',
            'One script tag installs them all and keeps working as they change.',
            'Server-side conversions are set up once for the whole organization.',
          ]}
          primary={{ label: 'Set up destinations', onPress: () => router.push('/tags/destinations') }}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <XStack gap="$4" flexWrap="wrap" items="flex-start">
        <YStack flex={2} minW={320} gap="$2">
          <DataTable
            columns={columns}
            rows={sites}
            loading={state.phase === 'loading'}
            rowKey={(a) => a.slug || a.id}
            onRowPress={(a) => router.push(`/tags/${a.slug}`)}
            empty="No sites yet."
          />
        </YStack>
        {active ? (
          <YStack flex={1} minW={320}>
            <SiteTags slug={active} onClose={() => router.push('/tags')} onSaved={load} />
          </YStack>
        ) : null}
      </XStack>
    </>
  )
}

// ── Destinations (org-wide) ──────────────────────────────────────────────────

/**
 * One destination's card. Connected state, the org's stored non-secret ids, and an
 * inline form built from the platform's own declared fields + secret names.
 */
function DestinationCard({ dest, onChanged }: { dest: Destination; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(dest.config)
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [account, setAccount] = useState(dest.account)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DestinationTest | null>(null)

  const state = destinationState(dest)
  const mustType = needsSecret(dest)

  const connect = async () => {
    const missing = missingField(dest, values)
    if (missing) {
      toast.error(`${missing.label} is required`, `${dest.name} cannot forward without it.`)
      return
    }
    if (mustType && dest.secrets.some((n) => !(secrets[n] ?? '').trim())) {
      toast.error('Credential required', `${dest.name} needs its credential to forward conversions.`)
      return
    }
    setBusy(true)
    try {
      const next = await DestinationsApi.connect(dest.platform, connectBody(dest, values, secrets, { account }))
      // The credential was sealed server-side; drop the typed copy immediately.
      setSecrets({})
      setOpen(false)
      toast.success(
        `${dest.name} connected`,
        next.live ? 'Its credential resolved.' : 'Saved, but its credential did not resolve.',
      )
      onChanged()
    } catch (e) {
      toast.error(`Could not connect ${dest.name}`, classifyBackend(e).message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await DestinationsApi.disconnect(dest.platform)
      toast.success(`${dest.name} disconnected`)
      onChanged()
    } catch (e) {
      toast.error(`Could not disconnect ${dest.name}`, classifyBackend(e).message)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    setResult(null)
    try {
      setResult(await DestinationsApi.test(dest.platform))
    } catch (e) {
      toast.error(`Could not test ${dest.name}`, classifyBackend(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card p="$4" gap="$3" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
        <YStack minW={0} flex={1}>
          <Text fontSize="$4" fontWeight="700" color="$color12" numberOfLines={1}>
            {dest.name}
          </Text>
          <Text fontSize="$1" color="$color10">
            {dest.category || 'Destination'}
            {dest.account ? ` · ${dest.account}` : ''}
          </Text>
        </YStack>
        <StatusTag status={state} />
      </XStack>

      {dest.connected && Object.keys(dest.config).length > 0 ? (
        <YStack gap="$1">
          {dest.fields
            .filter((f) => dest.config[f.key])
            .map((f) => (
              <Fact key={f.key} label={f.label} value={dest.config[f.key]} />
            ))}
        </YStack>
      ) : null}

      {dest.connected && dest.secrets.length > 0 ? (
        <Text fontSize="$1" color="$color10">
          {dest.secrets.map(secretLabel).join(' · ')} held in KMS
          {dest.live ? '' : ' — no credential resolves right now'}
        </Text>
      ) : null}

      {result ? (
        <Text fontSize="$2" color={result.ok ? '$green10' : '$red10'}>
          {result.ok
            ? `Accepted${result.sent === null ? '' : ` ${result.sent} event${result.sent === 1 ? '' : 's'}`}${result.message ? ` · ${result.message}` : ''}`
            : result.error || 'The platform rejected the event.'}
        </Text>
      ) : null}

      {open ? (
        <YStack gap="$3" pt="$2" borderTopWidth={1} borderColor="$borderColor">
          {dest.fields.map((f) => (
            <FieldRow key={f.key} label={f.required ? `${f.label} *` : f.label}>
              <FieldText
                value={values[f.key] ?? ''}
                onChange={(v: string) => setValues((s) => ({ ...s, [f.key]: v }))}
                placeholder={f.example}
                disabled={busy}
              />
            </FieldRow>
          ))}
          {dest.secrets.map((name) => (
            <FieldRow key={name} label={secretLabel(name)}>
              <FieldText
                value={secrets[name] ?? ''}
                onChange={(v: string) => setSecrets((s) => ({ ...s, [name]: v }))}
                placeholder={dest.connected ? 'Leave blank to keep the stored one' : ''}
                secure
                autoComplete="off"
                disabled={busy}
              />
            </FieldRow>
          ))}
          <FieldRow label="Account label">
            <FieldText value={account} onChange={setAccount} disabled={busy} />
          </FieldRow>
          <Text fontSize="$1" color="$color10">
            The credential is sealed into KMS for this organization and is never shown again.
          </Text>
          <XStack gap="$2" justify="flex-end">
            <Button size="$3" disabled={busy} onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <PrimaryButton size="$3" disabled={busy} onPress={() => void connect()}>
              {busy ? 'Saving…' : dest.connected ? 'Update' : 'Connect'}
            </PrimaryButton>
          </XStack>
        </YStack>
      ) : (
        <XStack gap="$2" justify="flex-end" flexWrap="wrap">
          {dest.connected ? (
            <>
              <Button size="$2" icon={<Send size={14} />} disabled={busy} onPress={() => void test()}>
                Send test
              </Button>
              <Button size="$2" icon={<Trash2 size={14} />} disabled={busy} onPress={() => void disconnect()}>
                Disconnect
              </Button>
            </>
          ) : null}
          <Button
            size="$2"
            icon={<Plug size={14} />}
            disabled={busy}
            // Seed from the CURRENT card each time it opens. The card keeps its identity
            // across a reload (same platform key), so state written on a previous open
            // would otherwise survive a disconnect and re-offer values the org no longer has.
            onPress={() => {
              setValues(dest.config)
              setSecrets({})
              setAccount(dest.account)
              setResult(null)
              setOpen(true)
            }}
          >
            {dest.connected ? 'Edit' : 'Connect'}
          </Button>
        </XStack>
      )}
    </Card>
  )
}

/**
 * The org's server-side destinations. Org-scoped, not per-site — the header says so,
 * because every other surface on this page is per-site and the difference decides where
 * a write lands.
 */
export function TagDestinations(_props: { params: Record<string, string> }) {
  const router = useRouter()
  const [state, setState] = useState<Async<Destination[]>>({ phase: 'loading' })

  const load = useCallback(() => {
    setState({ phase: 'loading' })
    DestinationsApi.list()
      .then((data) => setState({ phase: 'ready', data }))
      .catch((e) => setState({ phase: 'error', error: classifyBackend(e) }))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const header = (
    <PageHeader
      title="Destinations"
      subtitle="Server-side conversions for the whole organization. Each carries the same event_id as the browser pixel, so the platform dedupes the pair."
      actions={
        <XStack gap="$2">
          <Button size="$3" icon={<RefreshCw size={15} />} aria-label="Refresh" onPress={load} />
          <Button size="$3" icon={<Tag size={15} />} onPress={() => router.push('/tags')}>
            Site tags
          </Button>
        </XStack>
      }
    />
  )

  if (state.phase === 'error') {
    return (
      <>
        {header}
        <BackendStateCard state={state.error} onRetry={load} hint="endpoint · GET /v1/destinations" />
      </>
    )
  }

  if (state.phase === 'loading') {
    return (
      <>
        {header}
        <XStack p="$6" justify="center">
          <Spinner size="small" color="$color11" />
        </XStack>
      </>
    )
  }

  if (state.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Plug}
          title="No destinations available"
          description="This deployment forwards to no conversion platforms yet. Browser pixels still work — set them per site."
          primary={{ label: 'Site tags', onPress: () => router.push('/tags') }}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <XStack gap="$4" flexWrap="wrap" items="flex-start">
        {state.data.map((d) => (
          <YStack key={d.platform} flex={1} minW={320}>
            <DestinationCard dest={d} onChanged={load} />
          </YStack>
        ))}
      </XStack>
    </>
  )
}
