import { useState } from 'react'
import type { MediaEntry, RunJSON } from '../api/types'
import { fmt } from '../ui'

export type Arm = { run: RunJSON; label: string; keys: Record<string, MediaEntry[]> }

export const sortedSteps = (entries: MediaEntry[][]): number[] =>
  [...new Set(entries.flat().map((e) => e.step))].sort((a, b) => a - b)
/** Entry at the latest step ≤ `step` (falls back to the first one). */
export const entryAt = (entries: MediaEntry[] | undefined, step: number): MediaEntry | undefined =>
  entries?.length ? (entries.findLast((e) => e.step <= step) ?? entries[0]) : undefined
/** Follows the newest step until the user picks an older one; a pick that disappears falls back to newest. */
export function useStep(steps: number[]) {
  const [pick, setPick] = useState<number | null>(null)
  const last = steps.at(-1) ?? 0
  const step = pick !== null && steps.includes(pick) ? pick : last
  return [step, (s: number) => setPick(s === last ? null : s)] as const
}

/** Range input over the existing steps only. */
export function StepSlider({
  steps,
  value,
  onChange,
  label
}: {
  steps: number[]
  value: number
  onChange: (s: number) => void
  label: string
}): React.JSX.Element {
  const idx = Math.max(0, steps.indexOf(value))
  if (steps.length < 2) {
    return <span className="text-xs text-ink-muted">step {fmt(steps[0] ?? null)}</span>
  }
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={idx}
        onChange={(e) => onChange(steps[Number(e.target.value)])}
        aria-label={label}
        className="w-32 accent-terra sm:w-48"
      />
      <span className="whitespace-nowrap">step {fmt(value)}</span>
    </label>
  )
}
