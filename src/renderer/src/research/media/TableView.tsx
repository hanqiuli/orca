import { ArrowDownIcon, ArrowUpIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { apiHref, useTables } from '../api/client'
import {
  Empty,
  ErrorBanner,
  Skeleton,
  btnGhost,
  fmt,
  interactive,
  labelCls,
  selectCls
} from '../ui'
import { type Arm, StepSlider, entryAt, sortedSteps, useStep } from './arm-steps'

type Col = { label: string; wp: string; run: string }
const PAGE = 50

const isImageCell = (v: unknown): v is { _type: 'image-file'; path: string } =>
  !!v &&
  typeof v === 'object' &&
  '_type' in v &&
  v._type === 'image-file' &&
  'path' in v &&
  typeof v.path === 'string'

function Cell({ v, col }: { v: unknown; col: Col }): React.JSX.Element {
  if (isImageCell(v)) {
    const path = v.path.split('/').map(encodeURIComponent).join('/')
    return (
      <img
        src={apiHref(
          `/api/media/${encodeURIComponent(col.wp)}/${encodeURIComponent(col.run)}/${path}`
        )}
        alt={v.path}
        loading="lazy"
        className="h-16 w-auto rounded-sm border border-line"
      />
    )
  }
  if (typeof v === 'number' || v === null || v === undefined) {
    return <>{fmt(v)}</>
  }
  if (typeof v === 'object') {
    return <span className="font-mono text-xs">{JSON.stringify(v)}</span>
  }
  return <>{String(v)}</>
}

const sortKey = (v: unknown): string | number =>
  typeof v === 'number'
    ? v
    : isImageCell(v)
      ? v.path
      : v == null
        ? ''
        : typeof v === 'object'
          ? JSON.stringify(v)
          : String(v)

function TableGrid({ cols, rows }: { cols: Col[]; rows: unknown[][] }): React.JSX.Element {
  const [sort, setSort] = useState<{ c: number; desc: boolean } | null>(null)
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => {
    if (!sort) {
      return rows
    }
    return [...rows].sort((a, b) => {
      const x = sortKey(a[sort.c])
      const y = sortKey(b[sort.c])
      const c = x < y ? -1 : x > y ? 1 : 0
      return sort.desc ? -c : c
    })
  }, [rows, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const p = Math.min(page, pages - 1)
  return (
    <div className="space-y-2">
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {cols.map((c, i) => (
                <th
                  key={i}
                  className={`py-2 pr-3 whitespace-nowrap ${labelCls}`}
                  aria-sort={sort?.c === i ? (sort.desc ? 'descending' : 'ascending') : undefined}
                >
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 hover:text-ink ${interactive}`}
                    onClick={() =>
                      setSort(
                        sort?.c === i && !sort.desc
                          ? { c: i, desc: true }
                          : sort?.c === i
                            ? null
                            : { c: i, desc: false }
                      )
                    }
                  >
                    {c.label}
                    {sort?.c === i &&
                      (sort.desc ? (
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
            {sorted.slice(p * PAGE, (p + 1) * PAGE).map((r, ri) => (
              <tr key={ri} className="border-b border-line align-top last:border-0">
                {cols.map((c, ci) => (
                  <td key={ci} className="max-w-80 py-2 pr-3 break-words">
                    <Cell v={r[ci]} col={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-ink-muted">
        <span>
          {sorted.length.toLocaleString()} rows · page {p + 1} / {pages}
        </span>
        <button
          type="button"
          className={btnGhost}
          disabled={p === 0}
          onClick={() => setPage(p - 1)}
          aria-label="Previous page"
        >
          <CaretLeftIcon className="size-4" />
        </button>
        <button
          type="button"
          className={btnGhost}
          disabled={p >= pages - 1}
          onClick={() => setPage(p + 1)}
          aria-label="Next page"
        >
          <CaretRightIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function Tables({ arms, mkey }: { arms: Arm[]; mkey: string }): React.JSX.Element {
  const steps = sortedSteps(arms.map((a) => a.keys[mkey]))
  const [step, setStep] = useStep(steps)
  const [mode, setMode] = useState<string>(arms[0]?.run.run_id ?? '')
  const cols = arms.map((a) => ({ arm: a, url: entryAt(a.keys[mkey], step)?.items[0]?.url ?? '' }))
  const qs = useTables(cols.map((c) => c.url).filter(Boolean))
  const tables = cols.map((c) =>
    c.url ? qs[cols.filter((x) => x.url).indexOf(c)]?.data : undefined
  )
  const first = tables.find(Boolean)
  const defaultJoin = first
    ? Math.max(
        0,
        first.columns.findIndex((_, i) => first.data.some((r) => typeof r[i] === 'string'))
      )
    : 0
  const [joinPick, setJoin] = useState<string | null>(null)
  const join = joinPick ?? first?.columns[defaultJoin] ?? ''

  const view = useMemo(() => {
    if (mode !== 'join') {
      const i = cols.findIndex((c) => c.arm.run.run_id === mode)
      const t = tables[i]
      if (!t) {
        return null
      }
      const r = cols[i].arm.run
      return {
        cols: t.columns.map((label) => ({
          label,
          wp: r.wandb_project || r.project,
          run: r.run_id
        })),
        rows: t.data
      }
    }
    // Side by side: one row per join value, each arm's other columns next to each other.
    const present = cols.flatMap((c, i) => {
      const t = tables[i]
      return t ? [{ run: c.arm.run, label: c.arm.label, t }] : []
    })
    const others = [...new Set(present.flatMap((p) => p.t.columns.filter((c) => c !== join)))]
    const outCols: Col[] = [{ label: join, wp: '', run: '' }]
    for (const c of others) {
      for (const p of present) {
        outCols.push({
          label: `${c} · ${p.label}`,
          wp: p.run.wandb_project || p.run.project,
          run: p.run.run_id
        })
      }
    }
    const index = present.map((p) => {
      const j = p.t.columns.indexOf(join)
      return new Map(p.t.data.map((r) => [String(sortKey(r[j])), r]))
    })
    const keys = [...new Set(index.flatMap((m) => [...m.keys()]))]
    const rows = keys.map((k) => [
      k,
      ...others.flatMap((c) =>
        present.map((p, pi) => index[pi].get(k)?.[p.t.columns.indexOf(c)] ?? null)
      )
    ])
    return { cols: outCols, rows }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tables derive from the query data timestamps
  }, [mode, join, step, qs.map((q) => q.dataUpdatedAt).join()])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectCls}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          aria-label="Table view"
        >
          {arms.map((a) => (
            <option key={a.run.run_id} value={a.run.run_id}>
              {a.label}
            </option>
          ))}
          {arms.length > 1 && <option value="join">Side by side, all arms</option>}
        </select>
        {mode === 'join' && first && (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Join on
            <select
              className={`${selectCls} font-mono`}
              value={join}
              onChange={(e) => setJoin(e.target.value)}
              aria-label="Join column"
            >
              {first.columns.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <StepSlider steps={steps} value={step} onChange={setStep} label="Table step" />
      </div>
      <ErrorBanner error={qs.find((q) => q.error)?.error} />
      {qs.some((q) => q.isPending) ? (
        <Skeleton lines={5} />
      ) : view ? (
        <TableGrid key={`${mode}-${join}-${step}`} cols={view.cols} rows={view.rows} />
      ) : (
        <Empty>No table at this step.</Empty>
      )}
    </div>
  )
}
