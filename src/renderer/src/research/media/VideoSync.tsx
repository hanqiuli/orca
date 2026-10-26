import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { apiHref } from '../api/client'
import { Empty, btnGhost, fmt } from '../ui'
import { type Arm, StepSlider, entryAt, sortedSteps, useStep } from './arm-steps'

/** One `<video>` per arm, driven by a single play/pause and scrub bar. */
export function Videos({ arms, mkey }: { arms: Arm[]; mkey: string }): React.JSX.Element {
  const steps = sortedSteps(arms.map((a) => a.keys[mkey]))
  const [step, setStep] = useStep(steps)
  const vids = useRef<(HTMLVideoElement | null)[]>([])
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const cols = arms.map((a) => ({ arm: a, entry: entryAt(a.keys[mkey], step) }))
  const lead = cols.findIndex((c) => c.entry?.items[0]) // first rendered video drives time/ended
  const all = (): HTMLVideoElement[] => vids.current.filter((v): v is HTMLVideoElement => !!v)

  useEffect(() => {
    setPlaying(false)
    setT(0)
    // Unchanged srcs never re-fire loadedmetadata.
    setDur(Math.max(0, ...vids.current.map((v) => v?.duration || 0)))
  }, [step])

  const toggle = (): void => {
    const vs = all()
    if (playing) {
      vs.forEach((v) => v.pause())
    } else {
      const at = vs[0]?.ended ? 0 : t
      vs.forEach((v) => {
        v.currentTime = Math.min(at, v.duration || at)
        void v.play()
      })
    }
    setPlaying(!playing)
  }
  const seek = (x: number): void => {
    setT(x)
    all().forEach((v) => (v.currentTime = Math.min(x, v.duration || x)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnGhost}
          onClick={toggle}
          aria-label={playing ? 'Pause all' : 'Play all'}
        >
          {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}{' '}
          {playing ? 'Pause' : 'Play'} all
        </button>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.04}
          value={t}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Scrub all videos"
          className="min-w-32 flex-1 accent-terra"
        />
        <span className="w-24 text-right text-xs text-ink-muted">
          {t.toFixed(1)} / {dur.toFixed(1)} s
        </span>
        <StepSlider steps={steps} value={step} onChange={setStep} label="Video step" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cols.map((c, i) => {
          const item = c.entry?.items[0]
          return (
            <figure key={c.arm.run.run_id} className="min-w-0">
              {item ? (
                <video
                  ref={(el) => {
                    vids.current[i] = el
                  }}
                  src={apiHref(item.url)}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full rounded-lg border border-line bg-paper"
                  onLoadedMetadata={(e) => {
                    const x = e.currentTarget.duration || 0
                    setDur((d) => Math.max(d, x))
                  }}
                  onTimeUpdate={i === lead ? (e) => setT(e.currentTarget.currentTime) : undefined}
                  onEnded={i === lead ? () => setPlaying(false) : undefined}
                />
              ) : (
                <Empty>No video at this step.</Empty>
              )}
              <figcaption className="mt-1 text-xs">
                <span className="font-medium">{c.arm.label}</span>
                {c.entry && (
                  <span className="text-ink-muted">
                    {' '}
                    · step {fmt(c.entry.step)}
                    {item?.caption ? ` · ${item.caption}` : ''}
                  </span>
                )}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </div>
  )
}
