import { useMemo, useState } from 'react'
import { useMedias } from './api/client'
import type { RunJSON } from './api/types'
import type { Arm } from './media/arm-steps'
import { Images } from './media/ImageGallery'
import { Tables } from './media/TableView'
import { Videos } from './media/VideoSync'
import { Bone, Empty, ErrorBanner, interactive, selectCls } from './ui'

type Kind = 'image' | 'video' | 'table'
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'image', label: 'Images' },
  { kind: 'video', label: 'Videos' },
  { kind: 'table', label: 'Tables' }
]

export function MediaPanel({
  runs,
  inference
}: {
  runs: RunJSON[]
  inference: boolean
}): React.JSX.Element {
  const withMedia = useMemo(() => runs.filter((r) => r.media_keys.length), [runs])
  const qs = useMedias(withMedia)
  const loaded = qs.map((q) => q.dataUpdatedAt).join()
  const arms: Arm[] = useMemo(
    () =>
      withMedia.flatMap((r, i) => {
        const data = qs[i]?.data
        return data ? [{ run: r, label: r.arm || r.name || r.run_id, keys: data.keys }] : []
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `qs` is a new array every render; `loaded` tracks its data
    [withMedia, loaded]
  )
  const keysOf = (kind: Kind): string[] =>
    [
      ...new Set(
        arms.flatMap((a) =>
          Object.entries(a.keys)
            .filter(([, es]) => es[0]?.type === kind)
            .map(([k]) => k)
        )
      )
    ].sort()
  const available = KINDS.filter((k) => keysOf(k.kind).length)
  const [kindPick, setKind] = useState<Kind | null>(null)
  const kind =
    kindPick && available.some((k) => k.kind === kindPick) ? kindPick : available[0]?.kind
  const keys = kind ? keysOf(kind) : []
  const [keyPick, setKey] = useState<string | null>(null)
  const key = keyPick && keys.includes(keyPick) ? keyPick : (keys[0] ?? '')

  if (!withMedia.length) {
    return (
      <Empty hint="Log images, videos or tables to W&B from these runs and they appear here.">
        No media logged by these runs.
      </Empty>
    )
  }
  if (qs.some((q) => q.isPending)) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Bone key={i} className="aspect-square" />
        ))}
      </div>
    )
  }
  const err = qs.find((q) => q.error)?.error
  if (!kind) {
    return (
      <>
        <ErrorBanner error={err} />
        <Empty>No image, video or table media.</Empty>
      </>
    )
  }

  return (
    <div className="space-y-3">
      <ErrorBanner error={err} />
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-lg border border-line p-0.5">
          {available.map((k) => (
            <button
              key={k.kind}
              role="tab"
              type="button"
              aria-selected={k.kind === kind}
              onClick={() => setKind(k.kind)}
              className={`rounded-md px-3 py-1 text-sm ${interactive} ${k.kind === kind ? 'bg-terra-tint font-medium text-terra' : 'text-ink-muted hover:text-ink'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <select
          className={`${selectCls} font-mono`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="Media key"
        >
          {keys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      {kind === 'image' && (
        <Images key={key} arms={arms.filter((a) => a.keys[key])} mkey={key} inference={inference} />
      )}
      {kind === 'video' && <Videos key={key} arms={arms.filter((a) => a.keys[key])} mkey={key} />}
      {kind === 'table' && <Tables key={key} arms={arms.filter((a) => a.keys[key])} mkey={key} />}
    </div>
  )
}
