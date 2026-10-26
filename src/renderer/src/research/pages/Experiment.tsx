import { ArrowSquareOutIcon, TerminalWindowIcon } from '@phosphor-icons/react'
import { Fragment, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useExperiment, useHistories, useSaveExperimentNotes } from '../api/client'
import type { DiffRow, Direction, ExperimentJSON, RunJSON } from '../api/types'
import { LineChart } from '../Chart'
import { MediaPanel } from '../Media'
import { NotesCard } from '../NotesCard'
import { launchOmpDraft } from '../orca-agents'
import {
  BackButton,
  Bone,
  Card,
  Empty,
  ErrorBanner,
  ExtLink,
  Go,
  Pill,
  Reveal,
  StateDot,
  StatusPill,
  btnGhost,
  btnPrimary,
  fmt,
  interactive,
  labelCls,
  relTime,
  selectCls
} from '../ui'

const MAX_OVERLAY = 12
const DIRECTION: Record<Direction, string> = {
  max: 'higher is better',
  min: 'lower is better',
  '': ''
}

function ExperimentSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <Bone className="h-3 w-48" />
      <Bone className="h-10 w-2/3" />
      <Bone className="h-4 w-1/2" />
      <div className="space-y-3 border-t border-line pt-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-5" />
        ))}
      </div>
      <Bone className="h-48" />
    </div>
  )
}

function OpenInAgent({ id }: { id: string }): React.JSX.Element {
  const hasWorktree = useAppStore((s) => !!s.activeWorktreeId)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons swallow pointer events, so the span keeps the tooltip reachable. */}
        <span className="inline-flex">
          <button
            type="button"
            className={btnGhost}
            disabled={!hasWorktree}
            onClick={() => launchOmpDraft(`research-os exp show ${id}`)}
          >
            <TerminalWindowIcon className="size-4" aria-hidden />
            Open in agent
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {hasWorktree
          ? `Start omp in the active workspace with "research-os exp show ${id}" drafted`
          : 'Select a workspace in the sidebar to open this in an agent'}
      </TooltipContent>
    </Tooltip>
  )
}

export function Experiment({ id }: { id: string }): React.JSX.Element {
  const { data, error, isPending } = useExperiment(id)
  const saveNotes = useSaveExperimentNotes(id)

  if (isPending) {
    return (
      <div className="space-y-4">
        <BackButton label="Back" />
        <ExperimentSkeleton />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <BackButton label="Back" />
        <ErrorBanner error={error} />
      </div>
    )
  }
  const e = data.experiment
  const trackParts = e.track ? e.track.split('/') : []
  const none = <span className="text-ink-muted">None</span>

  return (
    <div className="space-y-6">
      <Reveal as="header" className="space-y-4">
        <BackButton label="Back" />
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-muted"
        >
          <Go to={{ page: 'project', key: e.project }} className={`hover:text-ink ${interactive}`}>
            {e.project}
          </Go>
          {trackParts.map((t, i) => (
            <span key={i} className="contents">
              <span className="text-line-strong">/</span>
              <Go
                to={{
                  page: 'project',
                  key: e.project,
                  track: trackParts.slice(0, i + 1).join('/')
                }}
                className={`hover:text-ink ${interactive}`}
              >
                {t}
              </Go>
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-72 space-y-3">
            <h1 className="max-w-[680px] text-3xl font-semibold tracking-tight break-words">
              {e.title || e.id}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill status={e.status} />
              {e.kind && <Pill>{e.kind}</Pill>}
              <span className="font-mono text-ink-muted">
                {e.id} · {e.owner} · created {e.created} · {e.n_runs} runs
                {e.n_running > 0 && ` · ${e.n_running} running`} · updated {relTime(e.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OpenInAgent id={e.id} />
            {e.wandb_group_url && (
              <ExtLink href={e.wandb_group_url} className={btnPrimary}>
                W&B group <ArrowSquareOutIcon className="size-4" />
              </ExtLink>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal as="div">
        <dl className="grid border-t border-line-strong sm:grid-cols-[9rem_1fr]">
          {(
            [
              [
                'Hypothesis',
                <span key="hypothesis" className="text-base leading-relaxed">
                  {e.hypothesis || none}
                </span>
              ],
              [
                'Verdict',
                <span key="verdict" className="text-base leading-relaxed">
                  {e.verdict || <span className="text-ink-muted">Not concluded</span>}
                </span>
              ],
              [
                'Metric',
                <Fragment key="metric">
                  {e.metric ? <span className="font-mono text-sm">{e.metric}</span> : none}
                  {e.direction && (
                    <span className="text-ink-muted"> · {DIRECTION[e.direction]}</span>
                  )}
                </Fragment>
              ],
              [
                'Baseline arm',
                <span key="baseline" className="font-mono text-sm">
                  {e.baseline_arm || none}
                </span>
              ]
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className={`border-line pt-3 sm:border-b sm:pb-3 ${labelCls}`}>{k}</dt>
              <dd className="border-b border-line pt-1 pb-3 text-sm break-words whitespace-pre-wrap sm:pt-3">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Arms e={e} runs={data.runs} />
      <Diff e={e} rows={data.diff} />
      <Curves e={e} runs={data.runs} />
      <Card title="Media">
        <MediaPanel runs={data.runs} inference={e.kind === 'inference'} />
      </Card>
      <NotesCard
        value={e.notes}
        onSave={(v) => saveNotes.mutate(v)}
        saving={saveNotes.isPending}
        error={saveNotes.error}
        placeholder="Markdown notes: setup, observations, links…"
      />
    </div>
  )
}

function Arms({ e, runs }: { e: ExperimentJSON; runs: RunJSON[] }): React.JSX.Element {
  const cols = useMemo(() => [...new Set(runs.flatMap((r) => Object.keys(r.evals)))].sort(), [runs])
  const baselines = new Set([e.baseline_arm, ...runs.map((r) => r.baseline_arm)].filter(Boolean))
  const row = (r: RunJSON, nested: boolean): React.JSX.Element => (
    <tr
      key={r.run_id}
      className={`border-b border-line last:border-0 ${nested ? 'text-ink-muted' : ''}`}
    >
      <td className={`py-2 pr-3 whitespace-nowrap ${nested ? 'pl-6' : ''}`}>
        {nested && <span aria-hidden>↳ </span>}
        <ExtLink href={r.url}>{nested ? r.protocol || r.name : r.arm || r.name}</ExtLink>{' '}
        {!nested && baselines.has(r.arm) && <Pill tone="accent">baseline</Pill>}
        {!nested && r.baseline_arm && (
          <span className="text-xs text-ink-muted"> vs {r.baseline_arm}</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <StateDot state={r.state} />
      </td>
      <td className="py-2 pr-3 text-xs">{r.job_type || '—'}</td>
      <td className="py-2 pr-3 text-right">{fmt(r.step)}</td>
      {cols.map((c) => (
        <td key={c} className="py-2 pr-3 text-right">
          {fmt(r.evals[c])}
        </td>
      ))}
      <td className="py-2 pr-3 font-mono text-xs">{r.wandb_project || r.project}</td>
    </tr>
  )
  return (
    <Card title="Arms">
      {runs.length ? (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b border-line text-left ${labelCls}`}>
                <th className="py-2 pr-3 font-medium">Arm</th>
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 pr-3 font-medium">Job</th>
                <th className="py-2 pr-3 text-right font-medium">Step</th>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="py-2 pr-3 text-right font-mono font-medium whitespace-nowrap"
                  >
                    {c.replace(/^eval\//, '')}
                  </th>
                ))}
                <th className="py-2 pr-3 font-medium">W&B project</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <Fragment key={r.run_id}>
                  {row(r, false)}
                  {r.attached.map((a) => row(a, true))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty hint={`Log W&B runs with config.exp = ${e.id}.`}>No runs yet.</Empty>
      )}
    </Card>
  )
}

function Diff({ e, rows }: { e: ExperimentJSON; rows: DiffRow[] }): React.JSX.Element {
  return (
    <Card
      title="Diff vs baseline"
      action={
        e.direction && <span className="text-xs text-ink-muted">{DIRECTION[e.direction]}</span>
      }
    >
      {!e.metric ? (
        <Empty hint="Ask your agent to set one.">No metric set.</Empty>
      ) : rows.length ? (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b border-line text-left ${labelCls}`}>
                {['Arm', 'Baseline', 'Step', e.metric, 'Baseline value', 'Rel gap', 'Verdict'].map(
                  (h) => (
                    <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.arm + r.url} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3">{r.arm}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.baseline_arm || '—'}</td>
                  <td className="py-2 pr-3">{fmt(r.step)}</td>
                  <td className="py-2 pr-3">{fmt(r.value)}</td>
                  <td className="py-2 pr-3">{fmt(r.baseline)}</td>
                  <td className="py-2 pr-3">
                    {r.rel_gap == null ? '—' : `${(100 * r.rel_gap).toFixed(2)}%`}
                  </td>
                  <td className="py-2 pr-3">
                    <Pill
                      tone={r.verdict === 'better' ? 'ok' : r.verdict === 'worse' ? 'bad' : 'muted'}
                    >
                      {r.verdict ?? '—'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No arms with a baseline.</Empty>
      )}
    </Card>
  )
}

function Curves({ e, runs }: { e: ExperimentJSON; runs: RunJSON[] }): React.JSX.Element {
  const overlay = useMemo(
    () => runs.slice(0, MAX_OVERLAY).map((r) => ({ ...r, project: r.wandb_project || r.project })),
    [runs]
  )
  const keys = useMemo(
    () =>
      [
        ...new Set(overlay.flatMap((r) => [...Object.keys(r.metrics), ...Object.keys(r.evals)]))
      ].sort(),
    [overlay]
  )
  const [pick, setPick] = useState<string | null>(null)
  const fallback =
    e.kind === 'training' && keys.includes('train/loss')
      ? 'train/loss'
      : (keys.find((k) => k.startsWith('eval/')) ?? keys[0] ?? '')
  const metric = pick ?? fallback
  const histories = useHistories(overlay, metric ? [metric] : [])
  const loaded = histories.map((h) => h.dataUpdatedAt).join()
  const series = useMemo(
    () =>
      overlay.flatMap((r, i) => {
        const h = histories[i]?.data
        return h ? [{ label: r.arm || r.name, rows: h.rows }] : []
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `histories` is a new array every render; `loaded` tracks its data
    [overlay, loaded]
  )
  return (
    <Card
      title={`Curves${runs.length > MAX_OVERLAY ? ` (first ${MAX_OVERLAY} runs)` : ''}`}
      action={
        keys.length > 0 && (
          <select
            className={selectCls}
            value={metric}
            onChange={(ev) => setPick(ev.target.value)}
            aria-label="Curve metric"
          >
            {keys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        )
      }
    >
      {!metric ? (
        <Empty>No numeric metrics.</Empty>
      ) : histories.some((h) => h.isPending) ? (
        <Bone className="h-64" />
      ) : (
        <>
          <ErrorBanner error={histories.find((h) => h.error)?.error} />
          <LineChart metric={metric} series={series} />
        </>
      )}
    </Card>
  )
}
