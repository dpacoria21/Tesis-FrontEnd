import { describe, expect, it, vi } from 'vitest'
import { createStudyClient, safeSourceUrl } from './client'

describe('tesis-pc HTTP integration', () => {
  it('sends explicit focus confirmation and the declared finish outcome', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}'))
    const api = createStudyClient('test-token', fetcher)
    await api.start('cf-4A', true)
    await api.resume('legacy /1', true)
    await api.finish('legacy /1', 'stopped')
    expect(fetcher.mock.calls.map(([path, options]) => [path, JSON.parse(options?.body as string)])).toEqual([
      ['/api/tutor/sessions', { problem_id: 'cf-4A', focus_confirmed: true }],
      ['/api/tutor/sessions/legacy%20%2F1/resume', { focus_confirmed: true }],
      ['/api/tutor/sessions/legacy%20%2F1/finish', { outcome: 'stopped' }],
    ])
  })
  it('binds calls to an access token, without accepting an arbitrary student id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'job-1', status: 'completed', response: { interaction_id: 'turn-1' } })))
    const api = createStudyClient('test-token', fetcher)
    await api.ask('session /1', { message: '¿Qué pide?', need: 'comprension', request_execution: false })
    expect(fetcher).toHaveBeenCalledOnce()
    const [path, options] = fetcher.mock.calls[0]
    expect(path).toBe('/api/tutor/sessions/session%20%2F1/turns')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-token' })
    expect(JSON.parse(options?.body as string)).not.toHaveProperty('student_id')
  })
  it('does not automatically retry a failed write or fabricate a response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('network'))
    await expect(createStudyClient('t', fetcher).ask('s', { message: 'Hola', request_execution: false })).rejects.toThrow('historial')
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('surfaces server busy and expired access distinctly', async () => {
    for (const status of [401, 429, 503]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: 'Mensaje del servidor' }), { status }))
      await expect(createStudyClient('t', fetcher).me()).rejects.toMatchObject({ status, message: 'Mensaje del servidor' })
    }
  })
  it('rejects executable citation URLs', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeSourceUrl('https://example.org/source')).toBe('https://example.org/source')
  })
})
