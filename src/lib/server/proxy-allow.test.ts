import { describe, expect, it } from 'vitest'

import {
  allowBaseSurface,
  allowCatalogSurface,
  allowPlansSurface,
  allowCloudSurface,
  allowVisorSurface,
  allowCommerceSurface,
  allowCmsSurface,
  allowErpSurface,
  v1Head,
  CLOUD_HEADS,
  COMMERCE_HEADS,
} from './proxy-allow'

describe('allowCatalogSurface', () => {
  it('admits exactly the catalog CRUD + seed paths', () => {
    expect(allowCatalogSurface('v1/catalog/entries')).toBe(true) // list + create
    expect(allowCatalogSurface('v1/catalog/entries/cloud-dev')).toBe(true) // update/delete by slug
    expect(allowCatalogSurface('v1/catalog/entries/gpu-standard')).toBe(true)
    expect(allowCatalogSurface('v1/catalog/seed')).toBe(true)
    expect(allowCatalogSurface('/v1/catalog/entries/')).toBe(true) // tolerant of edge slashes
  })
  it('refuses anything outside the catalog admin surface (no tunnel)', () => {
    expect(allowCatalogSurface('v1/catalog')).toBe(false) // bare head
    expect(allowCatalogSurface('v1/catalog/entries/a/b')).toBe(false) // too deep
    expect(allowCatalogSurface('v1/billing/balance')).toBe(false)
    expect(allowCatalogSurface('v1/checkout/sessions')).toBe(false)
    expect(allowCatalogSurface('v1/product')).toBe(false) // merchant store model
    expect(allowCatalogSurface('_/commerce/tenants')).toBe(false)
    expect(allowCatalogSurface('v1/commerce/catalog')).toBe(false) // public projection is a different mount
  })
})

describe('allowPlansSurface', () => {
  it('admits exactly the plan CRUD + seed paths', () => {
    expect(allowPlansSurface('v1/plans/entries')).toBe(true) // list + create
    expect(allowPlansSurface('v1/plans/entries/pro')).toBe(true) // update/delete by slug
    expect(allowPlansSurface('v1/plans/entries/dns-basic')).toBe(true)
    expect(allowPlansSurface('v1/plans/seed')).toBe(true)
    expect(allowPlansSurface('/v1/plans/entries/')).toBe(true) // tolerant of edge slashes
  })
  it('refuses anything outside the plan admin surface (no tunnel)', () => {
    expect(allowPlansSurface('v1/plans')).toBe(false) // bare head
    expect(allowPlansSurface('v1/plans/entries/a/b')).toBe(false) // too deep
    expect(allowPlansSurface('v1/billing/plans')).toBe(false) // the public read is a different mount
    expect(allowPlansSurface('v1/billing/balance')).toBe(false)
    expect(allowPlansSurface('v1/checkout/sessions')).toBe(false)
    expect(allowPlansSurface('v1/product')).toBe(false)
    expect(allowPlansSurface('_/commerce/tenants')).toBe(false)
  })
})

describe('v1Head', () => {
  it('extracts the head of a v1 path', () => {
    expect(v1Head('v1/vector')).toBe('vector')
    expect(v1Head('v1/vector/mydb')).toBe('vector')
    expect(v1Head('v1/functions/foo/logs')).toBe('functions')
    expect(v1Head('/v1/kv')).toBe('kv') // tolerant of a leading slash
  })

  it('returns null for a non-v1 path', () => {
    expect(v1Head('vector')).toBeNull()
    expect(v1Head('')).toBeNull()
  })
})

describe('allowCloudSurface', () => {
  it('admits every managed data kind and serverless surface', () => {
    for (const head of CLOUD_HEADS) {
      expect(allowCloudSurface(`v1/${head}`)).toBe(true)
      expect(allowCloudSurface(`v1/${head}/some-name`)).toBe(true)
    }
  })

  it('admits the functions/prompts/agents subtrees', () => {
    expect(allowCloudSurface('v1/functions/metrics')).toBe(true)
    expect(allowCloudSurface('v1/prompts/my-prompt')).toBe(true)
    expect(allowCloudSurface('v1/agents/agent-1/runs')).toBe(true)
  })

  // The tool plane is admitted so the agent builder can offer an org's REAL tool
  // names. Discovery only: a head admits every sub-path, and `POST /v1/tools/call`
  // RUNS a tool — that belongs to whatever runs an agent, never to a browser tab.
  it('admits tool discovery but refuses the dispatch door', () => {
    expect(CLOUD_HEADS).toContain('tools')
    expect(allowCloudSurface('v1/tools')).toBe(true)
    expect(allowCloudSurface('v1/tools?activated=true')).toBe(true)
    expect(allowCloudSurface('v1/tools/catalog')).toBe(true)
    expect(allowCloudSurface('v1/tools/call')).toBe(false)
    expect(allowCloudSurface('/v1/tools/call')).toBe(false)
    expect(allowCloudSurface('v1/tools/call?x=1')).toBe(false)
  })

  it('admits the evals facade (scores/datasets/rubrics/evaluators/runs)', () => {
    expect(CLOUD_HEADS).toContain('evals')
    for (const sub of ['scores', 'datasets', 'rubrics', 'evaluators', 'runs']) {
      expect(allowCloudSurface(`v1/evals/${sub}`)).toBe(true)
    }
    // the bare head + a query-less path both admit
    expect(allowCloudSurface('v1/evals')).toBe(true)
  })

  it('admits the research evidence plane (experiments/totals/projects), one head', () => {
    expect(CLOUD_HEADS).toContain('research')
    for (const sub of ['experiments', 'totals', 'projects']) {
      expect(allowCloudSurface(`v1/research/${sub}`)).toBe(true)
    }
    expect(allowCloudSurface('v1/research')).toBe(true)
  })

  it('admits the prompts metrics + detail sub-paths (the AI surface heads)', () => {
    expect(allowCloudSurface('v1/prompts/metrics')).toBe(true)
    expect(allowCloudSurface('v1/prompts/support-triage')).toBe(true)
  })

  it('admits the websearch surface (search + versioned scrape), one head', () => {
    expect(CLOUD_HEADS).toContain('websearch')
    expect(allowCloudSurface('v1/websearch/search')).toBe(true)
    expect(allowCloudSurface('v1/websearch/scrape')).toBe(true)
  })

  it('admits the projects store incl. the template fork route', () => {
    expect(CLOUD_HEADS).toContain('projects')
    expect(allowCloudSurface('v1/projects')).toBe(true)
    expect(allowCloudSurface('v1/projects/fork')).toBe(true)
    expect(allowCloudSurface('v1/projects/my-site')).toBe(true)
  })

  it('admits the managed DNS surface (zones + records CRUD sub-paths)', () => {
    expect(CLOUD_HEADS).toContain('dns')
    expect(allowCloudSurface('v1/dns/zones')).toBe(true)
    expect(allowCloudSurface('v1/dns/zones/example.com.')).toBe(true)
    expect(allowCloudSurface('v1/dns/zones/example.com./records')).toBe(true)
    expect(allowCloudSurface('v1/dns/zones/example.com./records/rec-1')).toBe(true)
  })

  it('admits the ML serving surface (the Inference endpoints source), per-org via the Bearer', () => {
    expect(CLOUD_HEADS).toContain('ml')
    expect(allowCloudSurface('v1/ml/models')).toBe(true)
    expect(allowCloudSurface('v1/ml/models/my-llama')).toBe(true)
    expect(allowCloudSurface('v1/ml/health')).toBe(true)
  })

  it('admits the code-intelligence surface (search/ask/context/index), per-org via the Bearer', () => {
    expect(CLOUD_HEADS).toContain('code')
    expect(allowCloudSurface('v1/code/search')).toBe(true)
    expect(allowCloudSurface('v1/code/ask')).toBe(true)
    expect(allowCloudSurface('v1/code/context')).toBe(true)
    expect(allowCloudSurface('v1/code/index')).toBe(true)
  })

  it('admits the ai service the console uses (Embeddings · Collections)', () => {
    // ONE SERVICE head — /v1/<service>/<resource> is the canonical form, and the
    // service that owns stores/files/chats/providers is `ai`. This used to
    // enumerate eight individual ROUTES because the surface had no namespace.
    expect(CLOUD_HEADS).toContain('ai')
    for (const p of [
      'v1/ai/stores',
      'v1/ai/stores/acme/my-store',
      'v1/ai/stores/acme/my-store/vectors',
      'v1/ai/stores/names',
      'v1/ai/files',
    ]) {
      expect(allowCloudSurface(p)).toBe(true)
    }
  })

  it('LEAST PRIVILEGE: still refuses the cross-tenant store listing', () => {
    // An admin read the console never invokes, explicitly refused before the
    // surface was namespaced. Granting the `ai` head would have admitted it
    // silently, so the refusal follows the path.
    expect(allowCloudSurface('v1/ai/stores/global')).toBe(false)
    // The compound routes are gone entirely.
    expect(allowCloudSurface('v1/get-stores')).toBe(false)
  })

  it('the retired compound heads are gone', () => {
    expect(CLOUD_HEADS).not.toContain('get-global-stores')
    expect(CLOUD_HEADS).not.toContain('get-store-names')
    expect(allowCloudSurface('v1/get-global-stores')).toBe(false)
    expect(allowCloudSurface('v1/get-store-names')).toBe(false)
  })

  it('REFUSES privileged / unlisted cloud-api surfaces (not a general tunnel)', () => {
    expect(allowCloudSurface('v1/iam/get-users')).toBe(false)
    expect(allowCloudSurface('v1/admin/overview')).toBe(false)
    expect(allowCloudSurface('v1/kms/secrets')).toBe(false)
    expect(allowCloudSurface('v1/get-account')).toBe(false)
    expect(allowCloudSurface('functions')).toBe(false) // must be a v1 path
  })
})

describe('allowVisorSurface', () => {
  it('admits the whole visor v1 subtree', () => {
    expect(allowVisorSurface('v1')).toBe(true)
    expect(allowVisorSurface('v1/machines')).toBe(true)
    expect(allowVisorSurface('v1/regions')).toBe(true)
    expect(allowVisorSurface('v1/gpus/gpu-1')).toBe(true)
  })

  it('refuses anything outside v1', () => {
    expect(allowVisorSurface('admin/machines')).toBe(false)
    expect(allowVisorSurface('v2/machines')).toBe(false)
    expect(allowVisorSurface('')).toBe(false)
  })
})

describe('allowCommerceSurface', () => {
  it('admits every merchant store head', () => {
    for (const head of COMMERCE_HEADS) {
      expect(allowCommerceSurface(`v1/${head}`)).toBe(true)
      expect(allowCommerceSurface(`v1/${head}/some-id`)).toBe(true)
    }
  })

  it('refuses the money / tenant-admin surfaces that share the commerce binary', () => {
    // Billing rides its OWN scoped `/billing` proxy; checkout + tenant-admin are off-limits.
    expect(allowCommerceSurface('v1/billing/balance')).toBe(false)
    expect(allowCommerceSurface('v1/checkout/sessions')).toBe(false)
    expect(allowCommerceSurface('v1/namespace')).toBe(false)
    expect(allowCommerceSurface('_/commerce/tenants')).toBe(false)
    expect(allowCommerceSurface('product')).toBe(false) // must be a v1 path
  })
})

describe('allowBaseSurface', () => {
  it('admits the collection schema list/create, the scaffolds palette, and records CRUD', () => {
    expect(allowBaseSurface('v1/collections')).toBe(true) // list + create a content type
    expect(allowBaseSurface('/v1/collections')).toBe(true) // tolerant of a leading slash
    expect(allowBaseSurface('v1/collections/meta/scaffolds')).toBe(true) // field-template palette
    // list / create records
    expect(allowBaseSurface('v1/collections/tenants/records')).toBe(true)
    expect(allowBaseSurface('v1/collections/contacts/records')).toBe(true)
    // get / update / delete one record
    expect(allowBaseSurface('v1/collections/contacts/records/abc123')).toBe(true)
    // the Bases manager: get / configure / delete ONE Base (a tenants record by id)
    expect(allowBaseSurface('v1/collections/tenants/records/yj1om5gz64endii')).toBe(true)
  })

  it('admits single content-type admin (view/update/delete a collection) — the builder needs it', () => {
    // Base still gates every collection mutation behind its own superuser check,
    // scoped per-org; this is the content-type-builder surface, not a data leak.
    expect(allowBaseSurface('v1/collections/contacts')).toBe(true)
    expect(allowBaseSurface('v1/collections/posts')).toBe(true)
  })

  it('REFUSES Base NON-collection admin surfaces (not a general Base tunnel)', () => {
    expect(allowBaseSurface('v1/settings')).toBe(false)
    expect(allowBaseSurface('v1/backups')).toBe(false)
    expect(allowBaseSurface('v1/logs')).toBe(false)
    expect(allowBaseSurface('v1/collections/contacts/records/abc/extra')).toBe(false) // too deep
    expect(allowBaseSurface('v1')).toBe(false)
    expect(allowBaseSurface('collections/contacts/records')).toBe(false) // must be a v1 path
    expect(allowBaseSurface('')).toBe(false)
  })
})

describe('allowCmsSurface — Payload read boundary (per-org, no registry leak)', () => {
  it('admits the two tenant-scoped collection lists + the media bytes route', () => {
    expect(allowCmsSurface('api/pages')).toBe(true)
    expect(allowCmsSurface('api/media')).toBe(true)
    expect(allowCmsSurface('api/media/file/photo.jpg')).toBe(true)
    expect(allowCmsSurface('/api/pages')).toBe(true) // tolerant of a leading slash
  })

  it('REFUSES the non-tenant-scoped registry collections + any other path (no cross-org leak)', () => {
    expect(allowCmsSurface('api/users')).toBe(false) // NOT tenant-row-scoped → would leak users
    expect(allowCmsSurface('api/tenants')).toBe(false) // NOT tenant-row-scoped → would leak the org registry
    expect(allowCmsSurface('api/pages/some-id')).toBe(false) // single-doc GET not needed
    expect(allowCmsSurface('api/media/file/a/b')).toBe(false) // too deep
    expect(allowCmsSurface('api/globals/nav')).toBe(false)
    expect(allowCmsSurface('admin')).toBe(false)
    expect(allowCmsSurface('')).toBe(false)
  })
})

describe('allowErpSurface — Frappe read boundary (the 3 UI DocTypes ONLY)', () => {
  it('admits GET /api/resource/{Account,Item,Sales Order} — the exact summary DocTypes', () => {
    expect(allowErpSurface('api/resource/Account')).toBe(true)
    expect(allowErpSurface('api/resource/Item')).toBe(true)
    expect(allowErpSurface('api/resource/Sales Order')).toBe(true) // DocType with a space
    expect(allowErpSurface('/api/resource/Account')).toBe(true) // tolerant of a leading slash
  })

  it('REFUSES any OTHER DocType (RED LOW-1: no brand-internal over-read via a broad token)', () => {
    expect(allowErpSurface('api/resource/User')).toBe(false) // employee/user registry
    expect(allowErpSurface('api/resource/Salary Slip')).toBe(false) // HR/payroll
    expect(allowErpSurface('api/resource/OAuth Bearer Token')).toBe(false) // secrets
    expect(allowErpSurface('api/resource/Bin')).toBe(false) // not a UI summary DocType
  })

  it('REFUSES single-doc, methods, the desk, login, and any deeper path', () => {
    expect(allowErpSurface('api/resource/Item/WIDGET-1')).toBe(false) // single-doc (mutate surface)
    expect(allowErpSurface('api/method/frappe.client.get_list')).toBe(false) // arbitrary method
    expect(allowErpSurface('api/method/frappe.auth')).toBe(false)
    expect(allowErpSurface('app')).toBe(false) // the desk
    expect(allowErpSurface('login')).toBe(false)
    expect(allowErpSurface('')).toBe(false)
  })
})
