import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Plus, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBrowserPageWebviewPartition } from '@/components/browser-pane/host-guest/use-browser-page-webview-partition'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateTerminalTabOnOwner } from '@/lib/terminal-tab-owner-activation'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { normalizeBrowserNavigationUrl } from '../../../../shared/browser-url'
import { ORCA_BROWSER_PAGE_GUEST_WEB_PREFERENCES_ATTRIBUTE } from '../../../../shared/browser-guest-web-preferences'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

const DASHBOARD_URL_KEY = 'research-os.dashboardUrl'
const DEFAULT_DASHBOARD_URL = 'https://research-os.centaur-porgy.ts.net/'
const NEW_SESSION_PROMPT = 'research-os status --all'

const CHIP_TONE: Record<AgentStatusEntry['state'], string> = {
  working: 'border-primary/40 text-primary',
  blocked: 'border-status-warning-border bg-status-warning-background text-status-warning',
  waiting: 'border-status-warning-border bg-status-warning-background text-status-warning',
  done: 'border-border text-muted-foreground'
}

type LoadState = { kind: 'loading' } | { kind: 'idle' } | { kind: 'error'; message: string }

function focusAgentPane(entry: AgentStatusEntry): void {
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

export default function ResearchPage(): React.JSX.Element {
  const [url, setUrl] = useState(
    () => localStorage.getItem(DASHBOARD_URL_KEY) || DEFAULT_DASHBOARD_URL
  )
  const [draftUrl, setDraftUrl] = useState(url)
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const containerRef = useRef<HTMLDivElement>(null)
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const urlRef = useRef(url)

  const partition = useBrowserPageWebviewPartition({
    sessionProfileId: null,
    sessionPartition: null
  })
  const agentStatusByPaneKey = useAppStore((s) => s.agentStatusByPaneKey)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const agents = useMemo(
    () => Object.values(agentStatusByPaneKey).sort((a, b) => b.updatedAt - a.updatedAt),
    [agentStatusByPaneKey]
  )

  // Partitions are immutable per guest, so a partition change rebuilds the webview.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const webview = document.createElement('webview') as Electron.WebviewTag
    webview.setAttribute('partition', partition)
    webview.setAttribute('webpreferences', ORCA_BROWSER_PAGE_GUEST_WEB_PREFERENCES_ATTRIBUTE)
    webview.style.display = 'flex'
    webview.style.flex = '1'
    webview.style.width = '100%'
    webview.style.height = '100%'
    webview.style.border = 'none'
    webview.style.background = 'var(--background)'
    const onStart = (): void => setLoadState({ kind: 'loading' })
    const onStop = (): void =>
      setLoadState((prev) => (prev.kind === 'error' ? prev : { kind: 'idle' }))
    const onFail = (event: Electron.DidFailLoadEvent): void => {
      // -3 is ERR_ABORTED: a superseded navigation, not a failure.
      if (!event.isMainFrame || event.errorCode === -3) {
        return
      }
      setLoadState({
        kind: 'error',
        message: `${event.errorDescription || `Error ${event.errorCode}`} — ${event.validatedURL}`
      })
    }
    webview.addEventListener('did-start-loading', onStart)
    webview.addEventListener('did-stop-loading', onStop)
    webview.addEventListener('did-fail-load', onFail)
    container.appendChild(webview)
    // Set src after listeners so a fast failure is not missed.
    webview.src = urlRef.current
    webviewRef.current = webview
    return () => {
      webview.removeEventListener('did-start-loading', onStart)
      webview.removeEventListener('did-stop-loading', onStop)
      webview.removeEventListener('did-fail-load', onFail)
      webview.remove()
      webviewRef.current = null
    }
  }, [partition])

  useEffect(() => {
    urlRef.current = url
    const webview = webviewRef.current
    if (webview && webview.getAttribute('src') !== url) {
      setLoadState({ kind: 'loading' })
      webview.src = url
    }
  }, [url])

  const applyDraftUrl = useCallback(() => {
    const next = normalizeBrowserNavigationUrl(draftUrl) ?? DEFAULT_DASHBOARD_URL
    localStorage.setItem(DASHBOARD_URL_KEY, next)
    setDraftUrl(next)
    setUrl(next)
  }, [draftUrl])

  const reload = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }
    setLoadState({ kind: 'loading' })
    try {
      webview.reload()
    } catch {
      // reload() throws until the guest is attached and dom-ready; re-assigning src covers that window.
      webview.src = urlRef.current
    }
  }, [])

  const launchSession = useCallback(() => {
    if (!activeWorktreeId) {
      return
    }
    useAppStore.getState().setActiveView('terminal')
    const result = launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      agent: 'omp',
      worktreeId: activeWorktreeId,
      requestedSurface: 'terminal',
      prompt: NEW_SESSION_PROMPT,
      promptDelivery: 'draft'
    })
    if (!result) {
      toast.error('Could not build launch command for OMP.')
    }
  }, [activeWorktreeId])

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header
        className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border bg-sidebar px-2"
        style={{ paddingRight: 'max(0.5rem, var(--window-controls-width, 0px))' }}
      >
        <Input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          onBlur={applyDraftUrl}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          spellCheck={false}
          aria-label="Dashboard URL"
          className="h-6 w-72 shrink-0 px-2 font-mono text-xs"
        />
        <Button type="button" variant="ghost" size="icon-xs" onClick={reload} aria-label="Reload">
          <RotateCw />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void window.api.shell.openUrl(url)}
          aria-label="Open externally"
        >
          <ExternalLink />
        </Button>
        <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
          {agents.map((entry) => (
            <button
              key={entry.paneKey}
              type="button"
              disabled={!entry.worktreeId}
              onClick={() => focusAgentPane(entry)}
              title={entry.prompt || entry.paneKey}
              className={cn(
                'shrink-0 rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 whitespace-nowrap enabled:hover:bg-accent',
                CHIP_TONE[entry.state]
              )}
            >
              {entry.agentType ?? 'agent'} · {entry.state}
            </button>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Disabled buttons swallow pointer events, so the span keeps the tooltip reachable. */}
            <span className="shrink-0">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={!activeWorktreeId}
                onClick={launchSession}
              >
                <Plus />
                New session
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {activeWorktreeId
              ? `Launch omp with "${NEW_SESSION_PROMPT}" in the active workspace`
              : 'Select a workspace to start a session'}
          </TooltipContent>
        </Tooltip>
      </header>
      {loadState.kind === 'loading' ? (
        <div className="shrink-0 px-3 py-1 text-xs text-muted-foreground">Loading {url}…</div>
      ) : null}
      {loadState.kind === 'error' ? (
        <div className="shrink-0 truncate px-3 py-1 text-xs text-destructive">
          Failed to load: {loadState.message}
        </div>
      ) : null}
      <div ref={containerRef} className="flex min-h-0 flex-1" />
    </main>
  )
}
