'use client'

/**
 * Honest platform states — ONE place that maps a `/paas` proxy / platform error
 * to a truthful explanation, shared by every platform module (Clusters,
 * Kubernetes, Edge). No fabricated data: a 501 means the proxy has no service
 * token yet, a 503 means the route is mounted but its runtime/dependency isn't
 * configured on this deployment, a 404 means the backend doesn't serve that
 * surface yet, anything else is the real (transient) reach error.
 */
import { Button, Card, Text, XStack } from '@hanzo/gui'
import { CheckCircle2, TriangleAlert } from '@hanzogui/lucide-icons-2'

import { ApiError } from '~/lib/api'

export type PlatformErrorKind = 'not-configured' | 'forbidden' | 'payment' | 'unavailable' | 'error'

export type PlatformError = { kind: PlatformErrorKind; message: string }

/** Classify a thrown error from a `/paas` call into an honest kind + message. */
export function interpretPlatformError(e: unknown): PlatformError {
  const status = e instanceof ApiError ? e.status : 0
  const message = e instanceof Error ? e.message : String(e)
  // 501 = the console's PaaS service token is not set (an ADMIN infra concern).
  // 401/403 = the CALLER can't read the control plane — a customer (not a workspace
  // admin), NOT a token problem: show a graceful "managed control plane" state, never
  // the infra PAAS_SERVICE_TOKEN message (that would be a false claim to a customer).
  if (status === 501) return { kind: 'not-configured', message }
  if (status === 401 || status === 403) return { kind: 'forbidden', message }
  // 402 = the spend gate refused: no active subscription and no prepaid credit, or
  // a spend cap was reached. The control plane is reachable and the caller is
  // authorized — it is a BILLING answer, so it must not read as an outage. The
  // backend's own sentence already names the cure ("Add credits at …"), so it is
  // shown verbatim rather than replaced with a guess about which cure applies.
  if (status === 402) return { kind: 'payment', message }
  if (status === 404) return { kind: 'unavailable', message }
  // 503 = the route is mounted but its runtime/dependency is not configured on
  // THIS deployment (e.g. zt networking fail-closed until ZT_CLIENT_* is set).
  // That's a deployment-state truth, not a transient reach failure — show the
  // clean "not available yet" card, NEVER the raw backend message (which can name
  // internal env/config the customer should never see).
  if (status === 503) return { kind: 'unavailable', message }
  return { kind: 'error', message }
}

const TITLES: Record<PlatformErrorKind, string> = {
  'not-configured': 'PaaS control plane not configured',
  forbidden: 'Connected · managed by Hanzo',
  payment: 'Billing required',
  unavailable: 'Endpoint not served here',
  error: 'Could not reach the platform',
}

const BODIES: Record<PlatformErrorKind, string> = {
  'not-configured':
    'This console is wired to platform.hanzo.ai, but the server-side service token (PAAS_SERVICE_TOKEN, from KMS) is not set on this deployment yet. Once it is, real data appears here. No placeholder data is shown.',
  forbidden:
    'Your workloads run on managed Hanzo Cloud — no cluster to operate. The full control-plane fleet view (clusters, nodes, raw workloads) is an admin surface; deploy and scale through Functions, Agents, and the platform.',
  unavailable:
    'The platform backend on this deployment does not serve this endpoint (it ships as a separate service). This view reads live data wherever the endpoint is served; nothing is fabricated here.',
  // Empty → the card shows the backend's own sentence, which names the cure.
  payment: '',
  error: '',
}

/**
 * A truthful state card for a platform load. `forbidden` is a CONNECTED, customer-
 * appropriate "managed by Hanzo" state (green check, no Retry) — the caller reached the
 * control plane, it's just admin-scoped; it must NOT read like a warning/error. The other
 * kinds are genuine problems (warning triangle + Retry).
 */
export function PlatformStateCard({ error, onRetry }: { error: PlatformError; onRetry?: () => void }) {
  const connected = error.kind === 'forbidden'
  return (
    <Card borderWidth={1} borderColor="$borderColor" p="$4" gap="$2" maxWidth={640}>
      <XStack gap="$2" items="center">
        {connected ? <CheckCircle2 size={16} color="$green10" /> : <TriangleAlert size={16} />}
        <Text fontSize="$4" fontWeight="700">
          {TITLES[error.kind]}
        </Text>
      </XStack>
      <Text fontSize="$3" color="$color11">
        {BODIES[error.kind] || error.message}
      </Text>
      {onRetry && !connected ? (
        <Button size="$2" self="flex-start" onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </Card>
  )
}
