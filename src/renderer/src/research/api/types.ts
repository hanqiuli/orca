// JSON contract served by `research-os mission-control --serve`.

export type ISO = string

export type RunJSON = {
  project: string
  wandb_project: string
  run_id: string
  name: string
  url: string
  state: string
  status: 'running' | 'done' | ''
  verdict: string
  step: number | null
  runtime_h: number | null
  heartbeat: ISO | ''
  created_at: ISO | null
  updated_at: ISO | null
  exp: string
  arm: string
  baseline_arm: string
  axis: string
  axis_value: string
  owner: string
  hypothesis: string
  code_rev: string
  job_type: string
  protocol: string
  parent_run_id: string
  /** Rank-0 hostname (contract key `host`); matches a pod's `hostname`. */
  host: string
  evals: Record<string, number>
  metrics: Record<string, number>
  flags: string[]
  media_keys: string[]
  /** Eval runs whose parent_run_id is this run (only nested in experiment detail). */
  attached: RunJSON[]
}

export type Pinned = { exp?: string; arm?: string; ckpt?: string }

export type ProjectJSON = {
  key: string
  title: string
  description: string
  tracks: string[]
  wandb_projects: string[]
  pinned: Pinned
  n_experiments: number
  n_active: number
  n_running: number
}

export type ExpStatus = 'active' | 'concluded' | 'abandoned'
export type ExpKind = 'training' | 'inference' | ''
export type Direction = 'min' | 'max' | ''

export type ExperimentJSON = {
  id: string
  project: string
  track: string
  title: string
  hypothesis: string
  metric: string
  direction: Direction
  baseline_arm: string
  kind: ExpKind
  status: ExpStatus
  verdict: string
  owner: string
  created: string
  runs: string[]
  notes: string
  n_runs: number
  n_running: number
  updated_at: ISO | null
  wandb_group_url: string
}

export type TreeNode = { track: string; children: TreeNode[]; experiments: ExperimentJSON[] }

export type Decision = { id: string; date: string; text: string }

export type ProjectDetailJSON = {
  /** `body` = project notes markdown. */
  project: ProjectJSON & { body: string }
  tree: TreeNode
  experiments: ExperimentJSON[]
  decisions: Decision[]
  campaigns: CampaignJSON[]
}

export type MediaItem = {
  path: string
  url: string
  width?: number
  height?: number
  caption?: string
}

export type MediaEntry = {
  step: number
  type: 'image' | 'video' | 'table' | 'html'
  items: MediaItem[]
}

export type MediaJSON = { keys: Record<string, MediaEntry[]> }

/** W&B `*.table.json` file. */
export type WandbTable = { columns: string[]; data: unknown[][] }

export type TraceStep = {
  seq: number
  kind: 'system' | 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'result'
  text: string
  name?: string
  input?: unknown
  ts?: ISO
}

export type Row = Record<string, unknown>

export type LedgerEntry = { ts: ISO; arm_id: string; event: string; data: Record<string, unknown> }

export type CampaignJSON = {
  id: string
  project: string
  path: string
  stopped: boolean
  program: string
  harness: Record<string, unknown>
  counts: Record<string, number>
  results: Record<string, string>[]
  ledger: LedgerEntry[]
  kept: Record<string, string>[]
  budget_lines: string[]
}

export type ScratchpadJSON = { markdown: string; updated_at: ISO | null }

export type DigestJSON = { day: string; summary: string; needs_you: string[] }

export type ProjectRunsJSON = { project: string; error: string; runs: RunJSON[] }

export type Pipeline = {
  name: string
  updated: string
  done: number
  total: number
  rate: string
  note: string
  stale: boolean
}

export type Expiry = { name: string; date: string; note: string; days_left: number }

export type MemoryFile = { path: string; heading: string; mtime: ISO }

export type Board = { sessions: Row[]; claims: Row[] }

export type StateJSON = {
  generated: ISO
  host: string
  interval_s: number
  day: string
  needs_you: string[]
  projects: ProjectRunsJSON[]
  campaigns: CampaignJSON[]
  board: Board | null
  pipelines: Pipeline[]
  pipelines_note: string
  expiries: Expiry[]
  memory: MemoryFile[]
  latest_digest: DigestJSON | null
  registry: { projects: ProjectJSON[] }
}

export type RunDetailJSON = {
  run: RunJSON
  config: Record<string, unknown>
  summary: Record<string, unknown>
  tags: string[]
  notes: string
}

export type HistoryJSON = {
  keys: string[]
  rows: ({ _step: number } & Record<string, number | null>)[]
}

export type ArmRow = {
  arm: string
  baseline_arm: string
  state: string
  status: string
  verdict: string
  code_rev: string
  created_at: ISO | null
  url: string
  id: string
  [evalKey: `eval/${string}`]: number | undefined
}

export type DiffRow = {
  arm: string
  baseline_arm: string
  step: number | 'latest' | null
  value: number | null
  baseline: number | null
  rel_gap: number | null
  verdict: string | null
  url: string
}

export type ExperimentDetailJSON = {
  experiment: ExperimentJSON
  arms: ArmRow[]
  diff: DiffRow[]
  runs: RunJSON[]
}

export type PodGpu = {
  index: number
  util: number | null
  mem_used_mb: number | null
  mem_total_mb: number | null
}

export type PodSample = {
  ts: ISO
  reachable: boolean
  gpus: PodGpu[]
  procs: number
  tmux: string[]
}

/** `staging | reserved | off` are quiet: idleness there is deliberate and never alerts. */
export type PodState = 'active' | 'staging' | 'reserved' | 'off'

export type PodJSON = {
  name: string
  host: string
  user: string
  provider: string
  /** Group (capacity block) this node belongs to; state, since, until and expires are the group's. */
  group?: string
  gpus: { count: number; model: string }
  hostname: string
  state: PodState
  note: string
  owner: string
  since: ISO
  until?: ISO
  expires?: ISO
  added: ISO
  last: PodSample | null
  /** [ts, max GPU util %] over 24 h, at most 144 points. */
  util_24h: [ISO, number][]
  alert: 'idle' | 'unreachable' | 'expiring' | null
  running_runs: RunJSON[]
  samples_24h?: PodSample[]
}

/** Nodes that act as one unit (a capacity block): one state, one expiry, idle only when all nodes are. */
export type GroupJSON = {
  name: string
  state: PodState
  note: string
  owner: string
  since: ISO
  until?: ISO
  expires?: ISO
  added: ISO
  members: string[]
  gpus: { count: number; model: string }
  alert: 'idle' | 'expiring' | null
}
