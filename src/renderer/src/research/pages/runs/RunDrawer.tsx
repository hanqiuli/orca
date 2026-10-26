import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useHistory, useRun } from '../../api/client'
import { LineChart } from '../../Chart'
import {
  Bone,
  Empty,
  ErrorBanner,
  ExtLink,
  Overlay,
  Pill,
  Skeleton,
  StateDot,
  btnPrimary,
  fmt,
  iconBtn,
  labelCls,
  relTime,
  selectCls
} from '../../ui'

export function RunDrawer({
  project,
  runId,
  onClose
}: {
  project: string
  runId: string
  onClose: () => void
}): React.JSX.Element {
  const { data, error, isPending } = useRun(project, runId)
  const [key, setKey] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = data?.run
  const metricKeys = useMemo(
    () =>
      run
        ? [...new Set([...Object.keys(run.metrics), ...Object.keys(run.evals)])].sort(
            (a, b) =>
              Number(b === 'train/loss') - Number(a === 'train/loss') ||
              Number(b.startsWith('eval/')) - Number(a.startsWith('eval/')) ||
              a.localeCompare(b)
          )
        : [],
    [run]
  )
  const metric = key ?? metricKeys[0] ?? ''
  const hist = useHistory(project, runId, metric ? [metric] : [])
  const series = useMemo(
    () => (hist.data ? [{ label: metric, rows: hist.data.rows }] : []),
    [hist.data, metric]
  )
  const cfg = data?.config ?? {}

  const contract: [string, unknown][] = run
    ? [
        ['exp', run.exp],
        ['arm', run.arm],
        ['baseline_arm', run.baseline_arm],
        ['axis', run.axis && `${run.axis} = ${run.axis_value}`],
        ['owner', run.owner],
        [
          'parent',
          cfg.parent_run_id &&
            `${String(cfg.parent_run_id)}${cfg.parent_step != null ? ` @ ${String(cfg.parent_step)}` : ''}`
        ],
        ['code_rev', run.code_rev],
        ['seed', cfg.seed],
        ['batch', cfg.global_batch],
        ['resolution', cfg.resolution],
        ['dataset', cfg.dataset_id]
      ]
    : []

  return (
    <Overlay>
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Run details"
        className="scrollbar-sleek absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-line bg-surface shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_8%,transparent),0_8px_24px_color-mix(in_srgb,var(--ink)_6%,transparent)] sm:w-[36rem]"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-6 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{run?.name ?? runId}</div>
            <div className="truncate font-mono text-xs text-ink-muted">
              {project} / {runId}
            </div>
          </div>
          {run && (
            <ExtLink href={run.url} className={btnPrimary}>
              W&B <ArrowSquareOutIcon className="size-4" />
            </ExtLink>
          )}
          <button type="button" onClick={onClose} className={iconBtn} aria-label="Close">
            <XIcon className="size-4" />
          </button>
        </header>
        <div className="space-y-6 p-6">
          <ErrorBanner error={error} />
          {isPending && <Skeleton lines={10} />}
          {run && data && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StateDot state={run.state} />
                {run.status && <Pill>{run.status}</Pill>}
                {run.verdict && (
                  <Pill
                    tone={
                      run.verdict === 'better' ? 'ok' : run.verdict === 'worse' ? 'bad' : 'muted'
                    }
                  >
                    {run.verdict}
                  </Pill>
                )}
                {run.flags.map((flag) => (
                  <Pill key={flag} tone="warn">
                    {flag}
                  </Pill>
                ))}
                <span className="text-ink-muted">
                  step {fmt(run.step)} ·{' '}
                  {run.runtime_h == null ? '—' : `${run.runtime_h.toFixed(1)} h`} · updated{' '}
                  {relTime(run.updated_at)}
                </span>
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {contract.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="self-center font-mono text-xs break-all">{fmt(v)}</dd>
                  </div>
                ))}
              </dl>

              {run.hypothesis && (
                <div>
                  <h3 className={`${labelCls} mb-1`}>Hypothesis</h3>
                  <p className="text-sm">{run.hypothesis}</p>
                </div>
              )}
              {data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.tags.map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              )}
              {data.notes && (
                <p className="text-sm whitespace-pre-wrap text-ink-muted">{data.notes}</p>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className={labelCls}>History</h3>
                  {metricKeys.length > 0 && (
                    <select
                      className={selectCls}
                      value={metric}
                      onChange={(e) => setKey(e.target.value)}
                      aria-label="Metric"
                    >
                      {metricKeys.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  )}
                </div>
                <ErrorBanner error={hist.error} />
                {!metric ? (
                  <Empty>No numeric metrics.</Empty>
                ) : hist.isPending ? (
                  <Bone className="h-56" />
                ) : (
                  <LineChart metric={metric} series={series} height={220} />
                )}
              </div>

              <div>
                <h3 className={`${labelCls} mb-1`}>Evals</h3>
                {Object.keys(run.evals).length ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(run.evals).map(([k, v]) => (
                        <tr key={k} className="border-b border-line last:border-0">
                          <td className="py-1 font-mono text-xs">{k}</td>
                          <td className="py-1 text-right">{fmt(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Empty>No eval/* metrics.</Empty>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </Overlay>
  )
}
