/**
 * Agent templates — starting points for the ONE builder, shared by every surface.
 *
 * A template is a PRESET, never a promise: every field it carries maps to something
 * `POST /v1/agents` already accepts (`name`, `description`, `systemPrompt`, and the
 * `config` knobs in `AgentConfig`). Picking one fills the builder and nothing else
 * happens — the user still sees, edits and submits the same form, so a template can
 * never create an agent the builder itself could not.
 *
 * Deliberately NO tool ids. Tools come from the live tool plane (`GET /v1/tools`),
 * which knows what an org has actually activated; a hardcoded `web.search` here would
 * name something that may not exist and would fail on the agent's first invocation.
 * What a template CAN say about tools is the truth: `useTools` and `webSearch` are
 * real switches in the agent contract, so a template that needs them turns them on
 * and the builder's live tool picker fills in the specifics.
 *
 * Pure data + pure helpers — no React, no I/O — so this lifts into
 * `@hanzo/agent-builder` with the rest of the module.
 */
import type { AgentConfig, AgentSpec } from './types'

/** A named starting point: what it is, and the spec it fills the builder with. */
export type AgentTemplate = {
  /** Stable id — the URL/search key. */
  id: string
  /** What it is called in the gallery. */
  title: string
  /** One line on what the agent does. Shown on the card and searched. */
  summary: string
  /** The seed handle; the user renames freely before submitting. */
  name: string
  /** The system prompt this template starts from ('' for the blank one). */
  systemPrompt: string
  /** Only the knobs this template genuinely needs; the rest stay at their defaults. */
  config?: Partial<AgentConfig>
}

/**
 * The gallery, in display order. `blank` leads because starting from nothing is the
 * honest default — everything after it is a real, specific job.
 */
export const AGENT_TEMPLATES: readonly AgentTemplate[] = [
  {
    id: 'blank',
    title: 'Blank agent',
    summary: 'A starting point with nothing assumed — name it, pick a model, write the prompt.',
    name: 'my-agent',
    systemPrompt: '',
  },
  {
    id: 'researcher',
    title: 'Deep researcher',
    summary: 'Researches a question across the web and answers with the sources it used.',
    name: 'researcher',
    systemPrompt:
      'You research questions and report what you found.\n\n' +
      'Work in steps: decide what you need to know, search for it, read the results, and only then answer. ' +
      'Prefer primary sources over summaries of them.\n\n' +
      'Every claim that came from a source carries that source. When sources disagree, say so and give both. ' +
      'When you could not find something, say that plainly instead of filling the gap — an honest gap is more ' +
      'useful than a confident guess.',
    config: { webSearch: true, thinking: true, reasoningEffort: 'high' },
  },
  {
    id: 'extractor',
    title: 'Structured extractor',
    summary: 'Reads unstructured text and returns one typed JSON object, or says which fields were absent.',
    name: 'extractor',
    systemPrompt:
      'You turn unstructured text into one JSON object matching the schema the caller gives you.\n\n' +
      'Return the object and nothing else — no prose, no code fence, no explanation.\n\n' +
      'Copy values from the text; never infer one that is not there. A field the text does not support is null, ' +
      'and a guessed value is a defect. If the schema is ambiguous about a field, choose the reading that the ' +
      'text supports literally.',
    config: { temperature: 0, topP: 1 },
  },
  {
    id: 'support',
    title: 'Support answerer',
    summary: 'Answers product questions from your own material, and escalates the ones it cannot.',
    name: 'support',
    systemPrompt:
      'You answer product questions for customers, using the material available to you.\n\n' +
      'Answer from that material only. When it does not cover the question, say so and hand off rather than ' +
      'improvising — a wrong answer costs more than a slow one.\n\n' +
      'Lead with the answer, then the steps. Keep it short enough to act on. Never promise a behaviour, a date ' +
      'or a refund you cannot point to in the material.',
    config: { useTools: true, temperature: 0.3 },
  },
  {
    id: 'reviewer',
    title: 'Code reviewer',
    summary: 'Reads a diff and reports what will actually break, most severe first.',
    name: 'reviewer',
    systemPrompt:
      'You review code changes.\n\n' +
      'Report only defects you can name concretely: the input or state that triggers them, and the wrong output ' +
      'or crash that results. Correctness and security first, then clarity. Rank by severity.\n\n' +
      'Style preferences are not findings. Neither is a concern you cannot demonstrate — if you are unsure a ' +
      'thing is real, say you are unsure rather than listing it as a defect. Finding nothing is a valid review.',
    config: { thinking: true, reasoningEffort: 'high', temperature: 0.2 },
  },
  {
    id: 'analyst',
    title: 'Data analyst',
    summary: 'Explains a dataset — what is in it, what stands out, and what to check next.',
    name: 'analyst',
    systemPrompt:
      'You explain datasets to people who have to make a decision from them.\n\n' +
      'Start with the shape: how many rows, which columns, what period, and what is missing. Then the two or ' +
      'three things that genuinely stand out. Then what you would check next and why.\n\n' +
      'Every number you state comes from the data. Distinguish what the data shows from what you suspect, and ' +
      'name the limits — a sample too small to conclude from is the finding, not an obstacle to one.',
    config: { useTools: true, temperature: 0.2 },
  },
  {
    id: 'summarizer',
    title: 'Meeting summarizer',
    summary: 'Turns a transcript into decisions, owners and the questions still open.',
    name: 'summarizer',
    systemPrompt:
      'You turn meeting transcripts into something the people who missed it can act on.\n\n' +
      'Three sections: decisions made, actions with their owner, and questions left open. Nothing else.\n\n' +
      'Only record a decision that was actually reached — a topic discussed without resolution belongs under ' +
      'open questions. Attribute an action to a person only when the transcript names them; otherwise leave the ' +
      'owner unassigned and say so.',
    config: { temperature: 0.2 },
  },
  {
    id: 'triage',
    title: 'Incident triager',
    summary: 'Classifies an incoming report by severity and area, and drafts the first reply.',
    name: 'triage',
    systemPrompt:
      'You triage incoming incident reports.\n\n' +
      'For each one give: severity, the area it belongs to, what is affected, and a first reply to the reporter.\n\n' +
      'Severity follows blast radius, not tone — a calm report of data loss outranks an urgent one about a ' +
      'typo. When the report lacks what you need to classify it, the first reply asks for exactly that and the ' +
      'severity stays provisional. Never guess an area to avoid leaving one blank.',
    config: { temperature: 0.2, reasoningEffort: 'medium' },
  },
]

/** Case-insensitive, whitespace-tolerant match over the fields a person would type. */
export function matchTemplate(t: AgentTemplate, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${t.title} ${t.summary} ${t.id}`.toLowerCase().includes(q)
}

/** The templates matching a query, in gallery order. */
export function searchTemplates(query: string, templates: readonly AgentTemplate[] = AGENT_TEMPLATES): AgentTemplate[] {
  return templates.filter((t) => matchTemplate(t, query))
}

/** The template with this id, or null. */
export function templateById(id: string, templates: readonly AgentTemplate[] = AGENT_TEMPLATES): AgentTemplate | null {
  return templates.find((t) => t.id === id) ?? null
}

/**
 * The builder state a template starts from. Merged over the CURRENT spec so a model
 * the user already chose survives picking a template — the template owns the prompt
 * and the character of the agent, never the model, which is the org's own decision.
 */
export function specFromTemplate(t: AgentTemplate, current: AgentSpec, defaults: AgentConfig): AgentSpec {
  return {
    ...current,
    name: t.name,
    description: t.summary,
    systemPrompt: t.systemPrompt,
    tools: current.tools,
    config: t.config ? { ...defaults, ...t.config } : undefined,
  }
}
