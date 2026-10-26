import { create } from 'zustand'

export type ResearchRoute =
  | { page: 'today' }
  | { page: 'runs'; project?: string; state?: string }
  | { page: 'campaigns' }
  | { page: 'campaign'; id: string }
  | { page: 'pods' }
  | { page: 'digests' }
  | { page: 'digest'; day: string }
  | { page: 'project'; key: string; track?: string }
  | { page: 'experiment'; id: string }

export type ResearchSection = 'today' | 'runs' | 'campaigns' | 'pods' | 'digests'

/** Nav section a route belongs to; detail pages fall back to it when the stack is empty. */
export function sectionOf(route: ResearchRoute): ResearchSection {
  switch (route.page) {
    case 'campaign':
      return 'campaigns'
    case 'digest':
      return 'digests'
    case 'project':
    case 'experiment':
      return 'today'
    default:
      return route.page
  }
}

type RouteState = {
  route: ResearchRoute
  stack: ResearchRoute[]
  navigate: (route: ResearchRoute) => void
  back: () => void
}

// Module-level store: the home keeps its place when Orca switches views and back.
export const useResearchRoute = create<RouteState>((set) => ({
  route: { page: 'today' },
  stack: [],
  navigate: (route) => set((s) => ({ route, stack: [...s.stack, s.route].slice(-50) })),
  back: () =>
    set((s) => {
      const prev = s.stack.at(-1)
      return prev
        ? { route: prev, stack: s.stack.slice(0, -1) }
        : { route: { page: sectionOf(s.route) } }
    })
}))

export const routeKey = (r: ResearchRoute): string => JSON.stringify(r)
