import { ArrowRightIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useNow } from '@/hooks/use-now'
import { useAppState, usePods, useProjects } from '../api/client'
import { Bone, Card, Empty, ErrorBanner, Go, Md, Reveal, interactive, labelCls } from '../ui'
import { isQuiet } from './Pods'
import { AgentsInApp } from './today/AgentsInApp'
import { Scratchpad } from './today/Scratchpad'
import { StateCards } from './today/StateCards'

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

export function Today(): React.JSX.Element {
  // Scratchpad sits outside the state's loading/error branches so a state refetch never remounts it.
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0 space-y-12">
        <Headline />
        <AgentsInApp />
        <StateCards />
      </div>
      <aside className="min-w-0 space-y-6 lg:pt-2">
        <Scratchpad />
        <GpusCard />
        <ProjectsCard />
      </aside>
    </div>
  )
}

function Headline(): React.JSX.Element {
  const { data: s, error, isPending } = useAppState()
  const day = new Date(useNow(60_000)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  if (isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <Bone className="h-3 w-48" />
        <Bone className="h-12 w-3/4 max-w-[680px]" />
        <div className="max-w-[680px] space-y-2 border-t border-line pt-6">
          <Bone className="h-5" />
          <Bone className="h-5" />
          <Bone className="h-5 w-2/3" />
        </div>
      </div>
    )
  }
  if (!s) {
    return (
      <div className="space-y-6">
        <div className={labelCls}>Today · {day}</div>
        <ErrorBanner error={error} />
      </div>
    )
  }
  const n = s.needs_you.length

  return (
    <Reveal as="header" className="space-y-6">
      <ErrorBanner error={error} />
      <div className={labelCls}>Today · {day}</div>
      <h1 className="rh-hero max-w-[680px] pb-1 text-5xl font-semibold tracking-[-0.02em] text-balance">
        {n
          ? `${WORDS[n] ?? n} ${n === 1 ? 'thing needs' : 'things need'} you.`
          : 'Nothing needs you today.'}
      </h1>
      {n > 0 && (
        <ul className="max-w-[680px] space-y-px overflow-hidden rounded-lg">
          {s.needs_you.map((x) => (
            <li key={x} className="flex gap-3 bg-terra px-4 py-3 text-sm text-terra-ink">
              <ArrowRightIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{x}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="max-w-[680px] border-t border-line pt-6">
        {s.latest_digest?.summary ? (
          <>
            <Md large>{s.latest_digest.summary}</Md>
            <Go
              to={{ page: 'digest', day: s.latest_digest.day }}
              className={`mt-3 inline-flex items-center gap-1 text-sm font-medium text-terra hover:underline ${interactive}`}
            >
              Read the {s.latest_digest.day} digest <CaretRightIcon className="size-3" />
            </Go>
          </>
        ) : (
          <Empty>No digest yet. The next one is written at 07:05.</Empty>
        )}
      </div>
    </Reveal>
  )
}

/** Pod fleet at a glance; quiet pods (staging, reserved, off) are idle on purpose. */
function GpusCard(): React.JSX.Element {
  const { data, error } = usePods()
  const pods = data?.pods ?? []
  const rows = [
    {
      label: 'active',
      title: 'state active',
      n: pods.filter((p) => !isQuiet(p)).length,
      cls: 'text-ok'
    },
    {
      label: 'quiet',
      title: 'staging, reserved or off: idle on purpose',
      n: pods.filter(isQuiet).length,
      cls: ''
    },
    {
      label: 'idle',
      title: 'active and idle alerting',
      n: pods.filter((p) => p.alert === 'idle').length,
      cls: 'text-warn'
    },
    {
      label: 'unreachable',
      title: 'ssh unreachable for 20 min or more',
      n: pods.filter((p) => p.alert === 'unreachable').length,
      cls: 'text-bad'
    }
  ]
  return (
    <Card
      title="GPUs"
      action={
        <Go
          to={{ page: 'pods' }}
          className={`inline-flex items-center gap-1 text-xs font-medium text-terra hover:underline ${interactive}`}
        >
          Pods <CaretRightIcon className="size-3" />
        </Go>
      }
    >
      <ErrorBanner error={error} />
      {!data ? (
        !error && (
          <div className="grid grid-cols-4 gap-3" aria-busy="true">
            {rows.map((r) => (
              <div key={r.label} className="space-y-2">
                <Bone className="h-8 w-8" />
                <Bone className="h-3" />
              </div>
            ))}
          </div>
        )
      ) : pods.length ? (
        <>
          <div className="grid grid-cols-4">
            {rows.map((r) => (
              <Go
                key={r.label}
                to={{ page: 'pods' }}
                title={r.title}
                className={`min-w-0 border-l border-line pl-3 first:border-l-0 first:pl-0 hover:text-terra ${interactive}`}
              >
                <div
                  className={`text-3xl leading-none font-semibold ${r.n ? r.cls : 'text-ink-muted/60'}`}
                >
                  {r.n}
                </div>
                <div className={`mt-2 ${labelCls}`}>{r.label}</div>
              </Go>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {pods.reduce((n, p) => n + p.gpus.count, 0)} GPUs on {pods.length} pod
            {pods.length === 1 ? '' : 's'}
          </p>
        </>
      ) : (
        <Empty hint="Register one from your agent: research-os pod add.">No pods registered.</Empty>
      )}
    </Card>
  )
}

/** Registry projects; replaces the dashboard's sidebar tree. */
function ProjectsCard(): React.JSX.Element {
  const { data, error, isPending } = useProjects()
  return (
    <Card title="Projects">
      <ErrorBanner error={error} />
      {isPending ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Bone key={i} className="h-5" />
          ))}
        </div>
      ) : data?.projects.length ? (
        <ul className="-my-2 divide-y divide-line">
          {data.projects.map((p) => (
            <li key={p.key}>
              <Go
                to={{ page: 'project', key: p.key }}
                className={`flex items-center gap-2 py-2 text-sm hover:text-terra ${interactive}`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{p.title || p.key}</span>
                {p.n_running > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-ok">
                    <span className="size-2 animate-pulse rounded-full bg-ok" aria-hidden />
                    {p.n_running}
                  </span>
                )}
                <span className="text-xs text-ink-muted">
                  {p.n_active}/{p.n_experiments} active
                </span>
                <CaretRightIcon className="size-3 text-ink-muted" aria-hidden />
              </Go>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <Empty hint="Create one from your agent: research-os project new.">
            No projects yet.
          </Empty>
        )
      )}
    </Card>
  )
}
