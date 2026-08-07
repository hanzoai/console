'use client'

/**
 * Agents — the per-agent detail view, rendered inside the shared right-side
 * `DetailPane`. It shows the agent's REAL facts, its REAL cost from the charged
 * commerce ledger, and a best-effort activity feed from `GET /v1/agents/:name`;
 * never fabricated telemetry.
 *
 * CREATING an agent does not live here. It used to — a thin `NewAgentForm` adapter
 * that opened the canonical `AgentBuilder` in this same pane — and that made two
 * differently-shaped entrances to one builder, only one of which could offer
 * templates, drafting, or anywhere to run what it made. The quickstart
 * (`/agents/quickstart`) is the one way now, and the board's New-Agent button goes
 * there.
 */
import { useEffect, useState } from 'react'
import { Spinner, Text, XStack, YStack } from '@hanzo/gui'

import {
  AgentsApi,
  fmtAbs,
  fmtCompact,
  fmtDuration,
  fmtPct,
  fmtRelative,
  fmtUsd,
  fmtVersion,
  type Agent,
  type AgentActivity,
} from '~/lib/api/agents'
import { fetchUsageRecords, agentUsageFor, type AgentUsage } from '~/lib/api/aimetrics'
import { AgentBuilder } from '~/components/agent-builder'
import { StatusPill, ActivityFeed } from './parts'

const DASH = '—'

/** A label · value fact row inside the detail pane. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <XStack justify="space-between" gap="$3" py="$1.5" borderBottomWidth={1} borderColor="$borderColor">
      <Text fontSize="$2" color="$color10">
        {label}
      </Text>
      <Text fontSize="$2" color="$color12" fontWeight="600" numberOfLines={1}>
        {value}
      </Text>
    </XStack>
  )
}

/**
 * The per-agent detail view — REAL facts from the row, the agent's REAL cost from
 * the charged commerce ledger (grouped by `metadata.agent`, NOT a hardcoded/registry
 * metric), and a best-effort recent-activity feed from `GET /v1/agents/:name`.
 */
export function AgentDetailView({ agent }: { agent: Agent }) {
  const [activity, setActivity] = useState<AgentActivity[] | null>(null)
  // `undefined` = still loading; `null` = loaded, ledger carries no row for this
  // agent (honest "—"); an `AgentUsage` = the real charged spend/requests/tokens.
  const [ledger, setLedger] = useState<AgentUsage | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    // Single-agent routes are keyed by the agent's NAME (its backend handle), not the
    // display `id` (`agent_…`) — passing the id 404s, which left this pane's activity
    // permanently empty.
    AgentsApi.get(agent.name)
      .then((d) => {
        if (live) setActivity(d?.recentActivity ?? [])
      })
      .catch(() => {
        if (live) setActivity([])
      })
    // Per-agent cost comes from the SAME charged ledger the Cost page reads — never
    // a fabricated or hardcoded number. A ledger failure degrades to honest "—".
    fetchUsageRecords()
      .then((records) => {
        if (live) setLedger(agentUsageFor(records, { id: agent.id, name: agent.name }))
      })
      .catch(() => {
        if (live) setLedger(null)
      })
    return () => {
      live = false
    }
  }, [agent.id, agent.name])

  return (
    <YStack gap="$3">
      <XStack items="center" gap="$2">
        <StatusPill status={agent.status} />
        <Text fontSize="$1" color="$color10">
          {fmtVersion(agent.version)}
        </Text>
      </XStack>

      {agent.description ? (
        <Text fontSize="$2" color="$color11">
          {agent.description}
        </Text>
      ) : null}

      <YStack gap="$1">
        <Fact label="Model" value={agent.model || DASH} />
        <Fact label="Invocations 30d" value={fmtCompact(agent.invocations30d)} />
        <Fact label="Success rate" value={fmtPct(agent.successRate)} />
        <Fact label="Avg latency" value={fmtDuration(agent.avgLatencyMs)} />
        <Fact label="Errors 30d" value={fmtCompact(agent.errors30d)} />
        <Fact label="Tools" value={agent.tools != null ? String(agent.tools) : DASH} />
        <Fact label="Last invocation" value={fmtRelative(agent.lastInvocationAt)} />
        <Fact label="Created" value={fmtAbs(agent.createdAt)} />
        <Fact label="Updated" value={fmtAbs(agent.updatedAt)} />
        <Fact label="Agent ID" value={agent.id} />
      </YStack>

      <YStack gap="$2" pt="$1">
        <Text fontSize="$3" fontWeight="700" color="$color12">
          Cost · charged ledger
        </Text>
        {ledger === undefined ? (
          <XStack py="$3" justify="center">
            <Spinner size="small" color="$color11" />
          </XStack>
        ) : (
          <YStack gap="$1">
            <Fact label="Cost" value={fmtUsd(ledger?.cents)} />
            <Fact label="Requests" value={fmtCompact(ledger?.requests)} />
            <Fact label="Tokens" value={fmtCompact(ledger?.totalTokens)} />
            {ledger === null ? (
              <Text fontSize="$1" color="$color10" pt="$1">
                No charged spend is attributed to this agent yet — cost appears once its usage is metered.
              </Text>
            ) : null}
          </YStack>
        )}
      </YStack>

      <YStack gap="$2" pt="$1">
        <Text fontSize="$3" fontWeight="700" color="$color12">
          Recent activity
        </Text>
        {activity === null ? (
          <XStack py="$3" justify="center">
            <Spinner size="small" color="$color11" />
          </XStack>
        ) : (
          <ActivityFeed events={activity} />
        )}
      </YStack>
    </YStack>
  )
}
