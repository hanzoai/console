'use client'

/**
 * AgentQuickstart — the guided way into the ONE builder: describe an agent in your
 * own words or start from a template, configure it, run it, and take the call away.
 *
 * FOUR STEPS, AND EVERY ONE IS A REAL CALL. That is the whole design constraint. A
 * ladder of steps is a promise about what happens; a step that only draws a checkmark
 * turns the promise into decoration. So:
 *
 *   1 Describe   → `POST /v1/chat/completions` drafts a spec from a sentence
 *                  (`draftAgent`), or a template fills the form with a preset
 *   2 Configure  → the SAME `AgentBuilder` every other surface uses, seeded
 *   3 Run        → `POST /v1/agents/:ref/run` executes it and shows the recorded run
 *   4 Integrate  → the request that just worked, as code
 *
 * Steps 1 and 3 are OPTIONAL by construction: their loaders (`draftAgent`, `runAgent`)
 * may be absent, and the step then says exactly what is missing instead of miming it.
 * Step 2 is the only one that cannot be skipped, because creating the agent is the
 * point and the builder is the one thing that does it.
 *
 * Host-agnostic like the rest of the module: everything arrives through
 * `AgentBuilderLoaders`, so chat, app and bot mount this over the same `/v1/agents`.
 */
import { useMemo, useState } from 'react'
import { Button, Card, Input, ScrollView, Spinner, Text, TextArea, XStack, YStack } from '@hanzo/gui'
import { ArrowRight, Bot, Check, Play, Search, Terminal, X } from '@hanzogui/lucide-icons-2'

import { AgentBuilder } from './AgentBuilder'
import { defaultConfig, emptySpec, proposeName } from './logic'
import { AGENT_TEMPLATES, searchTemplates, specFromTemplate, type AgentTemplate } from './templates'
import type { AgentBuilderLoaders, AgentRunResult, AgentSpec } from './types'

/** The four steps, in order. The id is what the component switches on. */
const STEPS = [
  { id: 'describe', label: 'Describe', endpoint: 'POST /v1/agents' },
  { id: 'configure', label: 'Configure', endpoint: '' },
  { id: 'run', label: 'Run', endpoint: 'POST /v1/agents/:ref/run' },
  { id: 'integrate', label: 'Integrate', endpoint: '' },
] as const

type StepId = (typeof STEPS)[number]['id']

/**
 * The step ladder. A step reached earlier is a real link back — going back to change
 * the prompt is the most common thing a person wants here, and a ladder you cannot
 * climb down is a worse version of a heading.
 */
function StepLadder({ current, onGo }: { current: StepId; onGo: (s: StepId) => void }) {
  const index = STEPS.findIndex((s) => s.id === current)
  return (
    <XStack items="center" gap="$2" flexWrap="wrap" role="list" aria-label="Quickstart steps">
      {STEPS.map((s, i) => {
        const done = i < index
        const active = i === index
        return (
          <XStack key={s.id} items="center" gap="$2" role="listitem">
            {i > 0 ? <XStack width={20} height={1} bg="$borderColor" $md={{ width: 32 }} /> : null}
            <Button
              size="$2"
              chromeless
              px="$2"
              disabled={i > index}
              onPress={() => onGo(s.id)}
              opacity={i > index ? 0.45 : 1}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s.label}${done ? ' (done)' : ''}`}
            >
              <XStack items="center" gap="$2">
                <XStack
                  width={20}
                  height={20}
                  rounded="$10"
                  items="center"
                  justify="center"
                  bg={done || active ? '$color12' : 'transparent'}
                  borderWidth={done || active ? 0 : 1}
                  borderColor="$borderColor"
                >
                  {done ? (
                    <Check size={12} color="$color1" />
                  ) : (
                    <Text fontSize="$1" fontWeight="700" color={active ? '$color1' : '$color10'}>
                      {i + 1}
                    </Text>
                  )}
                </XStack>
                <Text fontSize="$2" fontWeight={active ? '700' : '500'} color={active ? '$color12' : '$color10'}>
                  {s.label}
                </Text>
                {active && s.endpoint ? (
                  <Text fontSize="$1" color="$color9" fontFamily="$mono" display="none" $md={{ display: 'flex' }}>
                    {s.endpoint}
                  </Text>
                ) : null}
              </XStack>
            </Button>
          </XStack>
        )
      })}
    </XStack>
  )
}

/** One template card in the gallery. The whole card is the control. */
function TemplateCard({ template, onPick }: { template: AgentTemplate; onPick: () => void }) {
  return (
    <YStack
      onPress={onPick}
      cursor="pointer"
      role="button"
      tabIndex={0}
      focusable
      onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault?.()
          onPick()
        }
      }}
      gap="$1.5"
      p="$3"
      rounded="$4"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$color2"
      hoverStyle={{ bg: '$color3', borderColor: '$color8' }}
      aria-label={`Start from ${template.title}`}
    >
      <Text fontSize="$3" fontWeight="700" color="$color12">
        {template.title}
      </Text>
      <Text fontSize="$2" color="$color11">
        {template.summary}
      </Text>
    </YStack>
  )
}

/** A short, quiet note — used wherever a step has to say what is missing. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="$2" color="$color10">
      {children}
    </Text>
  )
}

export function AgentQuickstart({
  loaders,
  onFinished,
  apiBase = 'https://api.hanzo.ai',
}: {
  loaders: AgentBuilderLoaders
  /** Called when the user leaves the quickstart with an agent created (host reloads). */
  onFinished?: (name: string) => void
  /** The API origin the integrate snippet should show. */
  apiBase?: string
}) {
  const [step, setStep] = useState<StepId>('describe')
  const [seed, setSeed] = useState<Partial<AgentSpec>>({})
  // Bumped whenever a NEW starting point is chosen, so the builder remounts on it
  // rather than an effect racing whatever the user has already typed.
  const [seedKey, setSeedKey] = useState(0)
  const [created, setCreated] = useState<string | null>(null)

  // ── Step 1: describe ──────────────────────────────────────────────────────
  const [description, setDescription] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const templates = useMemo(() => searchTemplates(query), [query])

  const start = (next: Partial<AgentSpec>) => {
    setSeed(next)
    setSeedKey((k) => k + 1)
    setStep('configure')
  }

  const pickTemplate = (t: AgentTemplate) => start(specFromTemplate(t, emptySpec(), defaultConfig()))

  const describe = async () => {
    const text = description.trim()
    if (!text || drafting) return
    // Whatever happens next, the user's own words are already worth something: they
    // are the description, and they propose the handle. A draft only ever ADDS to
    // this, so a failed or absent draft still lands them in a part-filled form.
    const fallback: Partial<AgentSpec> = { description: text, name: proposeName(text) }
    if (!loaders.draftAgent) {
      start(fallback)
      return
    }
    setDrafting(true)
    setDraftError(null)
    try {
      const drafted = await loaders.draftAgent(text)
      start({ ...fallback, ...drafted })
    } catch (e) {
      // Say why, and still go — being stranded on a spinner is worse than writing
      // the prompt yourself.
      setDraftError(e instanceof Error ? e.message : 'Could not draft this one — write the prompt yourself.')
      start(fallback)
    } finally {
      setDrafting(false)
    }
  }

  // ── Step 3: run ───────────────────────────────────────────────────────────
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<AgentRunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const doRun = async () => {
    const text = input.trim()
    if (!text || !created || !loaders.runAgent || running) return
    setRunning(true)
    setRunError(null)
    setRun(null)
    try {
      setRun(await loaders.runAgent(created, text))
    } catch (e) {
      // A failed run answers 502 with the RUN as its body, so this message is the
      // run's own reason — not a generic transport failure.
      setRunError(e instanceof Error ? e.message : 'The run did not complete.')
    } finally {
      setRunning(false)
    }
  }

  const snippet = useMemo(
    () =>
      [
        `curl ${apiBase}/v1/agents/${created ?? 'your-agent'}/run \\`,
        `  -H "Authorization: Bearer $HANZO_API_KEY" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"input":"${(input.trim() || 'your message here').replace(/'/g, "'\\''").replace(/"/g, '\\"')}"}'`,
      ].join('\n'),
    [apiBase, created, input],
  )

  return (
    <YStack gap="$4">
      <StepLadder current={step} onGo={setStep} />

      {/* ── 1 · Describe ─────────────────────────────────────────────────── */}
      {step === 'describe' ? (
        <XStack gap="$4" items="flex-start" flexWrap="wrap">
          <YStack flex={2} minW={320} gap="$3" py="$6">
            <YStack gap="$2" items="center" py="$4">
              <Text fontSize="$8" fontWeight="800" color="$color12" style={{ textAlign: 'center' }}>
                What do you want to build?
              </Text>
              <Text fontSize="$3" color="$color11" style={{ textAlign: 'center' }}>
                Describe your agent, or start from a template.
              </Text>
            </YStack>

            <YStack
              bg="$color2"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$7"
              px="$3"
              py="$2.5"
              gap="$2"
              data-field-box
            >
              <XStack gap="$2" items="flex-end">
                <TextArea
                  flex={1}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your agent…"
                  numberOfLines={3}
                  disabled={drafting}
                  borderWidth={0}
                  bg="transparent"
                  px="$1"
                  py="$1"
                  aria-label="Describe your agent"
                  // Enter sends, Shift+Enter is a newline, and a key mid-IME-composition
                  // is never a send — an open candidate window must not submit the turn.
                  onKeyDown={(e) => {
                    const ev = e as unknown as {
                      key?: string
                      shiftKey?: boolean
                      preventDefault?: () => void
                      nativeEvent?: { isComposing?: boolean }
                    }
                    if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent?.isComposing) {
                      ev.preventDefault?.()
                      void describe()
                    }
                  }}
                />
                <Button
                  size="$2"
                  circular
                  theme="light"
                  disabled={!description.trim() || drafting}
                  onPress={() => void describe()}
                  icon={drafting ? undefined : <ArrowRight size={16} />}
                  aria-label="Draft this agent"
                >
                  {drafting ? <Spinner size="small" /> : undefined}
                </Button>
              </XStack>
            </YStack>

            {!loaders.draftAgent ? (
              <Note>
                Drafting isn’t connected here, so your words become the agent’s description and handle and you
                write the prompt in the next step.
              </Note>
            ) : null}
            {draftError ? (
              <Text fontSize="$2" color="$red10">
                {draftError}
              </Text>
            ) : null}
          </YStack>

          {/* Templates — a real gallery, searchable, each card a preset the builder
              can already express. */}
          <YStack flex={1} minW={280} gap="$2.5" p="$3" rounded="$5" borderWidth={1} borderColor="$borderColor">
            <Text fontSize="$4" fontWeight="700" color="$color12">
              Browse templates
            </Text>
            <XStack
              items="center"
              gap="$2"
              px="$2.5"
              height={34}
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$color2"
              data-field-box
            >
              <Search size={14} opacity={0.6} />
              <Input
                flex={1}
                unstyled
                value={query}
                onChangeText={setQuery}
                placeholder="Search templates"
                fontSize="$3"
                color="$color12"
                autoCapitalize="none"
                autoCorrect={false}
                aria-label="Search templates"
              />
              {query ? (
                <Button size="$1" chromeless icon={<X size={13} />} onPress={() => setQuery('')} aria-label="Clear search" />
              ) : null}
            </XStack>
            <ScrollView maxH={520}>
              <YStack gap="$2">
                {templates.map((t) => (
                  <TemplateCard key={t.id} template={t} onPick={() => pickTemplate(t)} />
                ))}
                {templates.length === 0 ? (
                  <Note>No template matches “{query.trim()}”. Describe it instead — that always works.</Note>
                ) : null}
              </YStack>
            </ScrollView>
          </YStack>
        </XStack>
      ) : null}

      {/* ── 2 · Configure ────────────────────────────────────────────────── */}
      {step === 'configure' ? (
        <YStack gap="$3" maxW={720}>
          <AgentBuilder
            key={seedKey}
            loaders={loaders}
            initial={seed}
            onCancel={() => setStep('describe')}
            onCreated={(name) => {
              setCreated(name)
              setStep('run')
              onFinished?.(name)
            }}
          />
        </YStack>
      ) : null}

      {/* ── 3 · Run ──────────────────────────────────────────────────────── */}
      {step === 'run' && created ? (
        <YStack gap="$3" maxW={720}>
          <XStack items="center" gap="$2">
            <Bot size={16} />
            <Text fontSize="$5" fontWeight="800" color="$color12">
              {created}
            </Text>
            <Text fontSize="$2" color="$color10">
              is live
            </Text>
          </XStack>
          <Text fontSize="$2" color="$color11">
            Send it something. This runs the agent for real and bills the run to your organization.
          </Text>

          {loaders.runAgent ? (
            <>
              <YStack
                bg="$color2"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$5"
                px="$3"
                py="$2.5"
                data-field-box
              >
                <XStack gap="$2" items="flex-end">
                  <TextArea
                    flex={1}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Your message to the agent…"
                    numberOfLines={3}
                    disabled={running}
                    borderWidth={0}
                    bg="transparent"
                    px="$1"
                    py="$1"
                    aria-label="Message to the agent"
                    onKeyDown={(e) => {
                      const ev = e as unknown as {
                        key?: string
                        shiftKey?: boolean
                        preventDefault?: () => void
                        nativeEvent?: { isComposing?: boolean }
                      }
                      if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent?.isComposing) {
                        ev.preventDefault?.()
                        void doRun()
                      }
                    }}
                  />
                  <Button
                    size="$2"
                    theme="light"
                    disabled={!input.trim() || running}
                    onPress={() => void doRun()}
                    icon={running ? undefined : <Play size={15} />}
                  >
                    {running ? <Spinner size="small" /> : 'Run'}
                  </Button>
                </XStack>
              </YStack>

              {runError ? (
                <Card gap="$1.5" p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
                  <Text fontSize="$3" fontWeight="700" color="$red10">
                    The run failed
                  </Text>
                  <Text fontSize="$2" color="$color11">
                    {runError}
                  </Text>
                </Card>
              ) : null}

              {run ? (
                <Card gap="$2" p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
                  <XStack items="center" gap="$2" flexWrap="wrap">
                    <Text fontSize="$2" fontWeight="700" color={run.status === 'ok' ? '$green10' : '$red10'}>
                      {run.status === 'ok' ? 'ok' : run.status || 'error'}
                    </Text>
                    {run.model ? (
                      <Text fontSize="$1" color="$color10">
                        {run.model}
                      </Text>
                    ) : null}
                    {run.durationMs != null ? (
                      <Text fontSize="$1" color="$color10">
                        {run.durationMs} ms
                      </Text>
                    ) : null}
                  </XStack>
                  <Text fontSize="$3" color="$color12">
                    {run.output || run.error || 'The run recorded no output.'}
                  </Text>
                </Card>
              ) : null}
            </>
          ) : (
            <Card gap="$1.5" p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
              <XStack items="center" gap="$2">
                <Terminal size={14} />
                <Text fontSize="$3" fontWeight="700" color="$color12">
                  Running from here isn’t connected on this deployment
                </Text>
              </XStack>
              <Text fontSize="$2" color="$color11">
                The agent exists and `POST /v1/agents/{created}/run` is its endpoint — the next step shows the
                call.
              </Text>
            </Card>
          )}

          <XStack gap="$2">
            <Button flex={1} theme="light" iconAfter={<ArrowRight size={15} />} onPress={() => setStep('integrate')}>
              Integrate
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {/* ── 4 · Integrate ────────────────────────────────────────────────── */}
      {step === 'integrate' && created ? (
        <YStack gap="$3" maxW={720}>
          <Text fontSize="$5" fontWeight="800" color="$color12">
            Call it from your code
          </Text>
          <Text fontSize="$2" color="$color11">
            The same request the Run step just made. Mint a key under API keys and set it as `HANZO_API_KEY`.
          </Text>
          <YStack p="$3" rounded="$4" bg="$color2" borderWidth={1} borderColor="$borderColor">
            <Text fontSize="$2" fontFamily="$mono" color="$color12" style={{ whiteSpace: 'pre-wrap' }}>
              {snippet}
            </Text>
          </YStack>
          <Note>
            It answers with the recorded run — its id, status, model, output and duration. A model failure comes
            back as a run with `status: "error"` and the reason, never as silence.
          </Note>
        </YStack>
      ) : null}
    </YStack>
  )
}
