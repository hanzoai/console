import { describe, it, expect } from 'vitest'

import { AGENT_TEMPLATES, matchTemplate, searchTemplates, specFromTemplate, templateById } from './templates'
import { defaultConfig, emptySpec, toCreateBody } from './logic'

describe('AGENT_TEMPLATES', () => {
  it('has unique ids and a handle for every entry', () => {
    const ids = AGENT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of AGENT_TEMPLATES) {
      expect(t.name.trim()).not.toBe('')
      expect(t.title.trim()).not.toBe('')
      expect(t.summary.trim()).not.toBe('')
    }
  })

  it('leads with the blank one — starting from nothing is the honest default', () => {
    expect(AGENT_TEMPLATES[0].id).toBe('blank')
    expect(AGENT_TEMPLATES[0].systemPrompt).toBe('')
  })

  // The whole point of the module doc: a template is a preset, never a promise. It
  // may only carry fields the create body can already express, so picking one can
  // never produce an agent the builder itself could not.
  it('carries nothing the create body cannot express', () => {
    const allowed = new Set(['id', 'title', 'summary', 'name', 'systemPrompt', 'config'])
    for (const t of AGENT_TEMPLATES) {
      for (const key of Object.keys(t)) expect(allowed.has(key)).toBe(true)
    }
  })

  // A hardcoded tool id would name something the org may not have activated, and it
  // would fail at the agent's FIRST invocation rather than here. Tools come from the
  // live tool plane or not at all.
  it('names no tools — those come from the live tool plane', () => {
    for (const t of AGENT_TEMPLATES) expect(t).not.toHaveProperty('tools')
  })

  it('every template produces a submittable body', () => {
    for (const t of AGENT_TEMPLATES) {
      const body = toCreateBody(specFromTemplate(t, emptySpec(), defaultConfig()))
      expect(body.name).toBe(t.name)
      expect(body.description).toBe(t.summary)
    }
  })
})

describe('matchTemplate / searchTemplates', () => {
  const t = AGENT_TEMPLATES.find((x) => x.id === 'researcher')!

  it('an empty query matches everything', () => {
    expect(matchTemplate(t, '')).toBe(true)
    expect(matchTemplate(t, '   ')).toBe(true)
    expect(searchTemplates('')).toHaveLength(AGENT_TEMPLATES.length)
  })

  it('matches title, summary and id, case-insensitively', () => {
    expect(matchTemplate(t, 'DEEP')).toBe(true)
    expect(matchTemplate(t, 'sources')).toBe(true)
    expect(matchTemplate(t, 'researcher')).toBe(true)
  })

  it('returns nothing for a query nothing carries', () => {
    expect(searchTemplates('quantum tuba')).toEqual([])
  })

  it('keeps gallery order', () => {
    const found = searchTemplates('a').map((x) => x.id)
    expect(found).toEqual(AGENT_TEMPLATES.filter((x) => matchTemplate(x, 'a')).map((x) => x.id))
  })
})

describe('templateById', () => {
  it('finds one, and is null for an unknown id', () => {
    expect(templateById('blank')?.title).toBe('Blank agent')
    expect(templateById('nope')).toBeNull()
  })
})

describe('specFromTemplate', () => {
  const t = AGENT_TEMPLATES.find((x) => x.id === 'extractor')!

  it('fills name, description and prompt from the template', () => {
    const s = specFromTemplate(t, emptySpec(), defaultConfig())
    expect(s.name).toBe(t.name)
    expect(s.description).toBe(t.summary)
    expect(s.systemPrompt).toBe(t.systemPrompt)
  })

  // The template owns the agent's character; the MODEL is the org's own decision and
  // its tool list is the org's too, so neither is overwritten by picking one.
  it('keeps a model and tools the user already chose', () => {
    const current = { ...emptySpec(), model: 'zen5-pro', tools: ['already.picked'] }
    const s = specFromTemplate(t, current, defaultConfig())
    expect(s.model).toBe('zen5-pro')
    expect(s.tools).toEqual(['already.picked'])
  })

  it('merges the template config over the defaults, leaving the rest alone', () => {
    const s = specFromTemplate(t, emptySpec(), defaultConfig())
    expect(s.config?.temperature).toBe(0)
    expect(s.config?.stream).toBe(defaultConfig().stream)
  })

  it('posts no config for a template that needs none', () => {
    const blank = templateById('blank')!
    expect(specFromTemplate(blank, emptySpec(), defaultConfig()).config).toBeUndefined()
    expect(toCreateBody(specFromTemplate(blank, emptySpec(), defaultConfig()))).not.toHaveProperty('config')
  })
})
