export type ResearchOsDeepLink = {
  kind: 'agent'
  prompt: string
  cwd: string | null
  agent: string | null
  surface: 'terminal' | 'chat' | null
}

const AGENT_LINK_PATTERN = /^research-os:(?:\/\/)?agent\/?(?:\?([^#]*))?(?:#.*)?$/s
const MAX_PROMPT_LENGTH = 20_000

export function parseResearchOsDeepLink(url: string): ResearchOsDeepLink | null {
  const match = url.trim().match(AGENT_LINK_PATTERN)
  if (!match) {
    return null
  }
  const params = new URLSearchParams(match[1] ?? '')
  const prompt = params.get('prompt')?.slice(0, MAX_PROMPT_LENGTH) ?? ''
  if (!prompt.trim()) {
    return null
  }
  const surface = params.get('surface')
  return {
    kind: 'agent',
    prompt,
    cwd: params.get('cwd') || null,
    agent: params.get('agent') || null,
    surface: surface === 'terminal' || surface === 'chat' ? surface : null
  }
}

export function researchOsDeepLinkFromArguments(argv: readonly string[]): string | null {
  return argv.find((value) => value.startsWith('research-os:')) ?? null
}
