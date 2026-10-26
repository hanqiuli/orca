import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { apiHref } from '../api/client'
import type { MediaItem } from '../api/types'
import { Overlay, interactive } from '../ui'

export type Shot = { item: MediaItem; title: string }

export function Lightbox({
  row,
  start,
  onClose
}: {
  row: Shot[]
  start: number
  onClose: () => void
}): React.JSX.Element {
  const [i, setI] = useState(start)
  const go = (d: number): void => setI((x) => (x + d + row.length) % row.length)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'ArrowLeft') {
        go(-1)
      }
      if (e.key === 'ArrowRight') {
        go(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const s = row[i]
  const nav = `rh-scrim-btn rounded-full p-2 ${interactive}`
  return (
    <Overlay>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        className="rh-scrim absolute inset-0 flex flex-col items-center justify-center gap-3 p-4"
        onClick={onClose}
      >
        <div className="flex max-w-full items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={nav}
            onClick={() => go(-1)}
            disabled={row.length < 2}
            aria-label="Previous"
          >
            <CaretLeftIcon className="size-5" />
          </button>
          <img
            src={apiHref(s.item.url)}
            alt={s.item.caption || s.item.path}
            className="max-h-[78vh] max-w-[calc(100%-8rem)] rounded-lg object-contain"
          />
          <button
            type="button"
            className={nav}
            onClick={() => go(1)}
            disabled={row.length < 2}
            aria-label="Next"
          >
            <CaretRightIcon className="size-5" />
          </button>
        </div>
        <div className="max-w-2xl text-center text-sm" onClick={(e) => e.stopPropagation()}>
          <div className="font-medium">
            {s.title}{' '}
            <span className="rh-scrim-muted">
              ({i + 1}/{row.length})
            </span>
          </div>
          {s.item.caption && <div className="rh-scrim-muted">{s.item.caption}</div>}
        </div>
        <button
          type="button"
          className={`absolute top-4 right-4 ${nav}`}
          onClick={onClose}
          aria-label="Close"
        >
          <XIcon className="size-5" />
        </button>
      </div>
    </Overlay>
  )
}
