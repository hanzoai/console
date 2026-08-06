'use client'

/**
 * The ONE honest state for an observability surface whose fetch failed.
 *
 * The `/v1/o11y` runtime returns 503 until its telemetry stores + query service
 * are initialized (and 404 where the surface is unrouted, 401/403 on access). We
 * never fabricate traces, sessions, scores, or charts — this card explains the
 * real reason and names the endpoint, so an empty observability area always reads
 * truthfully.
 *
 * The endpoint it names comes off `ApiError.endpoint` — the URL the failed request
 * was actually sent to. It used to be synthesized from the `surface` prop, which is a
 * DISPLAY label ("logs", "traces", "scores"), so the card confidently printed
 * `/v1/o11y/logs` for a failure at `/v1/o11y/query_range`. `/v1/o11y/logs` is a real
 * route that 405s a POST, which makes the wrong answer look like a lead, and someone
 * chased it. A label is not an address: when the error carries no path we print none.
 */
import { Button, Card, Text, XStack } from '@hanzo/gui'
import { BarChart3, TriangleAlert } from '@hanzogui/lucide-icons-2'

import { ApiError } from '~/lib/api'
import { config } from '~/config'
import { startReauth } from '~/lib/auth/iam'

export type RuntimeStatus = 'not-initialized' | 'unavailable' | 'access' | 'signin' | 'error'

/**
 * Map a failed o11y fetch to an honest runtime status. 401 = the session lapsed
 * (`signin` — re-auth fixes it); 403 = signed in but observability isn't enabled
 * for this org yet (`access`). A signed-in user is NEVER told to "sign in" for a
 * 403 — that reads like a bug ("I AM signed in").
 */
export function classifyRuntime(e: unknown): RuntimeStatus {
  const s = e instanceof ApiError ? e.status : 0
  if (s === 503) return 'not-initialized'
  if (s === 404) return 'unavailable'
  if (s === 401) return 'signin'
  if (s === 403) return 'access'
  return 'error'
}

const TITLE: Record<RuntimeStatus, string> = {
  'not-initialized': 'Observability runtime initializing',
  unavailable: 'Not routed on this host',
  access: 'Observability not enabled yet',
  signin: 'Your session expired',
  error: 'Could not reach observability',
}

/** The path the failed request was sent to, or '' when the error carries none. */
export function failedEndpoint(e: unknown): string {
  return e instanceof ApiError ? e.endpoint : ''
}

export function RuntimeNotice({ surface, error }: { surface: string; error: unknown }) {
  const status = classifyRuntime(error)
  const message = error instanceof Error ? error.message : String(error)
  const endpoint = failedEndpoint(error)
  const body: Record<RuntimeStatus, string> = {
    'not-initialized': `Observability runtime initializing — your ${surface} will appear here once it's enabled. The /v1/o11y routes are mounted, but the runtime (telemetry stores, query service) is not initialized on this deployment yet. This page shows live ${surface} the moment the runtime is online — it never shows placeholder data.`,
    unavailable: endpoint
      ? `${endpoint} is not routed on this host yet, so your ${surface} can't be read.`
      : `The observability surface behind your ${surface} is not routed on this host yet.`,
    // 403 for a signed-in user — observability isn't provisioned for their org.
    access: `Observability isn't enabled for your organization yet, so your ${surface} can't be read. It appears here automatically once it is — never placeholder data.`,
    // 401 — the session itself lapsed.
    signin: `Your session has expired or isn't recognized here. Sign in again to view your ${surface}.`,
    error: message,
  }
  // While the trace runtime is initializing / not enabled, AI Metrics already has
  // real, per-org usage data (from the commerce billing ledger) — so we point there.
  const showMetricsLink = status === 'not-initialized' || status === 'unavailable' || status === 'access'
  const goToMetrics = () => {
    if (typeof window !== 'undefined') window.location.assign('/ai-metrics')
  }
  return (
    <Card p="$4" gap="$2" borderWidth={1} borderColor="$borderColor" maxWidth={680}>
      <XStack gap="$2" items="center">
        <TriangleAlert size={16} />
        <Text fontSize="$4" fontWeight="700">
          {TITLE[status]}
        </Text>
      </XStack>
      <Text fontSize="$3" color="$color11">
        {body[status]}
      </Text>
      {status === 'signin' ? (
        <Button size="$2" theme="light" self="flex-start" onPress={startReauth}>
          Sign in again
        </Button>
      ) : showMetricsLink ? (
        <Button size="$2" self="flex-start" icon={<BarChart3 size={15} />} onPress={goToMetrics}>
          View AI Metrics
        </Button>
      ) : null}
      <Text fontSize="$2" color="$color10">
        {endpoint ? `endpoint · ${endpoint} · ` : ''}
        {config.brandName}
      </Text>
    </Card>
  )
}
