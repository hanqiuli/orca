import { CaretRightIcon, PushPinIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAddDecision, useAppState, useProject, useSaveProjectNotes } from '../api/client'
import type { ExperimentJSON, RunJSON, TreeNode } from '../api/types'
import {
  AgentBox,
  BackButton,
  Bone,
  Card,
  Cmd,
  Empty,
  ErrorBanner,
  Go,
  Pill,
  Reveal,
  StatusPill,
  btnPrimary,
  fmt,
  inputCls,
  interactive,
  relTime
} from '../ui'
import { NotesCard } from '../NotesCard'
import { CampaignCard } from './Campaigns'

/** Running runs (from the cached state) that belong to any of `exps`, by group or manual assignment. */
function runningFor(projects: { runs: RunJSON[] }[] | undefined, exps: ExperimentJSON[]) {
  const byId = new Map(exps.map((e) => [e.id, e]))
  const manual = new Map(exps.flatMap((e) => e.runs.map((r) => [r, e] as const)))
  return (projects ?? []).flatMap((p) =>
    p.runs.flatMap((r) => {
      const e = byId.get(r.exp) ?? manual.get(`${r.wandb_project || r.project}/${r.run_id}`)
      return r.state === 'running' && e ? [{ run: r, exp: e }] : []
    })
  )
}

const find = (n: TreeNode, track: string): TreeNode | undefined =>
  n.track === track ? n : n.children.map((c) => find(c, track)).find(Boolean)
const flatten = (n: TreeNode): ExperimentJSON[] => [
  ...n.experiments,
  ...n.children.flatMap(flatten)
]

function ProjectSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <Bone className="h-9 w-1/3" />
      <Bone className="h-4 w-1/2" />
      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="h-5" />
        ))}
      </div>
    </div>
  )
}

export function Project({ pkey, track = '' }: { pkey: string; track?: string }): React.JSX.Element {
  const { data, error, isPending } = useProject(pkey)
  const { data: state } = useAppState()
  const saveNotes = useSaveProjectNotes(pkey)

  if (isPending) {
    return (
      <div className="space-y-4">
        <BackButton label="Back" />
        <ProjectSkeleton />
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
  const p = data.project
  const node = find(data.tree, track)
  const running = runningFor(state?.projects, node ? flatten(node) : [])
  const segs = track ? track.split('/') : []

  return (
    <div className="space-y-6">
      <Reveal as="header" className="space-y-2">
        <BackButton label="Back" />
        {track ? (
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-baseline gap-x-2 text-3xl font-semibold tracking-tight"
          >
            <Go to={{ page: 'project', key: pkey }}>{p.title || p.key}</Go>
            {segs.map((s, i) => {
              const t = segs.slice(0, i + 1).join('/')
              return (
                <span key={t} className="contents">
                  <span className="font-normal text-ink-muted">/</span>
                  {i === segs.length - 1 ? (
                    <span className="font-mono" aria-current="page">
                      {s}
                    </span>
                  ) : (
                    <Go
                      to={{ page: 'project', key: pkey, track: t }}
                      className={`font-mono hover:text-terra ${interactive}`}
                    >
                      {s}
                    </Go>
                  )}
                </span>
              )
            })}
            <Go
              to={{ page: 'project', key: pkey }}
              className={`ml-2 text-sm font-normal text-terra hover:underline ${interactive}`}
            >
              Show all
            </Go>
          </nav>
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight">{p.title || p.key}</h1>
        )}
        {p.description && <p className="max-w-[680px] text-base text-ink-muted">{p.description}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-ink-muted">{p.key}</span>
          {p.wandb_projects.map((w) => (
            <Go
              key={w}
              to={{ page: 'runs', project: w }}
              className={`rounded-sm border border-line px-2 py-0.5 font-mono text-ink-muted hover:border-line-strong hover:text-ink ${interactive}`}
            >
              W&B {w}
            </Go>
          ))}
          {p.pinned.exp && (
            <Go
              to={{ page: 'experiment', id: p.pinned.exp }}
              className={`inline-flex items-center gap-1 rounded-sm border border-terra/40 bg-terra-tint px-2 py-0.5 font-mono text-terra ${interactive}`}
            >
              <PushPinIcon className="size-3" /> {p.pinned.exp}
              {p.pinned.arm && ` / ${p.pinned.arm}`}
              {p.pinned.ckpt && ` @ ${p.pinned.ckpt}`}
            </Go>
          )}
        </div>
      </Reveal>

      {running.length > 0 && (
        <Card title={`Running now (${running.length})`}>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {running.map(({ run, exp }) => (
              <li key={`${run.wandb_project || run.project}/${run.run_id}`} className="shrink-0">
                <Go
                  to={{ page: 'experiment', id: exp.id }}
                  className={`block rounded-md border border-line px-3 py-2 hover:border-terra/60 ${interactive}`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="size-2 animate-pulse rounded-full bg-ok" aria-hidden />
                    <span className="font-medium">{run.arm || run.name}</span>
                  </div>
                  <div className="font-mono text-xs text-ink-muted">
                    {exp.id} · step {fmt(run.step)} · {relTime(run.heartbeat || run.updated_at)}
                  </div>
                </Go>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={track ? `Track ${track}` : 'Tracks'}>
        {!node ? (
          <Empty>There is no track {track} in this project.</Empty>
        ) : node.experiments.length || node.children.length ? (
          <TrackTree pkey={pkey} node={node} />
        ) : (
          <Empty hint="Create one from your agent, see below.">No experiments yet.</Empty>
        )}
      </Card>

      <AgentBox>
        Create, move, rename, conclude or delete from your agent (laptop or Telegram):{' '}
        <Cmd>
          research-os exp new &lt;project&gt; &quot;&lt;title&gt;&quot; --track a/b --metric …
          --direction min|max
        </Cmd>{' '}
        · <Cmd>exp move &lt;id&gt; --track …</Cmd> ·{' '}
        <Cmd>exp set &lt;id&gt; status=concluded verdict=&quot;…&quot;</Cmd> ·{' '}
        <Cmd>exp delete &lt;id&gt;</Cmd> ·{' '}
        <Cmd>track rename &lt;project&gt; &lt;old&gt; &lt;new&gt;</Cmd> ·{' '}
        <Cmd>project new|delete</Cmd>
      </AgentBox>

      {!track && (
        <>
          <NotesCard
            value={p.body}
            onSave={(v) => saveNotes.mutate(v)}
            saving={saveNotes.isPending}
            error={saveNotes.error}
            placeholder="Project notes in markdown: goals, open questions, links…"
          />
          {data.campaigns.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Campaigns">
                <ul className="grid gap-3">
                  {data.campaigns.map((c) => (
                    <li key={c.id}>
                      <CampaignCard c={c} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Decisions pkey={pkey} decisions={data.decisions} />
            </div>
          ) : (
            <Decisions pkey={pkey} decisions={data.decisions} />
          )}
        </>
      )}
    </div>
  )
}

function TrackTree({
  pkey,
  node,
  depth = 0
}: {
  pkey: string
  node: TreeNode
  depth?: number
}): React.JSX.Element {
  return (
    <div className={depth ? 'ml-1 border-l border-line pl-4 sm:pl-6' : ''}>
      {node.experiments.length > 0 && (
        <ul className="divide-y divide-line">
          {node.experiments.map((e) => (
            <ExpRow key={e.id} e={e} />
          ))}
        </ul>
      )}
      {node.children.map((c) => (
        <div key={c.track} className="mt-2">
          <Go
            to={{ page: 'project', key: pkey, track: c.track }}
            className={`block py-2 font-mono text-xs text-ink-muted hover:text-terra ${interactive}`}
          >
            {c.track.split('/').pop()}/
          </Go>
          <TrackTree pkey={pkey} node={c} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

function ExpRow({ e }: { e: ExperimentJSON }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`text-ink-muted hover:text-ink ${interactive}`}
          aria-label={open ? 'Hide hypothesis' : 'Show hypothesis'}
          aria-expanded={open}
        >
          <CaretRightIcon
            className={`size-4 transition-transform duration-500 ease-weighted ${open ? 'rotate-90' : ''}`}
          />
        </button>
        <Go
          to={{ page: 'experiment', id: e.id }}
          className={`min-w-0 flex-1 basis-56 hover:text-terra ${interactive}`}
          title={e.hypothesis || undefined}
        >
          <span className="font-medium">{e.title || e.id}</span>
          <span className="ml-2 font-mono text-xs text-ink-muted">{e.id}</span>
        </Go>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill status={e.status} />
          {e.kind && <Pill>{e.kind}</Pill>}
          <span className="text-ink-muted">
            {e.n_runs} runs
            {e.n_running > 0 && <span className="text-ok"> · {e.n_running} running</span>} ·{' '}
            {e.updated_at ? relTime(e.updated_at) : e.created}
          </span>
        </span>
      </div>
      {e.verdict && <p className="truncate pl-8 text-sm text-ink-muted">→ {e.verdict}</p>}
      {open && (
        <p className="mt-1 pl-8 text-sm">
          {e.hypothesis || <span className="text-ink-muted">No hypothesis</span>}
        </p>
      )}
    </li>
  )
}

function Decisions({
  pkey,
  decisions
}: {
  pkey: string
  decisions: { id: string; date: string; text: string }[]
}): React.JSX.Element {
  const [text, setText] = useState('')
  const add = useAddDecision(pkey)
  return (
    <Card title="Decisions">
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate(text.trim(), { onSuccess: () => setText('') })
        }}
      >
        <input
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Decision. Rationale. Rejected alternatives."
          aria-label="New decision"
        />
        <button className={btnPrimary} disabled={!text.trim() || add.isPending}>
          Add
        </button>
      </form>
      <ErrorBanner error={add.error} />
      {decisions.length ? (
        <ol className="space-y-2 text-sm">
          {decisions.map((d) => (
            <li key={d.id} className="flex gap-2">
              <span className="w-8 shrink-0 pt-0.5 font-mono text-xs text-terra">{d.id}</span>
              <span className="min-w-0">
                <span className="mr-2 text-xs text-ink-muted">{d.date}</span>
                {d.text}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty hint="Record the first one above.">No decisions yet.</Empty>
      )}
    </Card>
  )
}
