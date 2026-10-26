import { useState } from 'react'
import { apiHref } from '../api/client'
import type { MediaItem } from '../api/types'
import { fmt, interactive, labelCls } from '../ui'
import { type Arm, StepSlider, entryAt, sortedSteps, useStep } from './arm-steps'
import { Lightbox, type Shot } from './Lightbox'

export function Images({
  arms,
  mkey,
  inference
}: {
  arms: Arm[]
  mkey: string
  inference: boolean
}): React.JSX.Element {
  const [grid, setGrid] = useState(inference)
  const [box, setBox] = useState<{ row: Shot[]; i: number } | null>(null)
  const open = (row: Shot[], i: number): void => setBox({ row, i })
  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={grid}
          onChange={(e) => setGrid(e.target.checked)}
          className="accent-terra"
        />
        Arms by items grid
      </label>
      {grid ? (
        <ArmsGrid arms={arms} mkey={mkey} open={open} />
      ) : (
        arms.map((a) => <ArmGallery key={a.run.run_id} arm={a} mkey={mkey} open={open} />)
      )}
      {box && <Lightbox row={box.row} start={box.i} onClose={() => setBox(null)} />}
    </div>
  )
}

function Thumb({
  item,
  onClick,
  caption
}: {
  item: MediaItem
  onClick: () => void
  caption: string | undefined
}): React.JSX.Element {
  return (
    <figure className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        className={`block w-full overflow-hidden rounded-lg border border-line bg-paper hover:border-terra/60 ${interactive}`}
        aria-label={`Open ${caption || item.path}`}
      >
        <img
          src={apiHref(item.url)}
          alt={caption || item.path}
          loading="lazy"
          width={item.width}
          height={item.height}
          className="block h-auto w-full"
        />
      </button>
      {caption && (
        <figcaption className="mt-1 line-clamp-2 text-xs break-words text-ink-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function ArmGallery({
  arm,
  mkey,
  open
}: {
  arm: Arm
  mkey: string
  open: (row: Shot[], i: number) => void
}): React.JSX.Element {
  const entries = arm.keys[mkey]
  const steps = sortedSteps([entries])
  const [step, setStep] = useStep(steps)
  const entry = entryAt(entries, step)
  const row = (entry?.items ?? []).map((item) => ({
    item,
    title: `${arm.label} · step ${fmt(entry?.step)}`
  }))
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{arm.label}</h3>
        <StepSlider
          steps={steps}
          value={entry?.step ?? step}
          onChange={setStep}
          label={`${arm.label} step`}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {/* Positional keys: W&B repeats one path for byte identical images in a single log call. */}
        {row.map((s, i) => (
          <Thumb key={i} item={s.item} caption={s.item.caption} onClick={() => open(row, i)} />
        ))}
      </div>
    </section>
  )
}

function ArmsGrid({
  arms,
  mkey,
  open
}: {
  arms: Arm[]
  mkey: string
  open: (row: Shot[], i: number) => void
}): React.JSX.Element {
  const steps = sortedSteps(arms.map((a) => a.keys[mkey]))
  const [step, setStep] = useStep(steps)
  const cols = arms.map((a) => ({ arm: a, entry: entryAt(a.keys[mkey], step) }))
  const n = Math.max(0, ...cols.map((c) => c.entry?.items.length ?? 0))
  return (
    <div className="space-y-2">
      <StepSlider steps={steps} value={step} onChange={setStep} label="Grid step" />
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="-m-2 border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className={`w-40 min-w-28 text-left ${labelCls}`}>Item</th>
              {cols.map((c) => (
                <th key={c.arm.run.run_id} className="w-56 min-w-36 text-left text-xs font-medium">
                  {c.arm.label}
                  {c.entry && c.entry.step !== step && (
                    <span className="font-normal text-ink-muted"> @ {fmt(c.entry.step)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => {
              const row: Shot[] = cols.flatMap((c) =>
                c.entry?.items[i]
                  ? [{ item: c.entry.items[i], title: `${c.arm.label} · #${i}` }]
                  : []
              )
              const prompt = cols.map((c) => c.entry?.items[i]?.caption).find(Boolean)
              return (
                <tr key={i} className="align-top">
                  <td className="text-xs break-words text-ink-muted">
                    <span className="font-mono">#{i}</span> {prompt}
                  </td>
                  {cols.map((c) => {
                    const item = c.entry?.items[i]
                    return (
                      <td key={c.arm.run.run_id}>
                        {item ? (
                          <Thumb
                            item={item}
                            caption={item.caption !== prompt ? item.caption : undefined}
                            onClick={() =>
                              open(
                                row,
                                row.findIndex((s) => s.item === item)
                              )
                            }
                          />
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
