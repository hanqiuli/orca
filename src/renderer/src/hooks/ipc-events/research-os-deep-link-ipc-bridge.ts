import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { parseResearchOsDeepLink } from '../../../../shared/research-os-deep-link'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import { useAppStore } from '../../store'

function launchResearchOsDeepLink(url: string): void {
  const link = parseResearchOsDeepLink(url)
  if (!link) {
    console.warn('[research-os] Ignoring malformed deep link:', url)
    return
  }
  const agent = link.agent ?? 'omp'
  if (!isTuiAgent(agent)) {
    console.warn('[research-os] Ignoring deep link for unknown agent:', agent)
    return
  }
  const store = useAppStore.getState()
  const cwd = link.cwd?.replace(/\/+$/, '')
  const match = cwd
    ? Object.values(store.worktreesByRepo)
        .flat()
        .find((worktree) => worktree.path.replace(/\/+$/, '') === cwd)
    : undefined
  const worktreeId = match?.id ?? store.activeWorktreeId
  if (!worktreeId) {
    console.warn('[research-os] No project to launch the deep link in:', url)
    return
  }
  if (worktreeId !== store.activeWorktreeId) {
    store.setActiveWorktree(worktreeId)
  }
  store.setActiveView('terminal')
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent,
    worktreeId,
    requestedSurface: link.surface ?? 'terminal',
    prompt: link.prompt,
    promptDelivery: 'draft'
  })
  if (!result) {
    console.warn('[research-os] Could not build launch command for', agent)
  }
}

export function registerResearchOsDeepLinkIpcBridge(unsubs: (() => void)[]): void {
  let stopWaitingForSession: (() => void) | null = null
  // Why: a cold-start link arrives before projects hydrate; launching then would fall through to "no project".
  const handle = (url: string): void => {
    if (useAppStore.getState().workspaceSessionReady) {
      launchResearchOsDeepLink(url)
      return
    }
    stopWaitingForSession?.()
    stopWaitingForSession = useAppStore.subscribe((state) => {
      if (!state.workspaceSessionReady) {
        return
      }
      stopWaitingForSession?.()
      stopWaitingForSession = null
      launchResearchOsDeepLink(url)
    })
  }
  unsubs.push(window.api.ui.onOpenResearchOsDeepLink?.(handle) ?? (() => {}), () =>
    stopWaitingForSession?.()
  )
  // Why: ?. and the then-check guard a stale preload that predates this channel.
  const pending = window.api.ui.consumePendingResearchOsDeepLink?.()
  if (pending && typeof pending.then === 'function') {
    void pending
      .then((url) => {
        if (url) {
          handle(url)
        }
      })
      .catch(() => {})
  }
}
