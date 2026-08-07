'use client'

/**
 * New deployment — pick a repo, a host, and env, then ship.
 *
 * Two destinations behind one form, because "deploy this repo" is one intent:
 *  - APP  → `POST /v1/platform/projects/:project/apps` (201, `status: "draft"`)
 *           then `POST …/apps/:app/deploy` (202). Creating an app does NOT start
 *           it, so a form that stopped at 201 would report success over a thing
 *           that never ran. Both calls are made, and a failure names its step.
 *  - SITE → `POST /v1/platform/sites` (201). A static build is published by an
 *           upload or a git deploy afterwards, so this creates the target and the
 *           board shows it as `draft` until something is published to it.
 *
 * Env values are typed here and POSTed straight to cloud. They are never logged,
 * never persisted by the browser, and never read back into this form — cloud
 * masks a sealed value on read, so re-submitting what a read returned would blank
 * it. That is why this form only CREATES env and has no edit mode.
 *
 * Secrecy is DECLARED per variable, not guessed. Every variable is sealed unless
 * the person deploying marks it Public, and the form says exactly that. The
 * earlier version inferred secrecy from the key NAME, which let `STRIPE_SK`,
 * `GH_PAT` and `DB_PASS` through as public while the help text promised they were
 * sealed — a false promise is worse than no promise, so the copy now claims only
 * what THIS form decides: the default, and the mark.
 *
 * It deliberately does NOT promise that cloud re-seals a Public value whose shape
 * looks like a credential. That server-side check is not deployed yet, and a
 * safety net described before it exists is the same defect in a new place — it
 * invites someone to mark a credential Public believing something downstream will
 * catch it. Restore that sentence when the backend seal actually ships.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Text, XStack, YStack } from '@hanzo/gui'
import { Rocket } from '@hanzogui/lucide-icons-2'

import { PaasApi, type PaasProject } from '~/lib/api/paas'
import { PlatformSitesApi, SITE_FRAMEWORKS } from '~/lib/api/platform-sites'
import { FieldRow, FieldText, FieldTextArea, PrimaryButton } from '@hanzo/ui/product'
import { FieldOptionSelect } from '~/components/ui/Field'
import {
  envVars,
  formError,
  prunePublicKeys,
  repoName,
  toAppInput,
  toSiteInput,
  type DeployForm,
} from '~/lib/deploy/board'
import { interpretPlatformError, PlatformStateCard, type PlatformError } from '../platform/state'

const EMPTY: DeployForm = {
  kind: 'app',
  name: '',
  repo: '',
  branch: '',
  host: '',
  env: '',
  publicKeys: [],
  framework: 'static',
}

export function NewDeploy({ onCancel, onDeployed }: { onCancel: () => void; onDeployed: () => void }) {
  const [form, setForm] = useState<DeployForm>(EMPTY)
  const [projects, setProjects] = useState<PaasProject[]>([])
  const [project, setProject] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<PlatformError | null>(null)
  // Validation stays quiet until something has been typed — an untouched form is
  // incomplete, not wrong.
  const [touched, setTouched] = useState(false)

  // Any edit counts as touched: the reason a disabled Deploy button is disabled
  // must appear as soon as someone starts filling the form, not only once they
  // happen to touch the repo field.
  const set = (patch: Partial<DeployForm>) => {
    setTouched(true)
    setForm((f) => {
      const next = { ...f, ...patch }
      // Editing the env text re-derives which marks still have a variable, so a
      // Public mark can never outlive the line it was made on and be inherited by
      // a later variable that happens to reuse the name.
      if (patch.env !== undefined) next.publicKeys = prunePublicKeys(next.env ?? '', next.publicKeys ?? [])
      return next
    })
  }

  useEffect(() => {
    let live = true
    PaasApi.listProjects()
      .then((p) => {
        if (!live) return
        setProjects(p)
        setProject((cur) => cur || p[0]?.slug || '')
      })
      .catch(() => live && setProjects([]))
    return () => {
      live = false
    }
  }, [])

  const problem = useMemo(() => formError(form, project || null), [form, project])

  /** The variables as they will be SENT — each carrying its sealed/public state. */
  const vars = useMemo(() => envVars(form), [form])

  /**
   * Name (or un-name) a key as public. Only keys the person opened are listed —
   * and `set` prunes that list on every env edit, so a mark cannot outlive its
   * line: delete a variable and its mark goes with it, so a later variable
   * reusing the name arrives sealed like any other.
   */
  const markPublic = (key: string, isPublic: boolean) =>
    set({
      publicKeys: isPublic
        ? [...new Set([...(form.publicKeys ?? []), key])]
        : (form.publicKeys ?? []).filter((k) => k !== key),
    })

  const submit = async () => {
    setTouched(true)
    if (problem) return
    setBusy(true)
    setFailure(null)
    try {
      if (form.kind === 'site') {
        await PlatformSitesApi.create(toSiteInput(form))
      } else {
        // `project` is non-empty here by `formError`; that is the contract between
        // the two, not an assumption about the fetch above.
        const app = await PaasApi.createApp(project, toAppInput(form))
        await PaasApi.deploy(project, app.slug)
      }
      onDeployed()
    } catch (e) {
      setFailure(interpretPlatformError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$4" gap="$3.5" data-testid="new-deploy">
      <XStack items="center" gap="$2">
        <Rocket size={16} color="$color10" />
        <Text fontSize="$5" fontWeight="600" color="$color12">
          New deployment
        </Text>
      </XStack>

      <FieldRow label="Type">
        <XStack gap="$2">
          {(['app', 'site'] as const).map((k) => (
            <Button
              key={k}
              size="$2"
              bg={form.kind === k ? '$color5' : 'transparent'}
              borderWidth={1}
              borderColor="$borderColor"
              aria-pressed={form.kind === k}
              onPress={() => set({ kind: k })}
            >
              {k === 'app' ? 'App' : 'Static site'}
            </Button>
          ))}
        </XStack>
      </FieldRow>

      {form.kind === 'app' ? (
        <FieldRow label="Project">
          <FieldOptionSelect
            value={project}
            options={projects.map((p) => ({ value: p.slug, label: p.name || p.slug }))}
            placeholder={projects.length ? 'Select a project' : 'No projects yet'}
            onChange={setProject}
          />
        </FieldRow>
      ) : null}

      <FieldRow label={form.kind === 'app' ? 'Repository' : 'Repository (optional)'}>
        <FieldText
          value={form.repo}
          placeholder="https://git.hanzo.ai/hanzoai/console.git"
          onChange={(v) => {
            // The name follows the repo until it is edited by hand; once the two
            // differ, typing a URL stops overwriting a deliberate name.
            const derived = repoName(form.repo)
            set({ repo: v, ...(form.name === '' || form.name === derived ? { name: repoName(v) } : {}) })
          }}
        />
      </FieldRow>

      <FieldRow label="Name">
        <FieldText value={form.name} placeholder="console" onChange={(v) => set({ name: v })} />
      </FieldRow>

      <FieldRow label="Branch">
        <FieldText value={form.branch ?? ''} placeholder="main" onChange={(v) => set({ branch: v })} />
      </FieldRow>

      {form.kind === 'site' ? (
        <FieldRow label="Framework">
          <FieldOptionSelect
            value={form.framework ?? 'static'}
            options={SITE_FRAMEWORKS.map((f) => ({ value: f, label: f }))}
            onChange={(v) => set({ framework: v })}
          />
        </FieldRow>
      ) : (
        <>
          <FieldRow label="Custom host">
            <YStack gap="$1.5">
              <FieldText
                value={form.host ?? ''}
                placeholder="app.example.com"
                onChange={(v) => set({ host: v })}
              />
              <Text fontSize="$1" color="$color10">
                Optional — every app is born with a host on hanzo.app. A custom host stays pending until you
                prove ownership with the DNS record shown under Domains.
              </Text>
            </YStack>
          </FieldRow>

          <FieldRow label="Environment">
            <YStack gap="$2">
              <FieldTextArea value={form.env ?? ''} rows={4} onChange={(v) => set({ env: v })} />
              <Text fontSize="$1" color="$color10">
                One KEY=VALUE per line. Every variable is <Text fontWeight="600">sealed by default</Text> — mark
                one Public to keep it readable later. A sealed value is masked on read, so this form can set one
                but never read one back.
              </Text>

              {vars.length ? (
                <YStack
                  borderWidth={1}
                  borderColor="$borderColor"
                  rounded="$4"
                  overflow="hidden"
                  data-testid="env-vars"
                >
                  {vars.map((v, i) => (
                    <XStack
                      key={v.key}
                      items="center"
                      justify="space-between"
                      gap="$3"
                      px="$3"
                      py="$2"
                      flexWrap="wrap"
                      borderTopWidth={i === 0 ? 0 : 1}
                      borderColor="$borderColor"
                    >
                      <Text fontSize="$2" color="$color12" numberOfLines={1} className="hz-mono" flex={1} minW={0}>
                        {v.key}
                      </Text>
                      <XStack gap="$1.5">
                        {(
                          [
                            ['Sealed', true],
                            ['Public', false],
                          ] as const
                        ).map(([label, sealed]) => (
                          <Button
                            key={label}
                            size="$1"
                            bg={v.secret === sealed ? '$color5' : 'transparent'}
                            borderWidth={1}
                            borderColor="$borderColor"
                            aria-pressed={v.secret === sealed}
                            aria-label={`${v.key} ${label}`}
                            onPress={() => markPublic(v.key, !sealed)}
                          >
                            {label}
                          </Button>
                        ))}
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              ) : null}
            </YStack>
          </FieldRow>
        </>
      )}

      {failure ? <PlatformStateCard error={failure} /> : null}

      <XStack gap="$2" items="center" flexWrap="wrap">
        <PrimaryButton disabled={busy || !!problem} onPress={() => void submit()}>
          {busy ? 'Deploying…' : 'Deploy'}
        </PrimaryButton>
        <Button disabled={busy} onPress={onCancel}>
          Cancel
        </Button>
        {touched && problem ? (
          <Text fontSize="$2" color="$color11" role="alert">
            {problem}
          </Text>
        ) : null}
      </XStack>
    </Card>
  )
}
