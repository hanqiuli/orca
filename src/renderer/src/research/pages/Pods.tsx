import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useNow } from '@/hooks/use-now'
import { usePods } from '../api/client'
import type { GroupJSON, PodGpu, PodJSON } from '../api/types'
import {
  AgentBox,
  Bone,
  Card,
  Cmd,
  Empty,
  ErrorBanner,
  ExtLink,
  Go,
  PageTitle,
  Pill,
  Reveal,
  labelCls,
  relTime
} from '../ui'

const H = 3600_000
const QUIET: Record<string, true> = { staging: true, reserved: true, off: true }
const ALERT = {
  idle: { tone: 'warn', label: 'idle' },
  unreachable: { tone: 'bad', label: 'unreachable' },
  expiring: { tone: 'warn', label: 'expiring' }
} as const

/** Quiet states mark deliberate idleness (staging, reservations); they never raise idle alerts. */
export const isQuiet = (p: PodJSON): boolean => QUIET[p.state] === true

function countdown(iso: string, now: number): string {
  const ms = Date.parse(iso) - now
  const abs = Math.abs(ms)
  const d = Math.floor(abs / (24 * H))
  const h = Math.floor((abs % (24 * H)) / H)
  const m = Math.floor((abs % H) / 60_000)
  const v = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  return ms >= 0 ? `in ${v}` : `${v} ago`
}

function Expiry({ iso }: { iso: string }): React.JSX.Element {
  const now = useNow(30_000)
  const left = Date.parse(iso) - now
  const cls =
    left <= 6 * H
      ? 'font-medium text-bad'
      : left <= 48 * H
        ? 'font-medium text-warn'
        : 'text-ink-muted'
  return (
    <span className={cls} title={iso}>
      Capacity ends {countdown(iso, now)}
    </span>
  )
}

/** 24 h max GPU util sparkline; x is wall time and the line breaks where samples are missing (over 25 min apart). */
function Sparkline({ points }: { points: [string, number][] }): React.JSX.Element {
  const now = useNow(30_000)
  if (!points.length) {
    return (
      <div className="grid h-8 place-items-center rounded-md bg-paper text-xs text-ink-muted">
        No samples in 24 h
      </div>
    )
  }
  const start = now - 24 * H
  const segments: string[][] = []
  let prev = -Infinity
  for (const [ts, u] of points) {
    const t = Date.parse(ts)
    if (t - prev > 25 * 60_000) {
      segments.push([])
    }
    prev = t
    segments
      .at(-1)
      ?.push(
        `${(((t - start) / (24 * H)) * 144).toFixed(1)},${(31 - (Math.min(u, 100) / 100) * 30).toFixed(1)}`
      )
  }
  return (
    <svg
      viewBox="0 0 144 32"
      preserveAspectRatio="none"
      className="h-8 w-full rounded-md bg-paper"
      role="img"
      aria-label={`GPU utilisation, last 24 h, latest ${points.at(-1)?.[1]}%`}
    >
      {segments.map((s, i) => (
        <polyline
          key={i}
          points={s.length === 1 ? `${s[0]} ${s[0]}` : s.join(' ')}
          fill="none"
          stroke="var(--terra)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function Bar({ pct, cls }: { pct: number; cls: string }): React.JSX.Element {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div className={`h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

function GpuRow({ g }: { g: PodGpu }): React.JSX.Element {
  const util = g.util ?? 0
  const mem = g.mem_total_mb ? (100 * (g.mem_used_mb ?? 0)) / g.mem_total_mb : 0
  return (
    <li
      className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-x-2 gap-y-0.5 text-xs"
      title={`gpu${g.index}: ${util}% util, ${g.mem_used_mb ?? '?'} / ${g.mem_total_mb ?? '?'} MiB`}
    >
      <span className="row-span-2 font-mono text-ink-muted">gpu{g.index}</span>
      <Bar pct={util} cls={util < 5 ? 'bg-ink-muted' : 'bg-ok'} />
      <span className="text-right">{util}%</span>
      <Bar pct={mem} cls="bg-terra/70" />
      <span className="text-right text-ink-muted">{((g.mem_used_mb ?? 0) / 1024).toFixed(0)}G</span>
    </li>
  )
}

/** One node. Inside a group the state, quiet window and expiry are the group's, shown on the group header instead. */
function PodCard({ p, inGroup = false }: { p: PodJSON; inGroup?: boolean }): React.JSX.Element {
  const quiet = isQuiet(p)
  const now = useNow(30_000)
  const alert = p.alert ? ALERT[p.alert] : null
  const last = p.last
  return (
    <Card className={quiet && !inGroup ? 'opacity-80' : ''}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{p.name}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="font-mono">{p.host}</span> · {p.provider}
            {p.gpus.count > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="whitespace-nowrap text-ink">
                  {p.gpus.count}×{p.gpus.model}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {alert && <Pill tone={alert.tone}>{alert.label}</Pill>}
          {!inGroup && <Pill tone={quiet ? 'muted' : 'ok'}>{p.state}</Pill>}
        </div>
      </header>

      {(p.note || (p.until && !inGroup)) && (
        <p className={`mt-2 text-sm ${quiet ? 'text-ink-muted' : ''}`}>
          {p.note || <span className="text-ink-muted">No note</span>}
          {p.until && !inGroup && (
            <span className="text-ink-muted" title={p.until}>
              {' '}
              · back to active {countdown(p.until, now)}
            </span>
          )}
        </p>
      )}
      {p.expires && !inGroup && (
        <p className="mt-1 text-xs">
          <Expiry iso={p.expires} />
        </p>
      )}

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-ink-muted">
          <span>Max GPU util · 24 h</span>
          <span>{last ? `sampled ${relTime(last.ts)}` : 'never sampled'}</span>
        </div>
        <Sparkline points={p.util_24h} />
      </div>

      {last && !last.reachable && (
        <p className="mt-3 text-sm text-bad">SSH was unreachable at the last sample.</p>
      )}
      {last?.reachable && (
        <>
          {last.gpus.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {last.gpus.map((g) => (
                <GpuRow key={g.index} g={g} />
              ))}
            </ul>
          ) : (
            <Empty>No nvidia-smi output.</Empty>
          )}
          <p className="mt-2 truncate text-xs text-ink-muted">
            {last.procs} python proc{last.procs === 1 ? '' : 's'}
            {last.tmux.length > 0 && (
              <>
                {' '}
                · tmux <span className="font-mono">{last.tmux.join(', ')}</span>
              </>
            )}
          </p>
        </>
      )}

      <div className="mt-3 border-t border-line pt-2">
        <h3 className={`${labelCls} mb-1`}>Running</h3>
        {p.running_runs.length ? (
          <ul className="space-y-1">
            {p.running_runs.map((r) => (
              <li
                key={`${r.wandb_project}/${r.run_id}`}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span className="size-2 shrink-0 animate-pulse rounded-full bg-ok" aria-hidden />
                {r.exp ? (
                  <Go to={{ page: 'experiment', id: r.exp }} className="truncate hover:text-terra">
                    {r.exp}
                    {r.arm && <span className="text-ink-muted"> / {r.arm}</span>}
                  </Go>
                ) : (
                  <span className="truncate">{r.name}</span>
                )}
                <ExtLink
                  href={r.url}
                  label={`${r.name} on W&B`}
                  className="ml-auto shrink-0 text-ink-muted transition-colors duration-300 ease-weighted hover:text-terra"
                >
                  <ArrowSquareOutIcon className="size-4" />
                </ExtLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            {p.hostname
              ? 'No W&B run reports this host.'
              : 'Hostname unknown until the first sample.'}
          </p>
        )}
      </div>
    </Card>
  )
}

/** A capacity block: one framed unit with the shared state and expiry, its nodes inside. */
function GroupBlock({ g, nodes }: { g: GroupJSON; nodes: PodJSON[] }): React.JSX.Element {
  const quiet = QUIET[g.state] === true
  const now = useNow(30_000)
  const alert = g.alert ? ALERT[g.alert] : null
  return (
    <Reveal className={`rounded-lg border border-line-strong ${quiet ? 'opacity-85' : ''}`}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 pt-4 pb-3">
        <div className="min-w-0 space-y-1">
          <div className={labelCls}>
            Group · {g.members.length} node{g.members.length === 1 ? '' : 's'}
            {g.gpus.count > 0 && ` · ${g.gpus.count}×${g.gpus.model || '?'}`}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{g.name}</h2>
          {(g.note || g.until || g.expires) && (
            <p className="text-sm text-ink-muted">
              {g.note && <span className="text-ink">{g.note}</span>}
              {g.until && (
                <span title={g.until}>
                  {g.note && ' · '}back to active {countdown(g.until, now)}
                </span>
              )}
              {g.expires && (
                <>
                  {(g.note || g.until) && ' · '}
                  <Expiry iso={g.expires} />
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {alert && <Pill tone={alert.tone}>{alert.label}</Pill>}
          <Pill tone={quiet ? 'muted' : 'ok'}>{g.state}</Pill>
        </div>
      </header>
      {nodes.length ? (
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {nodes.map((p) => (
            <PodCard key={p.name} p={p} inGroup />
          ))}
        </div>
      ) : (
        <div className="px-6 py-4">
          <Empty
            hint={<Cmd>research-os pod add &lt;node&gt; &lt;tailnet ip&gt; --group {g.name}</Cmd>}
          >
            No nodes in this group yet.
          </Empty>
        </div>
      )}
    </Reveal>
  )
}

function PodCardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-busy="true">
      <Bone className="h-5 w-1/2" />
      <Bone className="h-3 w-2/3" />
      <Bone className="h-8" />
      <div className="grid grid-cols-2 gap-2">
        <Bone className="h-3" />
        <Bone className="h-3" />
      </div>
    </div>
  )
}

export function Pods(): React.JSX.Element {
  const { data, error, isPending } = usePods()
  const pods = data?.pods ?? []
  const groups = data?.groups ?? []
  const grouped = new Set(groups.map((g) => g.name))
  const standalone = pods.filter((p) => !p.group || !grouped.has(p.group))
  return (
    <div className="space-y-6">
      <PageTitle>Pods</PageTitle>
      <ErrorBanner error={error} />
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <PodCardSkeleton key={i} />
          ))}
        </div>
      ) : pods.length || groups.length ? (
        <>
          {groups.map((g) => (
            <GroupBlock key={g.name} g={g} nodes={pods.filter((p) => p.group === g.name)} />
          ))}
          {standalone.length > 0 && (
            <div className="space-y-3">
              {groups.length > 0 && <h2 className={labelCls}>Standalone pods</h2>}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {standalone.map((p) => (
                  <PodCard key={p.name} p={p} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        !error && <Empty hint="Register one with your agent, see below.">No pods registered.</Empty>
      )}
      <AgentBox title="Manage pods with your agent">
        One pod: <Cmd>research-os pod add &lt;name&gt; &lt;tailnet-ip&gt;</Cmd>. A capacity block of
        several nodes is one group: <Cmd>pod group add &lt;block&gt; --expires +14d</Cmd>, then{' '}
        <Cmd>pod add &lt;node&gt; &lt;ip&gt; --group &lt;block&gt;</Cmd> per node. The group sets
        state and expiry for all its nodes (
        <Cmd>pod group set &lt;block&gt; state=staging until=+6h</Cmd>), warns once before the block
        ends and is idle only when every node is. Samples every 10 min; idle alerts after 30 min,
        unreachable after 20 min.
      </AgentBox>
    </div>
  )
}
