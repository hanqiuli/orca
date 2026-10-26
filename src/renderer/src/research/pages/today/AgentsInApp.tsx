import { PlusIcon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import { focusAgentPane, launchOmpDraft } from '../../orca-agents'
import { Reveal, btnPrimary, interactive } from '../../ui'

const NEW_SESSION_PROMPT = 'research-os status --all'

const CHIP_TONE: Record<AgentStatusEntry['state'], string> = {
  working: 'border-terra/50 bg-terra-tint text-terra',
  blocked: 'border-warn/50 bg-warn/10 text-warn',
  waiting: 'border-warn/50 bg-warn/10 text-warn',
  done: 'border-line text-ink-muted'
}

function excerpt(prompt: string): string {
  const flat = prompt.replace(/\s+/g, ' ').trim()
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat
}

export function AgentsInApp(): React.JSX.Element {
  const agentStatusByPaneKey = useAppStore((s) => s.agentStatusByPaneKey)
  const hasWorktree = useAppStore((s) => !!s.activeWorktreeId)
  const agents = useMemo(
    () => Object.values(agentStatusByPaneKey).sort((a, b) => b.updatedAt - a.updatedAt),
    [agentStatusByPaneKey]
  )

  return (
    <Reveal className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Agents in this app</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Disabled buttons swallow pointer events, so the span keeps the tooltip reachable. */}
            <span className="inline-flex">
              <button
                type="button"
                className={btnPrimary}
                disabled={!hasWorktree}
                onClick={() => launchOmpDraft(NEW_SESSION_PROMPT)}
              >
                <PlusIcon className="size-4" aria-hidden />
                New session
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {hasWorktree
              ? `Start omp in the active workspace with "${NEW_SESSION_PROMPT}" drafted`
              : 'Select a workspace in the sidebar to start a session'}
          </TooltipContent>
        </Tooltip>
      </header>
      {agents.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {agents.map((entry) => {
            const text = excerpt(entry.prompt)
            return (
              <li key={entry.paneKey}>
                <button
                  type="button"
                  disabled={!entry.worktreeId}
                  onClick={() => focusAgentPane(entry)}
                  title={entry.prompt || entry.paneKey}
                  aria-label={`${entry.agentType ?? 'agent'} · ${entry.state}${text ? ` · ${text}` : ''}`}
                  className={`flex aspect-square w-full flex-col gap-2 rounded-lg border p-3 text-left enabled:hover:border-line-strong ${interactive} ${CHIP_TONE[entry.state]}`}
                >
                  <span className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="truncate">{entry.agentType ?? 'agent'}</span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <span
                        className={`size-2 rounded-full bg-current ${entry.state === 'working' ? 'animate-pulse' : ''}`}
                        aria-hidden
                      />
                      {entry.state}
                    </span>
                  </span>
                  <span className="line-clamp-5 text-sm text-ink">
                    {text || <span className="text-ink-muted">No prompt yet</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-line-strong p-6">
          <p className="text-sm text-ink">No agent sessions in this app yet.</p>
          <p className="mt-1 max-w-[680px] text-sm text-ink-muted">
            Pick a workspace in the sidebar and choose New session to start omp with a status prompt
            drafted. Any agent you run in a workspace terminal also appears here, and a click brings
            its pane to the front.
          </p>
        </div>
      )}
    </Reveal>
  )
}
