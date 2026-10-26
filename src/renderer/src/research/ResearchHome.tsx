import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useIsFetching,
  useQueryClient
} from '@tanstack/react-query'
import { ArrowClockwiseIcon, ArrowSquareOutIcon, GearSixIcon } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'
import { DEFAULT_API_URL, useApiUrl } from './api/client'
import { DotArt } from './DotArt'
import {
  routeKey,
  sectionOf,
  useResearchRoute,
  type ResearchRoute,
  type ResearchSection
} from './research-route'
import { Campaigns, CampaignDetail } from './pages/Campaigns'
import { Digests } from './pages/Digests'
import { Experiment } from './pages/Experiment'
import { Pods } from './pages/Pods'
import { Project } from './pages/Project'
import { Runs } from './pages/Runs'
import { Today } from './pages/Today'
import {
  ErrorBanner,
  OVERLAY_ID,
  btnGhost,
  btnPrimary,
  iconBtn,
  inputCls,
  interactive,
  labelCls
} from './ui'
import './research-home.css'

// One client for the app's lifetime so cached data survives switching Orca views.
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } }
})

const NAV: { section: ResearchSection; label: string }[] = [
  { section: 'today', label: 'Today' },
  { section: 'runs', label: 'Runs' },
  { section: 'campaigns', label: 'Campaigns' },
  { section: 'pods', label: 'Pods' },
  { section: 'digests', label: 'Digests' }
]

function Page({ route }: { route: ResearchRoute }): React.JSX.Element {
  switch (route.page) {
    case 'today':
      return <Today />
    case 'runs':
      return <Runs project={route.project} state={route.state} />
    case 'campaigns':
      return <Campaigns />
    case 'campaign':
      return <CampaignDetail id={route.id} />
    case 'pods':
      return <Pods />
    case 'digests':
      return <Digests />
    case 'digest':
      return <Digests day={route.day} />
    case 'project':
      return <Project pkey={route.key} track={route.track} />
    case 'experiment':
      return <Experiment id={route.id} />
  }
}

/** Keeps the home alive when a page throws while rendering; keyed by route so navigation resets it. */
class PageBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error }
  }
  render(): ReactNode {
    return this.state.error ? <ErrorBanner error={this.state.error} /> : this.props.children
  }
}

function SettingsPopover(): React.JSX.Element {
  const url = useApiUrl((s) => s.url)
  const setUrl = useApiUrl((s) => s.setUrl)
  const qc = useQueryClient()
  const fetching = useIsFetching() > 0
  const [draft, setDraft] = useState(url)

  const apply = (): void => {
    if (draft.trim() === url) {
      return
    }
    setUrl(draft)
    setDraft(useApiUrl.getState().url)
    // Cached data belongs to the old box.
    void qc.resetQueries()
  }

  return (
    <Popover onOpenChange={(open) => open && setDraft(url)}>
      <PopoverTrigger asChild>
        <button type="button" className={iconBtn} aria-label="Research OS settings">
          <GearSixIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <div className="space-y-3">
          <label className={`flex flex-col gap-2 ${labelCls}`}>
            Research OS URL
            <input
              className={`${inputCls} font-mono text-xs`}
              value={draft}
              spellCheck={false}
              placeholder={DEFAULT_API_URL}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={apply}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isImeOwnedKeyboardEvent(e)) {
                  apply()
                }
              }}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void qc.invalidateQueries()}
            >
              <ArrowClockwiseIcon
                className={`size-4 ${fetching ? 'motion-safe:animate-spin' : ''}`}
                aria-hidden
              />
              Reload
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => void window.api.shell.openUrl(url)}
            >
              <ArrowSquareOutIcon className="size-4" aria-hidden />
              Open in browser
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FloatingNav({ current }: { current: ResearchSection }): React.JSX.Element {
  const navigate = useResearchRoute((s) => s.navigate)
  return (
    <nav
      aria-label="Research"
      className="sticky top-4 z-20 mx-auto flex w-fit items-center gap-1 rounded-xl border border-line bg-surface/75 p-1 shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_8%,transparent),0_8px_24px_color-mix(in_srgb,var(--ink)_6%,transparent)] backdrop-blur-md"
    >
      {NAV.map(({ section, label }) => (
        <button
          key={section}
          type="button"
          aria-current={section === current ? 'page' : undefined}
          onClick={() => navigate({ page: section })}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${interactive} ${
            section === current
              ? 'bg-terra-tint text-terra'
              : 'text-ink-muted hover:bg-terra-tint/60 hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      <SettingsPopover />
    </nav>
  )
}

function Home(): React.JSX.Element {
  const route = useResearchRoute((s) => s.route)
  const key = routeKey(route)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [key])

  return (
    <div className="rh-root relative isolate flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-paper font-sans text-ink">
      <DotArt
        page={route.page}
        className="rh-art pointer-events-none absolute right-0 bottom-0 -z-10 hidden md:block"
      />
      <div ref={scrollRef} className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <FloatingNav current={sectionOf(route)} />
        <main className="mx-auto w-full max-w-[1440px] px-6 pt-10 pb-24 sm:px-10">
          <PageBoundary key={key}>
            <Page route={route} />
          </PageBoundary>
        </main>
      </div>
      <div
        id={OVERLAY_ID}
        className="pointer-events-none absolute inset-0 z-30 *:pointer-events-auto"
      />
    </div>
  )
}

export default function ResearchHome(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>
  )
}
