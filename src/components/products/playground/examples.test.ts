import { describe, it, expect } from 'vitest'

import { EXAMPLES } from './examples'

describe('EXAMPLES', () => {
  it('has unique ids and fills every field', () => {
    const ids = EXAMPLES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of EXAMPLES) {
      expect(e.label.trim()).not.toBe('')
      expect(e.system.trim()).not.toBe('')
      expect(e.user.trim()).not.toBe('')
    }
  })

  /**
   * The defect this guards: all six examples once suggested `zen-omni` or `zen-coder`,
   * and the gateway serves neither. Applying an example falls back to the selected
   * model when the suggestion is absent, so nothing threw and nothing was logged — the
   * card just advertised a model that could never be the one that ran.
   *
   * The test is on the SHAPE, not on a list of ids, because a hardcoded catalog would
   * rot the same way the suggestions did. Zen's naming splits cleanly: `zen5…` are the
   * text models; `zen-<noun>` names a modality (embedding, image, video, rerank, voice,
   * vl, guard) and cannot hold a chat turn. A chat example must suggest a text model.
   */
  it('suggests only Zen TEXT models — never a modality SKU or a retired id', () => {
    for (const e of EXAMPLES) {
      expect(e.model, `${e.id} suggests "${e.model}"`).toMatch(/^zen\d/)
    }
  })

  it('never suggests the ids that were wrong', () => {
    const retired = new Set(['zen-omni', 'zen-coder'])
    for (const e of EXAMPLES) expect(retired.has(e.model)).toBe(false)
  })
})
