import { useDigest, useDigests } from '../api/client'
import { Bone, Card, Empty, ErrorBanner, Go, Md, PageTitle, Reveal, interactive } from '../ui'

/** Without a `day` the newest digest is shown. */
export function Digests({ day }: { day?: string }): React.JSX.Element {
  const list = useDigests()
  const current = day ?? list.data?.digests[0]?.day ?? ''
  const digest = useDigest(current)

  return (
    <div className="space-y-6">
      <PageTitle back={day ? 'Back' : undefined}>Digests</PageTitle>
      <ErrorBanner error={list.error} />
      {list.data && !list.data.digests.length ? (
        <Empty hint="The daily digest is written at 07:05 on the box.">No digests yet.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <Reveal as="div" className="min-w-0">
            <nav aria-label="Digests">
              {list.isPending && (
                <div className="space-y-3" aria-busy="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Bone key={i} className="h-10" />
                  ))}
                </div>
              )}
              <ul className="scrollbar-sleek flex gap-px overflow-x-auto pb-1 md:max-h-[calc(100vh-14rem)] md:flex-col md:overflow-y-auto md:border-l md:border-line">
                {list.data?.digests.map((d) => (
                  <li key={d.day} className="shrink-0">
                    <Go
                      to={{ page: 'digest', day: d.day }}
                      className={`block px-3 py-2 text-sm md:-ml-px md:border-l-2 ${interactive} ${d.day === current ? 'text-terra md:border-terra' : 'text-ink/80 hover:text-ink md:border-transparent'}`}
                    >
                      <div className="font-mono text-xs">{d.day}</div>
                      <div className="hidden truncate text-xs text-ink-muted md:block">
                        {d.summary.split('\n').find((l) => l.trim()) ||
                          `${d.needs_you.length} flagged`}
                      </div>
                    </Go>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
          <Card className="min-w-0">
            <ErrorBanner error={digest.error} />
            {(current ? digest.isPending : list.isPending) ? (
              <div className="space-y-3" aria-busy="true">
                <Bone className="h-6 w-1/3" />
                {Array.from({ length: 10 }, (_, i) => (
                  <Bone key={i} className="h-4" />
                ))}
              </div>
            ) : (
              digest.data && <Md>{digest.data.markdown}</Md>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
