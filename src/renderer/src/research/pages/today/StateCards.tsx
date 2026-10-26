import { useAppState } from '../../api/client'
import { Card, Empty, Go, Pill, interactive, relTime } from '../../ui'

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

export function StateCards(): React.JSX.Element | null {
  const { data: s } = useAppState()
  if (!s) {
    return null
  }
  const latestMemory = s.memory
    .filter((m) => !m.path.endsWith('INDEX.md') && !m.path.startsWith('_'))
    .sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)))
    .slice(0, 3)
  const running = s.projects.flatMap((p) =>
    p.runs.filter((r) => r.state === 'running').map((r) => ({ p: p.project, r }))
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {running.length > 0 && (
        <Card title="Running">
          <ul className="divide-y divide-line">
            {running.map(({ p, r }) => (
              <li key={`${p}/${r.run_id}`}>
                <Go
                  to={{ page: 'runs', project: p, state: 'running' }}
                  className={`flex items-center justify-between gap-2 py-2 hover:text-terra ${interactive}`}
                >
                  <span className="truncate text-sm">{r.name || r.run_id}</span>
                  <span className="flex shrink-0 gap-2">
                    {r.flags.length > 0 && <Pill tone="warn">flagged</Pill>}
                    <span className="font-mono text-xs text-ink-muted">{p}</span>
                  </span>
                </Go>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.campaigns.length > 0 && (
        <Card title="Campaigns">
          <ul className="divide-y divide-line">
            {s.campaigns.map((c) => (
              <li key={c.id}>
                <Go
                  to={{ page: 'campaign', id: c.id }}
                  className={`block py-2 hover:text-terra ${interactive}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{c.id}</span>
                    {c.stopped && <Pill tone="bad">stopped</Pill>}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Pill tone="ok">{c.counts.kept ?? 0} kept</Pill>
                    <Pill tone="bad">{c.counts.aborted ?? 0} aborted</Pill>
                    <Pill>{c.counts.running ?? 0} running</Pill>
                  </div>
                </Go>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.pipelines.length > 0 && (
        <Card title="Pipelines">
          <ul className="space-y-3">
            {s.pipelines.map((p) => {
              const pct = p.total ? Math.min(100, (100 * p.done) / p.total) : 0
              return (
                <li key={p.name}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-ink-muted">{pct.toFixed(1)}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={p.name}
                  >
                    <div
                      className={`h-full ${p.stale ? 'bg-warn' : 'bg-ok'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {p.stale && <span className="text-warn">stale · </span>}
                    {[p.rate, p.note, `updated ${relTime(p.updated)}`].filter(Boolean).join(' · ')}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {s.expiries.length > 0 && (
        <Card title="Expiries">
          <ul className="space-y-2">
            {s.expiries.map((e) => (
              <li key={e.name + e.date} className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0">
                  {e.name}
                  <span className="block text-xs text-ink-muted">
                    {e.date}
                    {e.note && ` · ${e.note}`}
                  </span>
                </span>
                <Pill tone={e.days_left <= 7 ? 'bad' : 'muted'}>{e.days_left}d</Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.board && (s.board.sessions.length > 0 || s.board.claims.length > 0) && (
        <Card title="Board">
          <div className="space-y-3 text-sm">
            <div>
              <h3 className="mb-1 text-xs text-ink-muted">Sessions ({s.board.sessions.length})</h3>
              {s.board.sessions.length ? (
                <ul className="space-y-1">
                  {s.board.sessions.map((x) => (
                    <li key={str(x.id)} className="min-w-0">
                      <span className="font-mono">{str(x.id)}</span>
                      <span className="text-ink-muted"> · {str(x.focus || x.task) || '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No live sessions.</Empty>
              )}
            </div>
            <div>
              <h3 className="mb-1 text-xs text-ink-muted">Claims ({s.board.claims.length})</h3>
              {s.board.claims.length ? (
                <ul className="space-y-1">
                  {s.board.claims.map((c) => (
                    <li key={str(c.display || c.key)} className="break-all">
                      <span className="font-mono">{str(c.display || c.key)}</span>
                      <span className="text-ink-muted"> → {str(c.holder)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No claims.</Empty>
              )}
            </div>
          </div>
        </Card>
      )}

      {latestMemory.length > 0 && (
        <Card title="Latest memory" className="md:col-span-2">
          <ul className="-my-2 divide-y divide-line">
            {latestMemory.map((m) => (
              <li key={m.path} className="min-w-0 py-2">
                <div className="truncate text-base leading-snug font-medium">
                  {m.heading || m.path}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-ink-muted" title={m.path}>
                  {relTime(m.mtime)} · {m.path}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
