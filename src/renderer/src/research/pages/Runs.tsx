import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useAppState, useRuns } from '../api/client'
import type { RunJSON } from '../api/types'
import {
  Bone,
  Empty,
  ErrorBanner,
  Field,
  Go,
  PageTitle,
  Pill,
  Reveal,
  StateDot,
  fmt,
  interactive,
  labelCls,
  relTime,
  selectCls
} from '../ui'
import { RunDrawer } from './runs/RunDrawer'

const WINDOWS = [
  { h: 24, label: '24 h' },
  { h: 72, label: '3 d' },
  { h: 168, label: '7 d' },
  { h: 720, label: '30 d' }
]

function keyMetric(r: RunJSON): [string, number] | null {
  if ('train/loss' in r.metrics) {
    return ['train/loss', r.metrics['train/loss']]
  }
  return Object.entries(r.metrics)[0] ?? null
}

type Col = { key: string; label: string; sort: (r: RunJSON) => string | number; className?: string }
const COLS: Col[] = [
  { key: 'project', label: 'Project', sort: (r) => r.project, className: 'hidden lg:table-cell' },
  { key: 'exp', label: 'Exp', sort: (r) => r.exp },
  { key: 'name', label: 'Arm or name', sort: (r) => r.arm || r.name },
  { key: 'job', label: 'Job', sort: (r) => r.job_type },
  { key: 'state', label: 'State', sort: (r) => r.state },
  { key: 'step', label: 'Step', sort: (r) => r.step ?? -1, className: 'text-right' },
  {
    key: 'runtime',
    label: 'Runtime',
    sort: (r) => r.runtime_h ?? -1,
    className: 'text-right hidden md:table-cell'
  },
  { key: 'updated', label: 'Updated', sort: (r) => r.updated_at ?? '' },
  {
    key: 'metric',
    label: 'Key metric',
    sort: (r) => keyMetric(r)?.[1] ?? Infinity,
    className: 'text-right hidden md:table-cell'
  },
  { key: 'flags', label: 'Flags', sort: (r) => r.flags.length }
]

type Filters = {
  project: string
  hours: number
  exp: string
  state: string
  owner: string
  job: string
  q: string
  sort: string
  desc: boolean
}

function RunsTableSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-busy="true">
      <Bone className="h-4 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4">
          <Bone className="h-4" />
          <Bone className="h-4" />
          <Bone className="h-4" />
          <Bone className="h-4" />
          <Bone className="h-4" />
        </div>
      ))}
    </div>
  )
}

export function Runs({
  project: initProject,
  state: initState
}: {
  project?: string
  state?: string
}): React.JSX.Element {
  const { data: appState } = useAppState()
  const projects = appState?.projects.map((p) => p.project) ?? []
  const [f, setF] = useState<Filters>({
    project: initProject ?? '',
    hours: 24,
    exp: '',
    state: initState ?? '',
    owner: '',
    job: '',
    q: '',
    sort: 'updated',
    desc: true
  })
  const [openId, setOpenId] = useState<string | null>(null)
  const set = <K extends keyof Filters>(k: K, v: Filters[K]): void =>
    setF((prev) => ({ ...prev, [k]: v }))
  const project = f.project || projects[0] || ''

  // Debounce the server side exp filter so typing does not fire a query per keystroke.
  const [expInput, setExpInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setF((prev) => ({ ...prev, exp: expInput })), 400)
    return () => clearTimeout(t)
  }, [expInput])

  const { data, error, isPending, isPlaceholderData } = useRuns({
    project: project || undefined,
    hours: f.hours,
    exp: f.exp || undefined
  })

  const rows = useMemo(() => {
    const needle = f.q.toLowerCase()
    const col = COLS.find((c) => c.key === f.sort) ?? COLS[7]
    return (data?.runs ?? [])
      .filter(
        (r) =>
          (!f.state || r.state === f.state) &&
          (!f.owner || r.owner === f.owner) &&
          (!f.job || r.job_type === f.job) &&
          (!needle || `${r.name} ${r.arm}`.toLowerCase().includes(needle))
      )
      .sort((a, b) => {
        const x = col.sort(a)
        const y = col.sort(b)
        const c = x < y ? -1 : x > y ? 1 : 0
        return f.desc ? -c : c
      })
  }, [data, f])
  const jobTypes = useMemo(
    () => [
      ...new Set([
        'train',
        'eval',
        'caption',
        'judge',
        'probe',
        'analysis',
        ...(data?.runs ?? []).map((r) => r.job_type).filter(Boolean)
      ])
    ],
    [data]
  )

  const open = data?.runs.find((r) => r.run_id === openId)

  return (
    <div className="space-y-6">
      <PageTitle>Runs</PageTitle>
      <Reveal as="div" className="flex flex-wrap items-end gap-3">
        <Field label="Project">
          <select
            className={selectCls}
            value={project}
            onChange={(e) => set('project', e.target.value)}
          >
            {projects.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Window">
          <select
            className={selectCls}
            value={f.hours}
            onChange={(e) => set('hours', Number(e.target.value))}
          >
            {WINDOWS.map((w) => (
              <option key={w.h} value={w.h}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exp">
          <input
            className={`${selectCls} w-36`}
            value={expInput}
            onChange={(e) => setExpInput(e.target.value)}
            placeholder="group"
          />
        </Field>
        <Field label="State">
          <select
            className={selectCls}
            value={f.state}
            onChange={(e) => set('state', e.target.value)}
          >
            <option value="">any</option>
            <option>running</option>
            <option>finished</option>
            <option>crashed</option>
          </select>
        </Field>
        <Field label="Owner">
          <select
            className={selectCls}
            value={f.owner}
            onChange={(e) => set('owner', e.target.value)}
          >
            <option value="">any</option>
            <option>agent</option>
            <option>human</option>
          </select>
        </Field>
        <Field label="Job type">
          <select className={selectCls} value={f.job} onChange={(e) => set('job', e.target.value)}>
            <option value="">any</option>
            {jobTypes.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className={`${selectCls} w-44`}
            type="search"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="name or arm"
          />
        </Field>
      </Reveal>

      <ErrorBanner error={error} />
      {!project && appState ? (
        <Empty hint="Add wandb_projects to a project in the registry from your agent.">
          No W&B projects configured.
        </Empty>
      ) : isPending ? (
        !error && <RunsTableSkeleton />
      ) : (
        <Reveal
          className={`overflow-x-auto rounded-lg border border-line bg-surface transition-opacity duration-300 ease-weighted ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 ${labelCls} ${c.className ?? ''}`}
                    aria-sort={f.sort === c.key ? (f.desc ? 'descending' : 'ascending') : undefined}
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 hover:text-ink ${interactive}`}
                      onClick={() =>
                        setF((prev) => ({
                          ...prev,
                          sort: c.key,
                          desc: !(prev.sort === c.key && prev.desc)
                        }))
                      }
                    >
                      {c.label}
                      {f.sort === c.key &&
                        (f.desc ? (
                          <ArrowDownIcon className="size-3" />
                        ) : (
                          <ArrowUpIcon className="size-3" />
                        ))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const km = keyMetric(r)
                return (
                  <tr
                    key={r.run_id}
                    tabIndex={0}
                    onClick={() => setOpenId(r.run_id)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpenId(r.run_id)}
                    className={`cursor-pointer border-b border-line transition-colors duration-300 ease-weighted last:border-0 hover:bg-terra-tint ${r.run_id === openId ? 'bg-terra-tint' : ''}`}
                  >
                    <td className="hidden px-3 py-2 font-mono text-xs lg:table-cell">
                      {r.project}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2 font-mono text-xs">
                      {r.exp ? (
                        <Go
                          to={{ page: 'experiment', id: r.exp }}
                          className="underline-offset-2 hover:text-terra hover:underline"
                        >
                          {r.exp}
                        </Go>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2" title={r.name}>
                      {r.arm || r.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">{r.job_type || '—'}</td>
                    <td className="px-3 py-2">
                      <StateDot state={r.state} />
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(r.step)}</td>
                    <td className="hidden px-3 py-2 text-right md:table-cell">
                      {r.runtime_h == null ? '—' : `${r.runtime_h.toFixed(1)} h`}
                    </td>
                    <td
                      className="px-3 py-2 whitespace-nowrap text-ink-muted"
                      title={r.updated_at ?? ''}
                    >
                      {relTime(r.updated_at)}
                    </td>
                    <td className="hidden px-3 py-2 text-right md:table-cell" title={km?.[0]}>
                      {km ? fmt(km[1]) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {r.flags.map((flag) => (
                          <Pill key={flag} tone={flag.startsWith('crash') ? 'bad' : 'warn'}>
                            {flag}
                          </Pill>
                        ))}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="px-3 py-2">
              <Empty hint="Widen the window or clear a filter.">No runs match.</Empty>
            </div>
          )}
        </Reveal>
      )}
      {openId && (
        <RunDrawer
          project={open?.project ?? project}
          runId={openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
