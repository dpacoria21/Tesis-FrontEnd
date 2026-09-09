import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeforcesClient } from './codeforces'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CodeforcesClient.contestList', () => {
  it('requests official contests and preserves the API metadata', async () => {
    const contest = {
      id: 2140,
      name: 'Codeforces Round 2140 (Div. 2)',
      type: 'CF',
      phase: 'FINISHED',
      frozen: false,
      durationSeconds: 7200,
      startTimeSeconds: 1_755_000_000,
      relativeTimeSeconds: 100,
      preparedBy: 'tourist',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK', result: [contest] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const client = new CodeforcesClient(undefined, 'https://example.test/api')

    await expect(client.contestList(false, signal)).resolves.toEqual([contest])
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/contest.list?gym=false',
      { signal },
    )
  })
})
