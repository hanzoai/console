'use client'

/**
 * The cloud shell — a REAL terminal in the Developers dock.
 *
 * What was here before was an explorer: a prompt that took `GET /v1/models` and
 * printed the response. It looked like a shell and answered like a form, and the
 * gap between the two is the whole reason this exists — there was no way to run
 * anything, so the `$` in the dock was a promise the dock could not keep.
 *
 * THE SHELL IS A SANDBOX. Not a simulator, not a command allow-list: a login
 * shell on a pseudo-terminal inside the org's own gVisor pod. Whatever the image
 * carries — the hanzo CLI is on its PATH — is a command the user types, and
 * nothing here decides what may run. That decision belongs to the runtime
 * boundary the pod already has, and a second one in a browser tab would only be a
 * fiction.
 *
 * THE TERMINAL IS NOT BUILT HERE. Cloud serves it, whole, at the same address as
 * the socket, and this frames it. That is not laziness about an emulator — it is
 * that the console is one of several hosts that show a shell, and a terminal
 * built per host is a terminal that is subtly different in each of them. One
 * implementation, one place a fix lands, and this file is left with the only part
 * that is genuinely the console's: which sandbox, and what to say while it is
 * coming up.
 *
 * WHAT THIS STILL OWNS is the credential. A frame carries no Authorization
 * header any more than a socket does, so the ticket is fetched through the
 * same-origin `/v1` proxy — where identity lives — and handed to the page in its
 * URL. Single-use, thirty seconds, bound to one sandbox: that is what makes
 * putting it in a URL safe, and why nothing long-lived ever goes there.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/gui'

import { ApiError, cloudProxyV1Url, restGet, restPost } from '~/lib/api/client'
import { config } from '~/config'
import { toneColor } from '~/components/ui/tone'
import { terminalFor } from './logic'

/**
 * The project the dock's shell holds. A `dev` sandbox is attached to a project
 * and the project names the VOLUME, so this constant is what makes the shell the
 * same shell tomorrow: the checkout and the caches are still there when the lease
 * has long since ended. One live sandbox per project is the server's rule, which
 * is also why reopening the dock finds the running one instead of leasing a
 * second.
 */
const PROJECT = 'console'

/** The tmux session this dock attaches to, so reopening it finds the same shell. */
const SESSION = 'dock'

/**
 * How long to wait for the terminal to say it is up.
 *
 * The page posts `{source:'hanzo-term'}` when its socket opens. Without a
 * deadline a frame that failed into something else — an expired ticket, an
 * origin that refused to be framed — is indistinguishable from one that is still
 * loading, and the dock would sit on "Starting…" forever rather than offering the
 * reconnect that fixes it.
 */
const READY_BY = 6000

type Phase = 'starting' | 'live' | 'gone'

type Sandbox = { id: string; status: string; project?: string }

/**
 * The org's running dock sandbox, or a freshly leased one.
 *
 * Asking the server which one is live is what makes the shell survive a reload
 * without remembering anything: there is exactly one live sandbox per project by
 * the server's own rule, so the answer to "which one is mine" is a query and
 * never a stored id that can go stale. The match is re-checked here rather than
 * trusted from the query string — a filter is the server's convenience, and the
 * sandbox this reattaches to had better be the right one.
 */
async function sandbox(): Promise<Sandbox> {
  const live = await restGet<{ sandboxes?: Sandbox[] }>(
    cloudProxyV1Url(`sandboxes?project=${PROJECT}&status=running`),
  )
  const held = live.sandboxes?.find((m) => m.status === 'running' && m.project === PROJECT)
  if (held) return held
  return restPost<Sandbox>(cloudProxyV1Url('sandboxes'), { class: 'dev', project: PROJECT })
}

const reason = (err: unknown): string =>
  err instanceof ApiError
    ? `${err.message}${err.status ? ` (${err.status})` : ''}`
    : err instanceof Error
      ? err.message
      : String(err)

export function Terminal() {
  const [phase, setPhase] = useState<Phase>('starting')
  const [why, setWhy] = useState('')
  const [src, setSrc] = useState('')
  // A change to this is the ONE way a session restarts: the effect below owns the
  // whole lifetime — sandbox, ticket, frame — and reruns as a unit, so there is
  // no half-torn-down session to reason about. A ticket is spent once, so a
  // reconnect is a new ticket and never the old frame reloaded.
  const [attempt, setAttempt] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)

  const retry = useCallback(() => {
    setPhase('starting')
    setWhy('')
    setSrc('')
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    // `alive` is the barrier for everything this effect started. React mounts an
    // effect twice in development, and a ticket fetched by the first pass would
    // otherwise land in a frame the second pass has replaced.
    let alive = true
    let waiting: ReturnType<typeof setTimeout> | null = null

    const end = (message: string) => {
      if (!alive) return
      setWhy(message)
      setPhase('gone')
    }

    // The readiness handshake. Only the frame we opened may speak for it: the
    // origin is checked against the API host, so another page cannot post its way
    // into a terminal that is not there.
    const heard = (e: MessageEvent) => {
      if (!alive || e.source !== frame.current?.contentWindow) return
      if (new URL(config.apiUrl).origin !== e.origin) return
      const d = e.data as { source?: string } | null
      if (d && d.source === 'hanzo-term') {
        if (waiting) clearTimeout(waiting)
        setPhase('live')
      }
    }
    window.addEventListener('message', heard)

    void (async () => {
      try {
        const m = await sandbox()
        if (!alive) return
        const pass = await restPost<{ ticket: string }>(
          cloudProxyV1Url(`sandboxes/${m.id}/terminal/ticket`),
        )
        if (!alive) return
        setSrc(terminalFor(config.apiUrl, m.id, pass.ticket, SESSION))
        waiting = setTimeout(() => end('The terminal did not come up.'), READY_BY)
      } catch (err) {
        end(reason(err))
      }
    })()

    return () => {
      alive = false
      if (waiting) clearTimeout(waiting)
      window.removeEventListener('message', heard)
    }
  }, [attempt])

  // The frame is ALWAYS laid out and the status covers it, because a frame that
  // is display:none has no size — and a terminal sized to nothing measures 80x24
  // and never corrects.
  return (
    <YStack flex={1} minH={0} position="relative" bg="#000">
      {src ? (
        <iframe
          ref={frame}
          src={src}
          title="Cloud shell"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      ) : null}
      {phase === 'live' ? null : (
        <YStack position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" gap="$2" p="$4" bg="$color1">
          {phase === 'starting' ? (
            <Text fontSize="$2" color="$color10">
              Starting your cloud shell…
            </Text>
          ) : (
            <>
              <XStack items="center" gap="$2">
                <Text fontSize="$2" color={toneColor('critical')}>
                  Disconnected
                </Text>
                <Button size="$2" onPress={retry} aria-label="Reconnect the cloud shell">
                  Reconnect
                </Button>
              </XStack>
              {why ? (
                <Text fontSize="$1" color="$color10" className="hz-mono">
                  {why}
                </Text>
              ) : null}
            </>
          )}
        </YStack>
      )}
    </YStack>
  )
}
