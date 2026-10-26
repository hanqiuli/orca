import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { create } from 'zustand'
import type {
  CampaignJSON,
  Decision,
  DigestJSON,
  ExperimentDetailJSON,
  ExperimentJSON,
  GroupJSON,
  HistoryJSON,
  MediaJSON,
  PodJSON,
  ProjectDetailJSON,
  ProjectJSON,
  RunDetailJSON,
  RunJSON,
  ScratchpadJSON,
  StateJSON,
  TraceStep,
  WandbTable
} from './types'

const API_URL_KEY = 'research-os.apiUrl'
export const DEFAULT_API_URL = 'https://research-os.centaur-porgy.ts.net'

const trimSlash = (url: string): string => url.trim().replace(/\/+$/, '')

export const useApiUrl = create<{ url: string; setUrl: (url: string) => void }>((set) => ({
  url: trimSlash(localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL),
  setUrl: (url) => {
    const next = trimSlash(url) || DEFAULT_API_URL
    localStorage.setItem(API_URL_KEY, next)
    set({ url: next })
  }
}))

/** Server paths are relative (`/api/...`); absolute URLs pass through untouched. */
export const apiHref = (path: string): string =>
  path.startsWith('/') ? `${useApiUrl.getState().url}${path}` : path

/** Media URL that follows a base URL change on rerender. */
export const useApiHref = (path: string): string => {
  const base = useApiUrl((s) => s.url)
  return path.startsWith('/') ? `${base}${path}` : path
}

export class ApiError extends Error {}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiHref(path)
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError(`Could not reach ${url}. Check Tailscale or change the URL in settings.`)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const reason = body?.error ?? `${res.status} ${res.statusText}`
    throw new ApiError(`${url} answered ${reason}. Reload, or check the box logs.`)
  }
  return body as T
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      p.set(k, String(v))
    }
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}
const seg = encodeURIComponent

export const useAppState = () =>
  useQuery({
    queryKey: ['state'],
    queryFn: () => api<StateJSON>('/api/state'),
    refetchInterval: 30_000
  })

export const useRuns = (p: { project?: string; hours?: number; exp?: string }) =>
  useQuery({
    queryKey: ['runs', p],
    queryFn: () => api<{ runs: RunJSON[] }>(`/api/runs${qs(p)}`),
    placeholderData: keepPreviousData,
    enabled: !!p.project
  })

export const useRun = (project: string | undefined, id: string | undefined) =>
  useQuery({
    queryKey: ['run', project, id],
    queryFn: () => api<RunDetailJSON>(`/api/runs/${seg(project!)}/${seg(id!)}`),
    enabled: !!project && !!id
  })

const historyQuery = (project: string, id: string, keys: string[], samples = 500) => ({
  queryKey: ['history', project, id, keys, samples],
  queryFn: () =>
    api<HistoryJSON>(
      `/api/runs/${seg(project)}/${seg(id)}/history${qs({ keys: keys.join(','), samples })}`
    ),
  enabled: keys.length > 0,
  staleTime: 60_000
})

export const useHistory = (project: string, id: string, keys: string[]) =>
  useQuery(historyQuery(project, id, keys))

export const useHistories = (runs: { project: string; run_id: string }[], keys: string[]) =>
  useQueries({ queries: runs.map((r) => historyQuery(r.project, r.run_id, keys)) })

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => api<{ projects: ProjectJSON[] }>('/api/projects')
  })

export const useProject = (key: string) =>
  useQuery({
    queryKey: ['project', key],
    queryFn: () => api<ProjectDetailJSON>(`/api/projects/${seg(key)}`),
    enabled: !!key
  })

export const useExperiment = (id: string) =>
  useQuery({
    queryKey: ['experiment', id],
    queryFn: () => api<ExperimentDetailJSON>(`/api/experiments/${seg(id)}`),
    enabled: !!id
  })

export const useMedias = (runs: { wandb_project: string; run_id: string }[]) =>
  useQueries({
    queries: runs.map((r) => ({
      queryKey: ['media', r.wandb_project, r.run_id],
      queryFn: () => api<MediaJSON>(`/api/runs/${seg(r.wandb_project)}/${seg(r.run_id)}/media`),
      staleTime: 60_000
    }))
  })

/** Table JSON is immutable per path. */
export const useTables = (urls: string[]) =>
  useQueries({
    queries: urls.map((u) => ({
      queryKey: ['table', u],
      queryFn: () => api<WandbTable>(u),
      staleTime: Infinity
    }))
  })

export const useTrace = (campaign: string, arm: string) =>
  useQuery({
    queryKey: ['trace', campaign, arm],
    queryFn: () =>
      api<{ steps: TraceStep[] }>(`/api/campaigns/${seg(campaign)}/arms/${seg(arm)}/trace`),
    enabled: !!arm,
    retry: false
  })

const write = <T>(method: string, path: string, body: unknown) =>
  api<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Research-OS': '1' },
    body: JSON.stringify(body)
  })

/** Notes and decisions writes; refresh every registry view that may show them. */
function useRegistryWrite<A, T>(fn: (a: A) => Promise<T>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['projects', 'project', 'experiment', 'state'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] })
        )
      )
  })
}

export const useSaveProjectNotes = (key: string) =>
  useRegistryWrite((body: string) =>
    write<{ project: ProjectJSON }>('PATCH', `/api/projects/${seg(key)}`, { body })
  )

export const useAddDecision = (key: string) =>
  useRegistryWrite((text: string) =>
    write<{ decision: Decision }>('POST', `/api/projects/${seg(key)}/decisions`, { text })
  )

export const useSaveExperimentNotes = (id: string) =>
  useRegistryWrite((notes: string) =>
    write<{ experiment: ExperimentJSON }>('PATCH', `/api/experiments/${seg(id)}`, { notes })
  )

export const useScratchpad = () =>
  useQuery({ queryKey: ['scratchpad'], queryFn: () => api<ScratchpadJSON>('/api/scratchpad') })

export function useSaveScratchpad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (markdown: string) => write<ScratchpadJSON>('PUT', '/api/scratchpad', { markdown }),
    onSuccess: (res) => qc.setQueryData(['scratchpad'], res)
  })
}

export const useCampaigns = () =>
  useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<{ campaigns: CampaignJSON[] }>('/api/campaigns')
  })

export const useCampaign = (id: string) =>
  useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api<{ campaign: CampaignJSON }>(`/api/campaigns/${seg(id)}`)
  })

export const useDigests = () =>
  useQuery({
    queryKey: ['digests'],
    queryFn: () => api<{ digests: (DigestJSON & { path: string })[] }>('/api/digests')
  })

export const useDigest = (day: string) =>
  useQuery({
    queryKey: ['digest', day],
    queryFn: () => api<{ day: string; markdown: string }>(`/api/digests/${seg(day)}`),
    enabled: !!day
  })

export const usePods = () =>
  useQuery({
    queryKey: ['pods'],
    queryFn: () => api<{ pods: PodJSON[]; groups: GroupJSON[] }>('/api/pods'),
    refetchInterval: 60_000
  })
