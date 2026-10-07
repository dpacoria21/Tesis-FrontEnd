import { describe, expect, it } from 'vitest'
import type { Measurement } from './client'
import { elapsedSeconds, formatDuration } from './sessionTime'

const measurement: Measurement = { started_at: '2026-10-07T12:00:00Z', ended_at: null,
  elapsed_seconds: 91.8, focus_confirmed_at: '2026-10-07T12:00:00Z', status: 'active', outcome: null,
  server_now: '2026-10-07T12:01:31.800Z' }

describe('session time display', () => {
  it('resumes from persisted server duration and catches up after a delayed tick', () => {
    expect(elapsedSeconds(measurement)).toBe(91)
    expect(elapsedSeconds(measurement, 65000)).toBe(156)
  })
  it('never advances a finished session or subtracts time for a clock adjustment', () => {
    expect(elapsedSeconds({ ...measurement, status: 'finished' }, 90000)).toBe(91)
    expect(elapsedSeconds(measurement, -5000)).toBe(91)
  })
  it('retains hours above one day instead of wrapping', () => {
    expect(formatDuration(60)).toBe('00:01:00')
    expect(formatDuration(90061)).toBe('25:01:01')
  })
})
