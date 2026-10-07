import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import type { Measurement } from './client'
import { elapsedSeconds, formatDuration } from './sessionTime'

export function SessionClock({ measurement }: { measurement: Measurement }) {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(measurement))
  useEffect(() => {
    const received = performance.now()
    const update = () => setSeconds(elapsedSeconds(measurement, performance.now() - received))
    update()
    if (measurement.status !== 'active') return
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [measurement])
  return <div className="study-clock">
    <span><Clock3 size={16} /> Tiempo transcurrido</span>
    <strong role="timer" aria-label="Tiempo transcurrido de la sesión">{formatDuration(seconds)}</strong>
    <small>{measurement.status === 'active' ? 'En curso' : 'Registrado'}</small>
  </div>
}
