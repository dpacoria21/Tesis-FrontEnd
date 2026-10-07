import { describe, expect, it } from 'vitest'
import { codeforcesSourceUrl } from './codeforcesSource'

const source = (url: string | null, platform = 'Codeforces') => ({ platform, url, license_note: '', review_status: 'reviewed' })

describe('official Codeforces problem sources', () => {
  it.each([
    'https://codeforces.com/problemset/problem/4/A',
    'https://www.codeforces.com/contest/1700/problem/B1',
    'https://codeforces.com/gym/100001/problem/A',
  ])('accepts a single official problem page: %s', url => {
    expect(codeforcesSourceUrl(source(url))).toBe(url)
  })

  it('removes unrelated query and fragment navigation from the source link', () => {
    expect(codeforcesSourceUrl(source('https://codeforces.com/contest/4/problem/A?locale=en#comments', ' codeforces ')))
      .toBe('https://codeforces.com/contest/4/problem/A')
  })

  it.each([
    null, '', 'javascript:alert(1)', 'http://codeforces.com/contest/4/problem/A',
    'https://codeforces.com.evil.example/contest/4/problem/A',
    'https://evil.example/contest/4/problem/A',
    'https://user:password@codeforces.com/contest/4/problem/A',
    'https://codeforces.com:8443/contest/4/problem/A',
    'https://codeforces.com/blog/entry/1', 'https://codeforces.com/problemset',
    'https://codeforces.com/contest/4/problem/A/editorial',
    'https://codeforces.com/contest/0/problem/A',
    'https://codeforces.com/contest/4/problem/%41',
  ])('rejects unsafe or non-problem destinations: %s', url => {
    expect(codeforcesSourceUrl(source(url))).toBeUndefined()
  })

  it('does not relabel local demonstration material as a Codeforces problem', () => {
    expect(codeforcesSourceUrl(source('https://codeforces.com/problemset/problem/4/A', 'material propio'))).toBeUndefined()
  })
})
