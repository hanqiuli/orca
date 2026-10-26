import { describe, expect, it } from 'vitest'
import { parseResearchOsDeepLink, researchOsDeepLinkFromArguments } from './research-os-deep-link'

describe('parseResearchOsDeepLink', () => {
  it('decodes every agent parameter', () => {
    expect(
      parseResearchOsDeepLink(
        'research-os://agent/?prompt=hello%20world%26more&cwd=%2Ftmp%2Fproj&agent=claude&surface=chat'
      )
    ).toEqual({
      kind: 'agent',
      prompt: 'hello world&more',
      cwd: '/tmp/proj',
      agent: 'claude',
      surface: 'chat'
    })
  })

  it('accepts the opaque form and defaults optional fields', () => {
    expect(parseResearchOsDeepLink('research-os:agent?prompt=hi&surface=bogus')).toEqual({
      kind: 'agent',
      prompt: 'hi',
      cwd: null,
      agent: null,
      surface: null
    })
  })

  it('truncates long prompts', () => {
    const link = parseResearchOsDeepLink(`research-os://agent?prompt=${'a'.repeat(30_000)}`)
    expect(link?.prompt).toHaveLength(20_000)
  })

  it('rejects missing prompts, other hosts and other schemes', () => {
    expect(parseResearchOsDeepLink('research-os://agent?cwd=/tmp')).toBeNull()
    expect(parseResearchOsDeepLink('research-os://agent?prompt=%20')).toBeNull()
    expect(parseResearchOsDeepLink('research-os://agentx?prompt=hi')).toBeNull()
    expect(parseResearchOsDeepLink('orca://skills/share/x')).toBeNull()
  })
})

describe('researchOsDeepLinkFromArguments', () => {
  it('returns the first research-os argument', () => {
    expect(
      researchOsDeepLinkFromArguments([
        '/Applications/Research OS.app',
        'orca://skills/share/x',
        'research-os://agent?prompt=a',
        'research-os://agent?prompt=b'
      ])
    ).toBe('research-os://agent?prompt=a')
    expect(researchOsDeepLinkFromArguments(['orca', '--flag'])).toBeNull()
  })
})
