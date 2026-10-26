import { CaretRightIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useCampaign, useCampaigns, useTrace } from '../api/client'
import type { CampaignJSON, TraceStep } from '../api/types'
import {
  AgentBox,
  Bone,
  Card,
  Cmd,
  Empty,
  ErrorBanner,
  Go,
  Md,
  PageTitle,
  Pill,
  Skeleton,
  fmt,
  interactive,
  labelCls,
  relTime,
  selectCls,
  type Tone
} from '../ui'

const EVENT_TONE: Record<string, Tone> = {
  init: 'ok',
  start: 'ok',
  nudge: 'accent',
  stop: 'bad',
  budget_stop: 'bad',
  eval_drift: 'warn'
}

function Counts({ c }: { c: CampaignJSON }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(c.counts).map(([k, v]) => (
        <Pill
          key={k}
          tone={k === 'kept' ? 'ok' : k === 'aborted' || k === 'crashed' ? 'bad' : 'muted'}
        >
          {v} {k}
        </Pill>
      ))}
    </div>
  )
}

export function CampaignCard({ c }: { c: CampaignJSON }): React.JSX.Element {
  return (
    <Go
      to={{ page: 'campaign', id: c.id }}
      className={`block rounded-lg border border-line bg-surface p-4 hover:border-terra/60 hover:bg-terra-tint ${interactive}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-medium">{c.id}</span>
        {c.stopped && <Pill tone="bad">stopped</Pill>}
      </div>
      <div className="mb-2 font-mono text-xs text-ink-muted">{c.project}</div>
      <Counts c={c} />
    </Go>
  )
}

function CampaignCardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface p-4" aria-busy="true">
      <Bone className="h-4 w-1/2" />
      <Bone className="h-3 w-1/4" />
      <div className="flex gap-2">
        <Bone className="h-5 w-16" />
        <Bone className="h-5 w-16" />
        <Bone className="h-5 w-16" />
      </div>
    </div>
  )
}

export function Campaigns(): React.JSX.Element {
  const { data, error, isPending } = useCampaigns()
  return (
    <div className="space-y-6">
      <PageTitle>Campaigns</PageTitle>
      <AgentBox title="What is a campaign">
        A campaign is an ablation loop the agent runs: it proposes one change, launches it on the
        one pod you named, a hidden grader scores it, and a keep rule decides. Start one from your
        agent:{' '}
        <Cmd>
          research-os campaign init &lt;project&gt; &lt;slug&gt; --repo &lt;path&gt; --metric
          &lt;eval/...&gt; --direction min|max --pod &lt;host&gt;
        </Cmd>
        ; steer it with <Cmd>campaign nudge &lt;id&gt; &quot;&lt;text&gt;&quot;</Cmd> and{' '}
        <Cmd>campaign stop &lt;id&gt;</Cmd>. The first campaign waits for a repo with an{' '}
        <Cmd>eval/adapter.sh</Cmd>.
      </AgentBox>
      <ErrorBanner error={error} />
      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : data?.campaigns.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.campaigns.map((c) => (
            <li key={c.id}>
              <CampaignCard c={c} />
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <Empty hint="Start one from your agent with the command above.">No campaigns yet.</Empty>
        )
      )}
    </div>
  )
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}

export function CampaignDetail({ id }: { id: string }): React.JSX.Element {
  const { data, error, isPending } = useCampaign(id)
  const c = data?.campaign
  const h = obj(c?.harness)
  const meta = obj(h.campaign)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0">
          <PageTitle back="Back">
            <span className="break-all">{id}</span>
          </PageTitle>
        </div>
        {c?.stopped && <Pill tone="bad">stopped</Pill>}
      </div>
      <ErrorBanner error={error} />
      {isPending && (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]" aria-busy="true">
          <div className="space-y-4">
            <Bone className="h-48" />
            <Bone className="h-32" />
          </div>
          <div className="space-y-4">
            <Bone className="h-24" />
            <Bone className="h-40" />
          </div>
        </div>
      )}
      {c && (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-4">
            <Card title="Results">
              {c.results.length ? (
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        {Object.keys(c.results[0]).map((k) => (
                          <th key={k} className={`py-2 pr-3 whitespace-nowrap ${labelCls}`}>
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.results.map((r, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          {Object.entries(r).map(([k, v]) => (
                            <td
                              key={k}
                              className={`py-2 pr-3 ${k === 'note' ? 'min-w-48' : 'whitespace-nowrap'} ${k === 'status' && v === 'kept' ? 'font-medium text-ok' : ''}`}
                            >
                              {v || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No results yet.</Empty>
              )}
            </Card>

            <Card title="Program">
              {c.program ? <Md>{c.program}</Md> : <Empty>program.md is empty.</Empty>}
            </Card>

            <Trace c={c} />
          </div>

          <div className="min-w-0 space-y-4">
            <AgentBox title="Steer from your agent">
              {c.stopped && 'Stopped, a STOP file is present. '}
              <Cmd>research-os campaign nudge {c.id} &quot;&lt;text&gt;&quot;</Cmd> appends to
              program.md; <Cmd>research-os campaign stop {c.id}</Cmd> aborts running arms.
            </AgentBox>

            <Card title="Harness">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {(
                  [
                    ['project', c.project],
                    ['metric', meta.metric],
                    ['direction', meta.direction],
                    ['kind', meta.kind],
                    ['pod', obj(h.hosts).pod],
                    ...Object.entries(obj(h.budget))
                  ] as [string, unknown][]
                ).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="self-center font-mono text-xs break-all">{fmt(v)}</dd>
                  </div>
                ))}
              </dl>
              {c.budget_lines.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-xs text-ink-muted">
                  {c.budget_lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Kept (${c.kept.length})`}>
              {c.kept.length ? (
                <ul className="space-y-2 text-sm">
                  {c.kept.map((k) => (
                    <li key={k.arm_id}>
                      <span className="font-mono">{k.arm_id}</span>
                      {k.metric && <span className="text-ink-muted"> · {k.metric}</span>}
                      {k.note && <div className="text-xs text-ink-muted">{k.note}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nothing kept yet.</Empty>
              )}
            </Card>

            <Card title="Ledger">
              {c.ledger.length ? (
                <ol className="ml-1 space-y-3 border-l border-line text-sm">
                  {c.ledger.toReversed().map((e, i) => (
                    <li key={i} className="relative pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={EVENT_TONE[e.event] ?? 'muted'}>{e.event}</Pill>
                        {e.arm_id && <span className="font-mono text-xs">{e.arm_id}</span>}
                        <span className="ml-auto text-xs text-ink-muted" title={e.ts}>
                          {relTime(e.ts)}
                        </span>
                      </div>
                      {Object.keys(e.data).length > 0 && (
                        <div className="mt-0.5 text-xs break-words text-ink-muted">
                          {Object.entries(e.data)
                            .map(([k, v]) => `${k}=${fmt(v)}`)
                            .join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty>The ledger is empty.</Empty>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Trace({ c }: { c: CampaignJSON }): React.JSX.Element {
  const arms = [
    ...new Set(
      [...c.results.map((r) => r.arm_id), ...c.ledger.map((e) => e.arm_id)].filter(Boolean)
    )
  ]
  const [pick, setArm] = useState<string | null>(null)
  const arm = pick && arms.includes(pick) ? pick : (arms[0] ?? '')
  const { data, error, isPending } = useTrace(c.id, arm)
  return (
    <Card
      title="Agent trace"
      action={
        arms.length > 0 && (
          <select
            className={selectCls}
            value={arm}
            onChange={(e) => setArm(e.target.value)}
            aria-label="Arm"
          >
            {arms.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )
      }
    >
      {!arm ? (
        <Empty>No arms yet.</Empty>
      ) : isPending ? (
        <Skeleton lines={4} />
      ) : error ? (
        <Empty>No trace for {arm}.</Empty>
      ) : data.steps.length ? (
        <ol className="space-y-2">
          {data.steps.map((s) => (
            <TraceRow key={s.seq} s={s} />
          ))}
        </ol>
      ) : (
        <Empty>The trace is empty.</Empty>
      )}
    </Card>
  )
}

const TRACE_LIMIT = 600

function TraceRow({ s }: { s: TraceStep }): React.JSX.Element {
  const [full, setFull] = useState(false)
  const long = s.text.length > TRACE_LIMIT
  const text = full || !long ? s.text : `${s.text.slice(0, TRACE_LIMIT)}…`
  const label = s.kind === 'tool_use' ? s.name || 'tool' : s.kind.replace('_', ' ')
  return (
    <li>
      <details
        open={s.kind !== 'system' && s.kind !== 'tool_result'}
        className="group rounded-lg border border-line px-3 py-2"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs">
          <CaretRightIcon
            className="size-4 shrink-0 text-ink-muted transition-transform duration-300 ease-weighted group-open:rotate-90"
            aria-hidden
          />
          <Pill tone={s.kind === 'result' ? 'ok' : s.kind === 'tool_use' ? 'accent' : 'muted'}>
            {label}
          </Pill>
          <span className="min-w-0 flex-1 truncate text-ink-muted group-open:invisible">
            {s.kind === 'tool_use' ? JSON.stringify(s.input ?? {}) : s.text.split('\n')[0]}
          </span>
          {s.ts && (
            <span className="shrink-0 text-ink-muted" title={s.ts}>
              {relTime(s.ts)}
            </span>
          )}
        </summary>
        <div className="mt-2 text-sm">
          {s.kind === 'tool_use' ? (
            <pre className="overflow-x-auto rounded-md bg-paper p-2 font-mono text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(s.input ?? {}, null, 2)}
            </pre>
          ) : s.kind === 'tool_result' || s.kind === 'system' ? (
            <pre className="max-h-96 overflow-x-auto rounded-md bg-paper p-2 font-mono text-xs break-all whitespace-pre-wrap">
              {text}
            </pre>
          ) : s.kind === 'thinking' ? (
            <p className="whitespace-pre-wrap text-ink-muted">{text}</p>
          ) : (
            <Md>{text}</Md>
          )}
          {long && (
            <button
              type="button"
              className={`mt-1 text-xs text-terra hover:underline ${interactive}`}
              onClick={() => setFull(!full)}
            >
              {full ? 'Show less' : `Show all (${s.text.length.toLocaleString()} chars)`}
            </button>
          )}
        </div>
      </details>
    </li>
  )
}
