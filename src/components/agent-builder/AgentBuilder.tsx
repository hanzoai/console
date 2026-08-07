'use client'

/**
 * AgentBuilder — the CANONICAL, shareable Hanzo agent builder.
 *
 * ONE builder, one and only one way to define an agent (name · model · prompt ·
 * tools · description), used by every surface. It is self-contained and injected:
 * the host passes `AgentBuilderLoaders` (the live model catalog, the saved-prompt
 * library, a prompt-body fetch, and the create effect) — the builder owns the form,
 * the LIVE dropdowns, validation, and the honest states, but knows NOTHING about
 * any host's API client. That is what lets console2, chat, app, bot, and team all
 * import this exact component over the SAME backend (`POST /v1/agents`, org
 * resolved server-side from the caller's bearer) instead of each rebuilding a form.
 *
 * Dynamic by construction:
 *   - Model  → a ComboBox: type any id OR pick from the LIVE `/v1/models` catalog.
 *   - Prompt → a selector of the org's saved prompts (fills the system prompt), with
 *              a "Custom" option for free text — "the system prompt is selectable
 *              from saved prompts OR typed".
 *   - Tools  → a ComboBox with the live tool catalog, added as chips (typeable too).
 *   - Advanced → the hanzo.chat power-user generation config (temperature · top-p ·
 *              top-k · reasoning effort · use-tools · web-search · thinking · stream),
 *              folded into the ONE builder. Hidden by default; any knob left at its
 *              default is pruned, so opening it never changes a simple agent's body.
 * Every option set is REAL (from a loader) or the field degrades to typeable — never
 * a fabricated model/prompt/tool. This is the SUPERSET builder: console2's decoupled
 * injected-loader seam + hanzo.chat's advanced config — one component, both surfaces.
 *
 * Deps: only `@hanzo/gui`, the shared `ComboBox`/`Field` UI primitives, and this
 * module's own `./types`/`./logic`. No `~/lib/api` — so it lifts cleanly into
 * `@hanzo/agent-builder`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { Bot, Plus, Terminal, X } from '@hanzogui/lucide-icons-2'

import {
  canSubmit,
  classifyBuilderError,
  defaultConfig,
  defaultModel,
  emptySpec,
  promptBodyFromRow,
  promptOptions,
  toCreateBody,
} from './logic'
import type { AgentBuilderLoaders, AgentConfig, AgentSpec, BuilderOption, BuilderPrompt, ReasoningEffort } from './types'
import { ComboBox, FieldRow, FieldSelect, FieldSlider, FieldSwitch, FieldText, FieldTextArea, SelectMenu, type ComboOption, type SelectOption } from '@hanzo/ui/product'

/** Async option-list state for the live pickers (model/tool). */
type OptState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; options: BuilderOption[] }

const CUSTOM = '__custom__'

export function AgentBuilder({
  loaders,
  initial,
  onCreated,
  onCancel,
  submitLabel = 'Create agent',
}: {
  loaders: AgentBuilderLoaders
  /**
   * A spec to start from — a template's preset, or what a description drafted.
   * Read ONCE, at mount: the form is the user's from that point on, so a seed can
   * never overwrite something they have already typed. A host that swaps seeds
   * (the quickstart, when a different template is picked) remounts with a `key`,
   * which states the intent — a new starting point — instead of hiding it in an
   * effect that races the user's keystrokes.
   */
  initial?: Partial<AgentSpec>
  /**
   * Called after a successful create, with the NAME the agent was created under
   * (the handle every `/v1/agents/:ref` route is keyed by) so the host can go
   * straight to running it rather than looking it back up.
   */
  onCreated: (name: string) => void
  /** Called when the user cancels (optional — omit for an always-open form). */
  onCancel?: () => void
  submitLabel?: string
}) {
  const [spec, setSpec] = useState<AgentSpec>(() => ({ ...emptySpec(), ...initial }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const [models, setModels] = useState<OptState>({ phase: 'idle' })
  const [tools, setTools] = useState<OptState>({ phase: 'idle' })
  const [prompts, setPrompts] = useState<BuilderPrompt[] | null>(null)
  const [promptPick, setPromptPick] = useState<string | null>(null)

  const set = <K extends keyof AgentSpec>(k: K, v: AgentSpec[K]) => setSpec((s) => ({ ...s, [k]: v }))

  // Advanced generation config — bound lazily to `spec.config ?? defaultConfig()`;
  // a knob left at its default is pruned by `toCreateBody`, so a simple agent still
  // posts no `config`. Functional update = no stale-closure read.
  const [advanced, setAdvanced] = useState(false)
  const cfg = spec.config ?? defaultConfig()
  const setCfg = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) =>
    setSpec((s) => ({ ...s, config: { ...(s.config ?? defaultConfig()), [k]: v } }))

  // Preselect a Zen default ONLY if the user hasn't typed a model yet — refs so the
  // loader doesn't re-run on every keystroke.
  const specRef = useRef(spec)
  specRef.current = spec

  const loadModels = useCallback(() => {
    if (!loaders.loadModels) return
    setModels({ phase: 'loading' })
    loaders
      .loadModels()
      .then((options) => {
        setModels({ phase: 'ready', options })
        if (!specRef.current.model) {
          const d = defaultModel(options)
          if (d) set('model', d)
        }
      })
      .catch((e) => setModels({ phase: 'error', message: msg(e) }))
  }, [loaders])

  const loadTools = useCallback(() => {
    if (!loaders.loadTools) return
    setTools({ phase: 'loading' })
    loaders
      .loadTools()
      .then((options) => setTools({ phase: 'ready', options }))
      .catch((e) => setTools({ phase: 'error', message: msg(e) }))
  }, [loaders])

  useEffect(() => {
    loadModels()
    loadTools()
    if (loaders.loadPrompts) {
      loaders
        .loadPrompts()
        .then((rows) => setPrompts(rows))
        .catch(() => setPrompts([])) // prompts optional — hide the selector on failure
    } else {
      setPrompts([])
    }
  }, [loadModels, loadTools, loaders])

  // ── Prompt selector: pick a saved prompt → fill systemPrompt (Custom = free) ──
  const onPickPrompt = async (name: string | null) => {
    setPromptPick(name)
    if (!name || name === CUSTOM) return // Custom → leave the textarea as the user's own
    const inline = promptBodyFromRow(prompts ?? [], name)
    if (inline != null) {
      set('systemPrompt', inline)
      return
    }
    if (loaders.loadPromptBody) {
      try {
        const body = await loaders.loadPromptBody(name)
        set('systemPrompt', body)
      } catch {
        // couldn't fetch the body — keep whatever's typed; the pick still records intent
      }
    }
  }

  // ── Tools as chips ────────────────────────────────────────────────────────
  const [toolDraft, setToolDraft] = useState('')
  const addTool = (v: string) => {
    const t = v.trim()
    if (t && !spec.tools.includes(t)) set('tools', [...spec.tools, t])
    setToolDraft('')
  }
  const removeTool = (t: string) => set('tools', spec.tools.filter((x) => x !== t))

  const submit = async () => {
    if (!canSubmit(spec) || busy) return
    setBusy(true)
    setError(null)
    setUnavailable(false)
    try {
      const body = toCreateBody(spec)
      await loaders.createAgent(body)
      onCreated(body.name)
    } catch (e) {
      const c = classifyBuilderError(e)
      if (c.kind === 'unavailable') setUnavailable(true)
      else setError(c.message)
    } finally {
      setBusy(false)
    }
  }

  const modelOptions: ComboOption[] = models.phase === 'ready' ? models.options : []
  const toolOptions: ComboOption[] = tools.phase === 'ready' ? tools.options : []
  const promptSelectOptions: SelectOption<string>[] = [
    { key: CUSTOM, label: 'Custom (type your own)' },
    ...promptOptions(prompts ?? []).map((o) => ({ key: o.value, label: o.label ?? o.value })),
  ]

  return (
    <YStack gap="$3">
      <Text fontSize="$2" color="$color11">
        An agent is a model, a system prompt, and a set of tools that runs on Hanzo compute and calls your APIs on
        its own.
      </Text>

      <FieldRow label="Name">
        <FieldText value={spec.name} onChange={(v) => set('name', v)} placeholder="support-triage" />
      </FieldRow>

      <FieldRow label="Model">
        <ComboBox
          value={spec.model}
          onChange={(v) => set('model', v)}
          options={modelOptions}
          loading={models.phase === 'loading'}
          error={models.phase === 'error' ? `Model catalog unavailable — type a model id. (${models.message})` : null}
          onRetry={loadModels}
          // A placeholder is an example, and an example that does not exist is a lie
          // the user only discovers at the agent's first run. These are ids the live
          // catalog actually serves; the field itself offers the real list.
          placeholder="zen5 · zen5-mini · claude-sonnet-5"
        />
      </FieldRow>

      {/* Prompt selector — only when a prompt library is wired + has entries. */}
      {prompts && prompts.length > 0 ? (
        <FieldRow label="Load prompt">
          <SelectMenu
            options={promptSelectOptions}
            value={promptPick}
            onChange={(v) => void onPickPrompt(v)}
            allLabel="Custom (type your own)"
            minWidth={240}
          />
        </FieldRow>
      ) : null}

      <FieldRow label="System prompt">
        <FieldTextArea
          value={spec.systemPrompt}
          onChange={(v) => {
            set('systemPrompt', v)
            if (promptPick && promptPick !== CUSTOM) setPromptPick(CUSTOM) // editing => now custom
          }}
          rows={6}
        />
      </FieldRow>

      <FieldRow label="Tools">
        <YStack gap="$2">
          <ComboBox
            value={toolDraft}
            onChange={setToolDraft}
            options={toolOptions}
            loading={tools.phase === 'loading'}
            error={tools.phase === 'error' ? `Tool catalog unavailable — type a tool id.` : null}
            onRetry={loadTools}
            // No invented examples here either: the tool plane is per-org, so nobody
            // can name a tool that is certain to exist. The field offers what the org
            // has actually activated, and stays typeable for what it has not.
            placeholder={
              tools.phase === 'ready' && tools.options.length === 0
                ? 'No tools activated yet — type one to use it anyway'
                : 'Search your tools'
            }
            emptyText="Press Add to include what you typed."
          />
          <XStack gap="$2">
            <Button size="$2" chromeless icon={<Plus size={14} />} onPress={() => addTool(toolDraft)} disabled={!toolDraft.trim()}>
              Add tool
            </Button>
          </XStack>
          {spec.tools.length > 0 ? (
            <XStack gap="$1.5" flexWrap="wrap">
              {spec.tools.map((t) => (
                <XStack key={t} items="center" gap="$1" px="$2" py="$1" rounded="$3" bg="$color3" borderWidth={1} borderColor="$borderColor">
                  <Text fontSize="$1" color="$color12">
                    {t}
                  </Text>
                  <Button size="$1" chromeless icon={<X size={11} />} onPress={() => removeTool(t)} aria-label={`Remove ${t}`} />
                </XStack>
              ))}
            </XStack>
          ) : null}
        </YStack>
      </FieldRow>

      <FieldRow label="Description">
        <FieldText value={spec.description} onChange={(v) => set('description', v)} placeholder="What this agent does" />
      </FieldRow>

      {/* Advanced generation config — the hanzo.chat power-user knobs, folded into
          the ONE builder. Hidden by default; every value that stays at its default
          is pruned, so opening this never changes what a simple agent posts. */}
      <YStack gap="$2">
        <Button size="$2" chromeless self="flex-start" onPress={() => setAdvanced((a) => !a)}>
          {advanced ? 'Hide advanced settings' : 'Advanced settings'}
        </Button>
        {advanced ? (
          <YStack gap="$3" p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
            <FieldRow label="Temperature">
              <FieldSlider value={cfg.temperature} min={0} max={2} step={0.1} onChange={(v) => setCfg('temperature', v)} />
            </FieldRow>
            <FieldRow label="Top-p">
              <FieldSlider value={cfg.topP} min={0} max={1} step={0.05} onChange={(v) => setCfg('topP', v)} />
            </FieldRow>
            <FieldRow label="Top-k">
              <FieldSlider value={cfg.topK} min={0} max={100} step={1} onChange={(v) => setCfg('topK', v)} />
            </FieldRow>
            <FieldRow label="Reasoning effort">
              <FieldSelect
                value={cfg.reasoningEffort ?? 'default'}
                options={['default', 'low', 'medium', 'high', 'xhigh', 'max', 'ultracode']}
                onChange={(v) => setCfg('reasoningEffort', v === 'default' ? undefined : (v as ReasoningEffort))}
              />
            </FieldRow>
            <FieldRow label="Use tools">
              <FieldSwitch checked={cfg.useTools} onChange={(v) => setCfg('useTools', v)} />
            </FieldRow>
            <FieldRow label="Web search">
              <FieldSwitch checked={cfg.webSearch} onChange={(v) => setCfg('webSearch', v)} />
            </FieldRow>
            <FieldRow label="Thinking">
              <FieldSwitch checked={cfg.thinking} onChange={(v) => setCfg('thinking', v)} />
            </FieldRow>
            <FieldRow label="Stream">
              <FieldSwitch checked={cfg.stream} onChange={(v) => setCfg('stream', v)} />
            </FieldRow>
          </YStack>
        ) : null}
      </YStack>

      {unavailable ? (
        <Card gap="$1.5" p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
          <XStack items="center" gap="$2">
            <Terminal size={14} />
            <Text fontSize="$3" fontWeight="700">
              Agents API isn’t connected on this deployment yet
            </Text>
          </XStack>
          <Text fontSize="$2" color="$color11">
            Your definition wasn’t saved (the `/v1/agents` route isn’t bound here yet). Create with the CLI —{' '}
            <Text fontSize="$1" bg="$color3" px="$1" py="$0.5" rounded="$2">hanzo agents create</Text> — and it appears here once the backend is live.
          </Text>
        </Card>
      ) : null}
      {error ? (
        <Text fontSize="$2" color="$red10">
          {error}
        </Text>
      ) : null}

      <XStack gap="$2" pt="$1">
        {onCancel ? (
          <Button flex={1} chromeless onPress={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button
          flex={1}
          theme="light"
          icon={busy ? undefined : <Bot size={15} />}
          onPress={() => void submit()}
          disabled={!canSubmit(spec) || busy}
        >
          {busy ? <Spinner size="small" /> : submitLabel}
        </Button>
      </XStack>
    </YStack>
  )
}

const msg = (e: unknown): string =>
  e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'unavailable'
