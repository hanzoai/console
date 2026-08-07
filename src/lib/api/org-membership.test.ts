import { describe, expect, it } from 'vitest'

import { orgNamesFor } from './team'

describe('orgNamesFor — the orgs a person may act in', () => {
  it('leads with the home org, then the memberships', () => {
    expect(
      orgNamesFor('hanzo', [
        { user: 'hanzo/dave', org: 'maxpower', role: 'admin' },
        { user: 'hanzo/dave', org: 'acme', role: 'member' },
      ]),
    ).toEqual(['hanzo', 'maxpower', 'acme'])
  })

  it('never repeats the home org when it is also a membership row', () => {
    expect(
      orgNamesFor('hanzo', [
        { user: 'hanzo/dave', org: 'hanzo', role: 'member' },
        { user: 'hanzo/dave', org: 'maxpower', role: 'admin' },
      ]),
    ).toEqual(['hanzo', 'maxpower'])
  })

  it('is the home org alone when there are no memberships', () => {
    expect(orgNamesFor('hanzo', [])).toEqual(['hanzo'])
  })

  it('drops blank names rather than rendering a nameless card', () => {
    expect(
      orgNamesFor('hanzo', [
        { user: 'hanzo/dave', org: '', role: 'member' },
        { user: 'hanzo/dave', org: '   ', role: 'member' },
        { user: 'hanzo/dave', org: 'maxpower', role: 'admin' },
      ]),
    ).toEqual(['hanzo', 'maxpower'])
  })

  // A signed-in person with no resolvable home org still gets an honest empty
  // list rather than a card named "".
  it('is empty when there is no home org and no membership', () => {
    expect(orgNamesFor('', [])).toEqual([])
  })
})
