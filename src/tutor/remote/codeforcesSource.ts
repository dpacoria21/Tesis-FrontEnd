import type { Problem } from './client'

/** Only official, individual problem pages can be presented as Codeforces sources. */
export function codeforcesSourceUrl(provenance: Problem['provenance']): string | undefined {
  if (provenance.platform.trim().toLowerCase() !== 'codeforces') return undefined
  try {
    const url = new URL(provenance.url ?? '')
    if (url.protocol !== 'https:' || !['codeforces.com', 'www.codeforces.com'].includes(url.hostname)) return undefined
    if (url.username || url.password || url.port) return undefined
    const problemPath = /^\/(?:problemset\/problem\/[1-9]\d*\/[A-Za-z][A-Za-z0-9]*|(?:contest|gym)\/[1-9]\d*\/problem\/[A-Za-z][A-Za-z0-9]*)\/?$/
    if (!problemPath.test(url.pathname)) return undefined
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return undefined
  }
}
