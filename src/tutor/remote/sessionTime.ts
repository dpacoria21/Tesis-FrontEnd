import type { Measurement } from './client'

/** Server duration is authoritative; monotonic browser time only animates it. */
export function elapsedSeconds(measurement: Measurement, sinceReceivedMs = 0): number {
  return Math.max(0, Math.floor(measurement.elapsed_seconds +
    (measurement.status === 'active' ? Math.max(0, sinceReceivedMs) / 1000 : 0)))
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}
