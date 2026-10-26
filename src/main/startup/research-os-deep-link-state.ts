import { researchOsDeepLinkFromArguments } from '../../shared/research-os-deep-link'

export class ResearchOsDeepLinkState {
  private pendingUrl: string | null = null

  capture(argv: readonly string[], publish?: (url: string) => void): boolean {
    const url = researchOsDeepLinkFromArguments(argv)
    if (!url) {
      return false
    }
    this.pendingUrl = url
    publish?.(url)
    return true
  }

  consume(): string | null {
    const url = this.pendingUrl
    this.pendingUrl = null
    return url
  }
}
