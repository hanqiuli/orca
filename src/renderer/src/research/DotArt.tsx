import { useLayoutEffect, useRef } from 'react'
import campaignsArt from './art/campaigns.png?url'
import digestsArt from './art/digests.png?url'
import experimentArt from './art/experiment.png?url'
import podsArt from './art/pods.png?url'
import projectArt from './art/project.png?url'
import runsArt from './art/runs.png?url'
import todayArt from './art/today.png?url'
import type { ResearchRoute } from './research-route'

// Public-domain artworks, pre-dithered (Atkinson) into 1-bit cell maps, one per section:
// today: Flammarion engraving (1888) · runs: Reni, Atalanta and Hippomenes · campaigns: Draper, Ulysses and the Sirens
// pods: Velázquez, The Forge of Vulcan · digests: Mignard, Clio · project: Füger, Prometheus Brings Fire · experiment: Draper, The Lament for Icarus
const ART: Record<ResearchRoute['page'], string> = {
  today: todayArt,
  runs: runsArt,
  campaigns: campaignsArt,
  campaign: campaignsArt,
  pods: podsArt,
  digests: digestsArt,
  digest: digestsArt,
  project: projectArt,
  experiment: experimentArt
}

type Cells = { w: number; h: number; on: Uint8Array }
const cache = new Map<string, Promise<Cells>>()
// Decoded once per session so a page change paints its artwork in the same frame as the new page.
const decoded = new Map<string, Cells>()

function load(src: string): Promise<Cells> {
  const hit = cache.get(src)
  if (hit) {
    return hit
  }
  const promise = new Promise<Cells>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = img.width
      off.height = img.height
      const o = off.getContext('2d')
      if (!o) {
        reject(new Error('no 2d context'))
        return
      }
      o.drawImage(img, 0, 0)
      const px = o.getImageData(0, 0, img.width, img.height).data
      const on = new Uint8Array(img.width * img.height)
      for (let i = 0; i < on.length; i++) {
        on[i] = px[i * 4] < 128 ? 1 : 0
      }
      const cells = { w: img.width, h: img.height, on }
      decoded.set(src, cells)
      resolve(cells)
    }
    img.onerror = reject
    img.src = src
  })
  cache.set(src, promise)
  return promise
}

for (const src of new Set(Object.values(ART))) {
  load(src).catch(() => {})
}

/** Resolves `--art-ink` (a color-mix) to a concrete colour the canvas accepts. */
function artInk(host: HTMLElement): string {
  const probe = document.createElement('span')
  probe.style.color = 'var(--art-ink)'
  host.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

/** The section's artwork, drawn as fine square dots in the art ink. Static; repainted on theme change. */
export function DotArt({
  page,
  className = ''
}: {
  page: ResearchRoute['page']
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const src = ART[page]

  useLayoutEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    let cells = decoded.get(src)
    const paint = (): void => {
      if (!cells) {
        return
      }
      const { w, h, on } = cells
      // Cells sized in device pixels so dots stay sharp: 3 px cell / 2 px dot on retina.
      const dpr = window.devicePixelRatio || 1
      const cell = dpr >= 2 ? 3 : 2
      canvas.width = w * cell
      canvas.height = h * cell
      canvas.style.width = `${(w * cell) / dpr}px`
      canvas.style.height = `${(h * cell) / dpr}px`
      ctx.fillStyle = artInk(canvas.parentElement ?? document.body)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (on[y * w + x]) {
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1)
          }
        }
      }
    }
    let alive = true
    if (cells) {
      paint()
    } else {
      // First visit before preloading finished: fade in once it arrives.
      canvas.style.opacity = '0'
      load(src).then(
        (c) => {
          if (!alive) {
            return
          }
          cells = c
          paint()
          canvas.style.opacity = ''
        },
        () => {}
      )
    }
    const themeWatch = new MutationObserver(paint)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      alive = false
      themeWatch.disconnect()
    }
  }, [src])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`transition-opacity duration-700 ease-weighted ${className}`}
    />
  )
}
