import { useEffect, useRef, useSyncExternalStore } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { HistoryJSON } from './api/types'

// First line takes the terra accent; the rest stay muted and distinguishable.
const PALETTE = [
  'var(--terra)',
  '#5B7A4A',
  '#B8862B',
  '#7D5A86',
  '#9C3A2B',
  '#3F8483',
  '#8A6A44',
  '#7A7266',
  '#A8566E',
  '#6E8B3D',
  '#34506E',
  '#B4532F'
]

export type Series = {
  label: string
  rows: HistoryJSON['rows']
}

function subscribeTheme(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

/** Line chart of `metric` vs `_step`, one line per series (x values merged across series). */
export function LineChart({
  metric,
  series,
  height = 260
}: {
  metric: string
  series: Series[]
  height?: number
}): React.JSX.Element {
  const el = useRef<HTMLDivElement>(null)
  const dark = useSyncExternalStore(subscribeTheme, () =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const node = el.current
    if (!node) {
      return
    }
    const tables = series.map((s) => {
      const pts = s.rows
        .filter((r) => typeof r[metric] === 'number')
        .sort((a, b) => a._step - b._step)
      return [pts.map((r) => r._step), pts.map((r) => r[metric] as number)] as uPlot.AlignedData
    })
    if (!tables.some((t) => t[0].length)) {
      return
    }
    const data = tables.length === 1 ? tables[0] : uPlot.join(tables)
    const css = getComputedStyle(node)
    // uPlot paints on canvas, so CSS variables are resolved to concrete colours here.
    const color = (c: string): string =>
      c.startsWith('var(') ? css.getPropertyValue(c.slice(4, -1)).trim() : c
    const axis = {
      stroke: color('var(--ink-muted)'),
      grid: { stroke: color('var(--line)'), width: 1 },
      ticks: { show: false },
      font: '11px "Geist Mono Variable", ui-monospace, monospace'
    }
    const plot = new uPlot(
      {
        width: node.clientWidth,
        height,
        scales: { x: { time: false } },
        axes: [axis, { ...axis, size: 60 }],
        cursor: { drag: { x: true, y: false } },
        legend: { show: true },
        series: [
          { label: 'step' },
          // Sparse series (eval/* logged a few times) need markers or single points vanish.
          ...series.map((s, i) => {
            const stroke = color(PALETTE[i % PALETTE.length])
            return {
              label: s.label,
              stroke,
              width: 1.5,
              spanGaps: true,
              points: { show: tables[i][0].length <= 40, size: 6, fill: stroke }
            }
          })
        ]
      },
      data,
      node
    )
    // Resizing inside the observer callback re-triggers it in the same frame ("ResizeObserver loop" error).
    let raf = 0
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      if (!w || w === plot.width) {
        return
      }
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => plot.setSize({ width: w, height }))
    })
    ro.observe(node)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      plot.destroy()
    }
  }, [metric, series, height, dark])

  const empty = !series.some((s) => s.rows.some((r) => typeof r[metric] === 'number'))
  return (
    <div className="min-w-0">
      {empty && <p className="py-6 text-center text-sm text-ink-muted">No history for {metric}</p>}
      <div ref={el} className="w-full" />
    </div>
  )
}
