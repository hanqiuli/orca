import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { useResearchRoute, type ResearchRoute } from './research-route'

export const OVERLAY_ID = 'research-home-overlay'

/** Shared hover/press/colour motion for every interactive element in the home. */
export const interactive =
  'transition-[color,background-color,border-color,opacity,transform] duration-300 ease-weighted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100'

const btnBase = `inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${interactive}`
export const btnPrimary = `${btnBase} bg-terra text-terra-ink enabled:hover:opacity-90`
export const btnGhost = `${btnBase} border border-line-strong text-ink enabled:hover:bg-terra-tint`
export const iconBtn = `inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-terra-tint hover:text-ink ${interactive}`

export const inputCls = `w-full min-w-0 rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-terra ${interactive} active:scale-100`
export const selectCls = `min-w-0 rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-terra ${interactive} active:scale-100`
export const linkCls = `${interactive} hover:text-terra`
export const labelCls = 'text-xs font-medium tracking-wide text-ink-muted'

/** Rises 32px and fades in once when it first scrolls into view. */
export function Reveal({
  children,
  className = '',
  as: Tag = 'section'
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'header'
}): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || shown) {
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -48px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  return (
    <Tag
      // SAFETY: section, div and header all render an HTMLElement; the union tag just widens the ref type.
      ref={ref as React.RefObject<HTMLElement & HTMLDivElement>}
      data-shown={shown ? '' : undefined}
      className={`rh-reveal ${className}`}
    >
      {children}
    </Tag>
  )
}

export function Card({
  title,
  action,
  children,
  className = ''
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Reveal className={`min-w-0 rounded-lg border border-line bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className={labelCls}>{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </Reveal>
  )
}

/** A loading placeholder block; compose these into the shape of the real layout. */
export function Bone({ className = '' }: { className?: string }): React.JSX.Element {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} aria-hidden />
}

export function Skeleton({ lines = 3 }: { lines?: number }): React.JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className="h-4" />
      ))}
    </div>
  )
}

export function ErrorBanner({ error }: { error: unknown }): React.JSX.Element | null {
  if (!error) {
    return null
  }
  return (
    <div
      role="alert"
      className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad"
    >
      {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

/** Composed empty state: what is missing, then optionally how to change that. */
export function Empty({
  children,
  hint
}: {
  children: ReactNode
  hint?: ReactNode
}): React.JSX.Element {
  return (
    <div className="py-2">
      <p className="text-sm text-ink-muted">{children}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

const STATE_COLOR: Record<string, string> = {
  running: 'bg-ok',
  finished: 'bg-ink-muted',
  crashed: 'bg-bad',
  failed: 'bg-bad',
  killed: 'bg-warn'
}

export function StateDot({ state }: { state: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className={`size-2 rounded-full ${STATE_COLOR[state] ?? 'bg-warn'} ${state === 'running' ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      {state}
    </span>
  )
}

export type Tone = 'muted' | 'ok' | 'warn' | 'bad' | 'accent'

const TONES: Record<Tone, string> = {
  muted: 'text-ink-muted border-line',
  ok: 'text-ok border-ok/40 bg-ok/10',
  warn: 'text-warn border-warn/40 bg-warn/10',
  bad: 'text-bad border-bad/40 bg-bad/10',
  accent: 'text-terra border-terra/40 bg-terra-tint'
}

export function Pill({
  tone = 'muted',
  children
}: {
  tone?: Tone
  children: ReactNode
}): React.JSX.Element {
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 font-mono text-xs whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  const t = Date.parse(iso)
  if (Number.isNaN(t)) {
    return iso
  }
  const s = (Date.now() - t) / 1000
  const abs = Math.abs(s)
  const v =
    abs < 60
      ? `${Math.round(abs)}s`
      : abs < 3600
        ? `${Math.round(abs / 60)}m`
        : abs < 86400
          ? `${Math.round(abs / 3600)}h`
          : `${Math.round(abs / 86400)}d`
  return s >= 0 ? `${v} ago` : `in ${v}`
}

export function fmt(v: unknown): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toLocaleString() : v.toPrecision(4)
  }
  if (v === null || v === undefined || v === '') {
    return '—'
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

export function Md({ children, large }: { children: string; large?: boolean }): React.JSX.Element {
  return (
    <div className={`rh-prose ${large ? 'rh-prose-lg' : ''}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Links leave the app instead of navigating the renderer.
          a: ({ href, children: label }) => <ExtLink href={href ?? ''}>{label}</ExtLink>
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <label className={`flex flex-col gap-2 ${labelCls}`}>
      {label}
      {children}
    </label>
  )
}

/** Opens `href` in the system browser. */
export function ExtLink({
  href,
  children,
  className = linkCls,
  label
}: {
  href: string
  children: ReactNode
  className?: string
  label?: string
}): React.JSX.Element {
  return (
    <a
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        if (href) {
          void window.api.shell.openUrl(href)
        }
      }}
    >
      {children}
    </a>
  )
}

/** In-app link to another home route. */
export function Go({
  to,
  children,
  className = linkCls,
  title
}: {
  to: ResearchRoute
  children: ReactNode
  className?: string
  title?: string
}): React.JSX.Element {
  const navigate = useResearchRoute((s) => s.navigate)
  return (
    <a
      href="#"
      title={title}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

export function BackButton({ label }: { label: string }): React.JSX.Element {
  const back = useResearchRoute((s) => s.back)
  return (
    <button
      type="button"
      onClick={back}
      className={`-ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-terra-tint hover:text-ink ${interactive}`}
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {label}
    </button>
  )
}

/** Page title; detail pages put a back control above it. */
export function PageTitle({
  children,
  back
}: {
  children: ReactNode
  back?: string
}): React.JSX.Element {
  return (
    <Reveal as="header" className="space-y-2">
      {back && <BackButton label={back} />}
      <h1 className="text-3xl font-semibold tracking-tight break-words text-ink">{children}</h1>
    </Reveal>
  )
}

/** Renders into the home's overlay layer so drawers and lightboxes cover the home, not Orca. */
export function Overlay({ children }: { children: ReactNode }): React.ReactPortal | null {
  const host = document.getElementById(OVERLAY_ID)
  return host ? createPortal(children, host) : null
}

export function Cmd({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <code className="rounded-sm bg-line/50 px-1 py-0.5 font-mono text-[0.85em] break-words text-ink">
      {children}
    </code>
  )
}

/** Muted hint that organising happens through the agent's CLI, not the home. */
export function AgentBox({
  title = 'Organise with your agent',
  children
}: {
  title?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <Reveal
      as="div"
      className="border-l-2 border-terra/40 py-1 pl-4 text-sm leading-relaxed text-ink-muted"
    >
      <h2 className={`${labelCls} mb-1`}>{title}</h2>
      <p>{children}</p>
    </Reveal>
  )
}

const EXP_STATUS: Record<string, string> = {
  active: 'bg-ok',
  concluded: 'bg-terra',
  abandoned: 'bg-ink-muted'
}

export function ExpDot({ status }: { status: string }): React.JSX.Element {
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${EXP_STATUS[status] ?? 'bg-warn'}`}
      title={status}
      aria-label={status}
    />
  )
}

export function StatusPill({ status }: { status: string }): React.JSX.Element {
  return (
    <Pill tone={status === 'active' ? 'ok' : status === 'concluded' ? 'accent' : 'muted'}>
      {status}
    </Pill>
  )
}
