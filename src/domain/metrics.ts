import type {
  DashboardMetrics,
  MetricsInput,
  SessionCause,
  SessionLog,
} from '../types'

const DAY_MILLISECONDS = 86_400_000
const SESSION_CAUSES: SessionCause[] = [
  'IDEA',
  'IMPLEMENTATION',
  'EDGE_CASE',
  'COMPLEXITY',
  'MATH',
  'READING',
  'PANIC_TIME',
]

function parseReferenceDate(value: Date | string | undefined): Date {
  const parsed = value instanceof Date ? new Date(value) : value ? new Date(value) : new Date()
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Invalid reference date.')
  return parsed
}

function dateKey(value: Date | string): string | null {
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function utcDayNumber(key: string): number {
  return Math.floor(new Date(`${key}T00:00:00.000Z`).getTime() / DAY_MILLISECONDS)
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10_000) / 100
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

function uniqueActivityDays(sessionLogs: SessionLog[], storedDates: string[]): string[] {
  const keys = [
    ...storedDates.map(dateKey),
    ...sessionLogs.map((session) => dateKey(session.completedAt)),
  ].filter((key): key is string => key !== null)

  return [...new Set(keys)].sort()
}

export function calculateStreaks(
  activityDates: readonly string[],
  referenceDate: Date | string = new Date(),
): { current: number; best: number } {
  const referenceKey = dateKey(referenceDate)
  if (!referenceKey) throw new TypeError('Invalid reference date.')
  const referenceDay = utcDayNumber(referenceKey)
  const days = [...new Set(activityDates.map(dateKey).filter((key): key is string => key !== null))]
    .map(utcDayNumber)
    .filter((day) => day <= referenceDay)
    .sort((left, right) => left - right)

  let best = 0
  let running = 0
  let previous: number | undefined
  for (const day of days) {
    running = previous !== undefined && day === previous + 1 ? running + 1 : 1
    best = Math.max(best, running)
    previous = day
  }

  const latest = days.at(-1)
  if (latest === undefined || referenceDay - latest > 1) return { current: 0, best }

  let current = 1
  for (let index = days.length - 2; index >= 0; index -= 1) {
    if (days[index + 1] - days[index] !== 1) break
    current += 1
  }
  return { current, best }
}

function causeCounts(sessionLogs: SessionLog[]): Record<SessionCause, number> {
  const counts = Object.fromEntries(
    SESSION_CAUSES.map((cause) => [cause, 0]),
  ) as Record<SessionCause, number>
  for (const session of sessionLogs) {
    if (session.cause) counts[session.cause] += 1
  }
  return counts
}

export function computeDashboardMetrics(input: MetricsInput): DashboardMetrics {
  const reference = parseReferenceDate(input.referenceDate)
  const today = reference.toISOString().slice(0, 10)
  const referenceDay = utcDayNumber(today)
  const sessions = input.state.sessionLogs
  const solvedSessions = sessions.filter((session) => session.result === 'solved')
  const solvedProblemIds = new Set([
    ...input.state.completedProblemIds,
    ...Object.values(input.state.progress)
      .filter((progress) => progress.status === 'solved')
      .map((progress) => progress.problemId),
    ...solvedSessions.map((session) => session.problemId),
  ])
  const attemptedProblemIds = new Set([
    ...Object.values(input.state.progress)
      .filter((progress) => ['attempted', 'solved'].includes(progress.status))
      .map((progress) => progress.problemId),
    ...sessions.map((session) => session.problemId),
  ])
  const activityDays = uniqueActivityDays(sessions, input.state.activityDates)
  const streaks = calculateStreaks(activityDays, reference)
  const currentRating = input.currentRating ?? input.baseline.currentRating
  const targetRating = input.state.preferences.targetRating
  const latestActivity = activityDays.at(-1)
  const daysSinceLastActivity = latestActivity
    ? Math.max(0, referenceDay - utcDayNumber(latestActivity))
    : input.baseline.daysSinceLastSubmission
  const solvedToday = solvedSessions.filter(
    (session) => dateKey(session.completedAt) === today,
  ).length
  const solvedLast7Days = solvedSessions.filter((session) => {
    const key = dateKey(session.completedAt)
    if (!key) return false
    const age = referenceDay - utcDayNumber(key)
    return age >= 0 && age < 7
  }).length
  const wrongAttempts = sessions.map((session) =>
    Math.max(0, session.attempts - (session.result === 'solved' ? 1 : 0)),
  )

  return {
    currentRating,
    maxRating: Math.max(input.baseline.maxRating, currentRating),
    targetRating,
    ratingGap: Math.max(0, targetRating - currentRating),
    goalProgressPercent: percent(currentRating, targetRating),
    totalSolved:
      input.currentTotalSolved ?? input.baseline.totalSolved + solvedProblemIds.size,
    solvedDuringTraining: solvedProblemIds.size,
    attemptedDuringTraining: attemptedProblemIds.size,
    completionRatePercent: percent(solvedProblemIds.size, attemptedProblemIds.size),
    solvedToday,
    solvedLast7Days,
    currentStreakDays: streaks.current,
    bestStreakDays: streaks.best,
    dailyGoal: input.state.preferences.dailyGoal,
    dailyGoalProgressPercent: Math.min(
      100,
      percent(solvedToday, input.state.preferences.dailyGoal),
    ),
    daysSinceLastActivity,
    reliabilityPercent: percent(solvedSessions.length, sessions.length),
    firstSubmitRatePercent: percent(
      solvedSessions.filter((session) => session.firstSubmit).length,
      solvedSessions.length,
    ),
    avgWrongAttempts: average(wrongAttempts),
    averageConfidence: average(sessions.map((session) => session.confidence)),
    editorialUseRatePercent: percent(
      sessions.filter((session) => session.editorialUsed).length,
      sessions.length,
    ),
    causeCounts: causeCounts(sessions),
  }
}
