import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateTerminalTabOnOwner } from '@/lib/terminal-tab-owner-activation'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { parsePaneKey } from '../../../shared/stable-pane-id'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'

/** Brings the agent's pane to the front, whether it lives in a terminal or a structured session tab. */
export function focusAgentPane(entry: AgentStatusEntry): void {
  const parsed = parsePaneKey(entry.paneKey)
  const worktreeId = entry.worktreeId
  if (!parsed || !worktreeId) {
    return
  }
  activateAndRevealWorktree(worktreeId)
  const tabs = useAppStore.getState().tabsByWorktree[worktreeId] ?? []
  if (tabs.some((tab) => tab.id === parsed.tabId)) {
    activateTabAndFocusPane(parsed.tabId, parsed.leafId, { flashFocusedPane: true })
    activateTerminalTabOnOwner(worktreeId, parsed.tabId, parsed.leafId)
  } else if (!activateStructuredAgentSessionTab({ worktreeId, tabId: parsed.tabId })) {
    activateTerminalTabOnOwner(worktreeId, parsed.tabId, parsed.leafId)
  }
}

/** Opens omp in a new terminal tab of the active worktree with `prompt` drafted, not sent. */
export function launchOmpDraft(prompt: string): void {
  const worktreeId = useAppStore.getState().activeWorktreeId
  if (!worktreeId) {
    toast.error('Select a workspace first, then start the session again.')
    return
  }
  useAppStore.getState().setActiveView('terminal')
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent: 'omp',
    worktreeId,
    requestedSurface: 'terminal',
    prompt,
    promptDelivery: 'draft'
  })
  if (!result) {
    toast.error('Could not build the launch command for omp.')
  }
}
