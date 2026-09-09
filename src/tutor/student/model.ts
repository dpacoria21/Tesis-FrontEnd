import {
  ERROR_CATEGORIES,
  HELP_LEVELS,
  helpLevelIndex,
  isErrorCategory,
  isHelpLevel,
  type ErrorCategory,
  type HelpLevel,
} from '../domain'

export const STUDENT_STATE_SCHEMA_VERSION = 1 as const

export const ATTEMPT_OUTCOMES = [
  'solved',
  'partial',
  'failed',
  'compile_error',
  'runtime_error',
] as const

export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number]

export interface ConceptPractice {
  attempts: number
  solvedAttempts: number
  totalTimeMs: number
  maxHelpLevel: HelpLevel
  lastPracticedAt: string
}

export interface ProblemAttempt {
  attemptId: string
  problemId: string
  occurredAt: string
  outcome: AttemptOutcome
  durationMs: number
  conceptIds: string[]
  errors: ErrorCategory[]
  helpLevelUsed: HelpLevel
  codeFingerprint?: string
  codeSizeChars?: number
}

export interface DetectedError {
  errorId: string
  attemptId: string
  problemId: string
  category: ErrorCategory
  detectedAt: string
}

export interface RecommendationHistoryEntry {
  recommendationId: string
  problemId: string
  recommendedAt: string
  reasonCodes: string[]
  score: number
}

export interface StudentState {
  schemaVersion: typeof STUDENT_STATE_SCHEMA_VERSION
  studentId: string
  revision: number
  conceptsPracticed: Record<string, ConceptPractice>
  attempts: ProblemAttempt[]
  detectedErrors: DetectedError[]
  maxHelpLevelByProblem: Record<string, HelpLevel>
  solvedProblemIds: string[]
  masteryByConcept: Record<string, number>
  directSolutionRequestsByProblem: Record<string, number>
  lastActivityAt: string | null
  recommendationHistory: RecommendationHistoryEntry[]
}

export interface AttemptTransition {
  inserted: boolean
  state: StudentState
  masteryChanges: Record<string, { before: number; after: number }>
}

export interface HelpUsageInput {
  problemId: string
  level: HelpLevel
  occurredAt: string
  directSolutionRequest?: boolean
}

const DEFAULT_MASTERY = 0.3
const MASTERY_LEARNING_RATE = 0.25

const OUTCOME_SCORE: Record<AttemptOutcome, number> = {
  solved: 1,
  partial: 0.55,
  failed: 0.2,
  compile_error: 0.1,
  runtime_error: 0.15,
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${field} must not be empty`)
  return normalized
}

function requireIsoTimestamp(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible timestamp`)
  }
  return value
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function clampMastery(value: number): number {
  return round(Math.max(0, Math.min(1, value)))
}

function normalizeConceptIds(concepts: readonly string[]): string[] {
  return [...new Set(concepts.map((item) => item.trim().toLowerCase()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
}

function uniqueErrors(errors: readonly ErrorCategory[]): ErrorCategory[] {
  return ERROR_CATEGORIES.filter((category) => errors.includes(category))
}

function latestTimestamp(current: string | null, candidate: string): string {
  if (!current) return candidate
  return Date.parse(candidate) > Date.parse(current) ? candidate : current
}

function cloneState(state: StudentState): StudentState {
  return {
    ...state,
    conceptsPracticed: Object.fromEntries(
      Object.entries(state.conceptsPracticed).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ),
    attempts: state.attempts.map((attempt) => ({
      ...attempt,
      conceptIds: [...attempt.conceptIds],
      errors: [...attempt.errors],
    })),
    detectedErrors: state.detectedErrors.map((error) => ({ ...error })),
    maxHelpLevelByProblem: { ...state.maxHelpLevelByProblem },
    solvedProblemIds: [...state.solvedProblemIds],
    masteryByConcept: { ...state.masteryByConcept },
    directSolutionRequestsByProblem: {
      ...state.directSolutionRequestsByProblem,
    },
    recommendationHistory: state.recommendationHistory.map((entry) => ({
      ...entry,
      reasonCodes: [...entry.reasonCodes],
    })),
  }
}

export function createStudentState(studentId: string): StudentState {
  return {
    schemaVersion: STUDENT_STATE_SCHEMA_VERSION,
    studentId: requireNonEmpty(studentId, 'studentId'),
    revision: 0,
    conceptsPracticed: {},
    attempts: [],
    detectedErrors: [],
    maxHelpLevelByProblem: {},
    solvedProblemIds: [],
    masteryByConcept: {},
    directSolutionRequestsByProblem: {},
    lastActivityAt: null,
    recommendationHistory: [],
  }
}

export function recordAttempt(
  state: StudentState,
  rawAttempt: ProblemAttempt,
): AttemptTransition {
  assertStudentState(state)
  const attempt: ProblemAttempt = {
    ...rawAttempt,
    attemptId: requireNonEmpty(rawAttempt.attemptId, 'attemptId'),
    problemId: requireNonEmpty(rawAttempt.problemId, 'problemId'),
    occurredAt: requireIsoTimestamp(rawAttempt.occurredAt, 'occurredAt'),
    durationMs: Math.max(0, Math.round(rawAttempt.durationMs)),
    conceptIds: normalizeConceptIds(rawAttempt.conceptIds),
    errors: uniqueErrors(rawAttempt.errors),
  }

  if (!ATTEMPT_OUTCOMES.includes(attempt.outcome)) {
    throw new Error(`Unsupported attempt outcome: ${attempt.outcome}`)
  }
  if (!isHelpLevel(attempt.helpLevelUsed)) {
    throw new Error(`Unsupported help level: ${String(attempt.helpLevelUsed)}`)
  }
  if (!isProblemAttempt(attempt)) {
    throw new Error('Invalid problem attempt')
  }
  if (state.attempts.some((item) => item.attemptId === attempt.attemptId)) {
    return { inserted: false, state: cloneState(state), masteryChanges: {} }
  }

  const next = cloneState(state)
  const masteryChanges: AttemptTransition['masteryChanges'] = {}
  const helpPenalty = helpLevelIndex(attempt.helpLevelUsed) * 0.05
  const observation = Math.max(0, OUTCOME_SCORE[attempt.outcome] - helpPenalty)

  for (const conceptId of attempt.conceptIds) {
    const previousMastery = next.masteryByConcept[conceptId] ?? DEFAULT_MASTERY
    const updatedMastery = clampMastery(
      previousMastery + MASTERY_LEARNING_RATE * (observation - previousMastery),
    )
    next.masteryByConcept[conceptId] = updatedMastery
    masteryChanges[conceptId] = {
      before: previousMastery,
      after: updatedMastery,
    }

    const previousPractice = next.conceptsPracticed[conceptId]
    next.conceptsPracticed[conceptId] = {
      attempts: (previousPractice?.attempts ?? 0) + 1,
      solvedAttempts:
        (previousPractice?.solvedAttempts ?? 0) +
        (attempt.outcome === 'solved' ? 1 : 0),
      totalTimeMs: (previousPractice?.totalTimeMs ?? 0) + attempt.durationMs,
      maxHelpLevel:
        previousPractice &&
        helpLevelIndex(previousPractice.maxHelpLevel) >
          helpLevelIndex(attempt.helpLevelUsed)
          ? previousPractice.maxHelpLevel
          : attempt.helpLevelUsed,
      lastPracticedAt: previousPractice
        ? latestTimestamp(previousPractice.lastPracticedAt, attempt.occurredAt)
        : attempt.occurredAt,
    }
  }

  next.attempts.push(attempt)
  for (const category of attempt.errors) {
    next.detectedErrors.push({
      errorId: `${attempt.attemptId}:${category}`,
      attemptId: attempt.attemptId,
      problemId: attempt.problemId,
      category,
      detectedAt: attempt.occurredAt,
    })
  }

  const previousHelp = next.maxHelpLevelByProblem[attempt.problemId]
  if (
    !previousHelp ||
    helpLevelIndex(attempt.helpLevelUsed) > helpLevelIndex(previousHelp)
  ) {
    next.maxHelpLevelByProblem[attempt.problemId] = attempt.helpLevelUsed
  }

  if (attempt.outcome === 'solved') {
    next.solvedProblemIds = [
      ...new Set([...next.solvedProblemIds, attempt.problemId]),
    ].sort((left, right) => left.localeCompare(right))
  }
  next.lastActivityAt = latestTimestamp(next.lastActivityAt, attempt.occurredAt)
  next.revision += 1

  return { inserted: true, state: next, masteryChanges }
}

export function recordHelpUsage(
  state: StudentState,
  rawInput: HelpUsageInput,
): StudentState {
  assertStudentState(state)
  const input = {
    ...rawInput,
    problemId: requireNonEmpty(rawInput.problemId, 'problemId'),
    occurredAt: requireIsoTimestamp(rawInput.occurredAt, 'occurredAt'),
  }
  if (!isHelpLevel(input.level)) {
    throw new Error(`Unsupported help level: ${String(input.level)}`)
  }

  const next = cloneState(state)
  const previous = next.maxHelpLevelByProblem[input.problemId]
  if (!previous || helpLevelIndex(input.level) > helpLevelIndex(previous)) {
    next.maxHelpLevelByProblem[input.problemId] = input.level
  }
  if (input.directSolutionRequest) {
    next.directSolutionRequestsByProblem[input.problemId] =
      (next.directSolutionRequestsByProblem[input.problemId] ?? 0) + 1
  }
  next.lastActivityAt = latestTimestamp(next.lastActivityAt, input.occurredAt)
  next.revision += 1
  return next
}

export function recordRecommendation(
  state: StudentState,
  rawEntry: RecommendationHistoryEntry,
): StudentState {
  assertStudentState(state)
  const entry: RecommendationHistoryEntry = {
    ...rawEntry,
    recommendationId: requireNonEmpty(
      rawEntry.recommendationId,
      'recommendationId',
    ),
    problemId: requireNonEmpty(rawEntry.problemId, 'problemId'),
    recommendedAt: requireIsoTimestamp(
      rawEntry.recommendedAt,
      'recommendedAt',
    ),
    reasonCodes: [...new Set(rawEntry.reasonCodes)].sort(),
    score: round(rawEntry.score),
  }
  if (!isRecommendationHistoryEntry(entry)) {
    throw new Error('Invalid recommendation history entry')
  }
  if (
    state.recommendationHistory.some(
      (item) => item.recommendationId === entry.recommendationId,
    )
  ) {
    return cloneState(state)
  }
  const next = cloneState(state)
  next.recommendationHistory.push(entry)
  next.lastActivityAt = latestTimestamp(next.lastActivityAt, entry.recommendedAt)
  next.revision += 1
  return next
}

export function isStudentState(value: unknown): value is StudentState {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  const forbiddenStateFields = [
    'email',
    'name',
    'apiKey',
    'token',
    'secret',
    'conversationHistory',
    'rawPrompt',
  ]
  if (forbiddenStateFields.some((field) => field in raw)) return false

  const state = value as Partial<StudentState>
  if (
    state.schemaVersion !== STUDENT_STATE_SCHEMA_VERSION ||
    typeof state.studentId !== 'string' ||
    !state.studentId.trim() ||
    typeof state.revision !== 'number' ||
    !Number.isInteger(state.revision) ||
    state.revision < 0 ||
    !isObjectRecord(state.conceptsPracticed) ||
    !Array.isArray(state.attempts) ||
    !Array.isArray(state.detectedErrors) ||
    !isObjectRecord(state.maxHelpLevelByProblem) ||
    !Array.isArray(state.solvedProblemIds) ||
    !isObjectRecord(state.masteryByConcept) ||
    !isObjectRecord(state.directSolutionRequestsByProblem) ||
    !Array.isArray(state.recommendationHistory) ||
    (state.lastActivityAt !== null && !isTimestamp(state.lastActivityAt))
  ) {
    return false
  }

  if (
    !Object.values(state.masteryByConcept).every(
      (mastery) =>
        typeof mastery === 'number' && mastery >= 0 && mastery <= 1,
    ) ||
    !Object.values(state.maxHelpLevelByProblem).every(isHelpLevel) ||
    !Object.values(state.directSolutionRequestsByProblem).every(
      (count) =>
        typeof count === 'number' && Number.isInteger(count) && count >= 0,
    ) ||
    !state.solvedProblemIds.every(
      (problemId) => typeof problemId === 'string' && problemId.trim().length > 0,
    ) ||
    !Object.values(state.conceptsPracticed).every(isConceptPractice)
  ) {
    return false
  }

  return (
    state.attempts.every(isProblemAttempt) &&
    new Set(state.attempts.map((attempt) => attempt.attemptId)).size ===
      state.attempts.length &&
    state.detectedErrors.every(isDetectedError) &&
    new Set(state.detectedErrors.map((error) => error.errorId)).size ===
      state.detectedErrors.length &&
    state.recommendationHistory.every(isRecommendationHistoryEntry) &&
    new Set(
      state.recommendationHistory.map((entry) => entry.recommendationId),
    ).size === state.recommendationHistory.length
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isConceptPractice(value: unknown): value is ConceptPractice {
  if (!isObjectRecord(value)) return false
  return (
    typeof value.attempts === 'number' &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0 &&
    typeof value.solvedAttempts === 'number' &&
    Number.isInteger(value.solvedAttempts) &&
    value.solvedAttempts >= 0 &&
    value.solvedAttempts <= value.attempts &&
    typeof value.totalTimeMs === 'number' &&
    Number.isFinite(value.totalTimeMs) &&
    value.totalTimeMs >= 0 &&
    isHelpLevel(value.maxHelpLevel) &&
    isTimestamp(value.lastPracticedAt)
  )
}

function isProblemAttempt(value: unknown): value is ProblemAttempt {
  if (!isObjectRecord(value)) return false
  const forbiddenFields = [
    'code',
    'sourceCode',
    'rawCode',
    'prompt',
    'query',
    'apiKey',
    'token',
  ]
  if (forbiddenFields.some((field) => field in value)) return false
  return (
    isNonEmptyString(value.attemptId) &&
    isNonEmptyString(value.problemId) &&
    isTimestamp(value.occurredAt) &&
    isAttemptOutcome(value.outcome) &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    Array.isArray(value.conceptIds) &&
    value.conceptIds.every(isNonEmptyString) &&
    Array.isArray(value.errors) &&
    value.errors.every(isErrorCategory) &&
    isHelpLevel(value.helpLevelUsed) &&
    (value.codeFingerprint === undefined ||
      (typeof value.codeFingerprint === 'string' &&
        /^fnv1a32:[0-9a-f]{8}$/.test(value.codeFingerprint))) &&
    (value.codeSizeChars === undefined ||
      (typeof value.codeSizeChars === 'number' &&
        Number.isInteger(value.codeSizeChars) &&
        value.codeSizeChars >= 0))
  )
}

function isDetectedError(value: unknown): value is DetectedError {
  if (!isObjectRecord(value)) return false
  return (
    isNonEmptyString(value.errorId) &&
    isNonEmptyString(value.attemptId) &&
    isNonEmptyString(value.problemId) &&
    isErrorCategory(value.category) &&
    isTimestamp(value.detectedAt)
  )
}

function isRecommendationHistoryEntry(
  value: unknown,
): value is RecommendationHistoryEntry {
  if (!isObjectRecord(value)) return false
  return (
    isNonEmptyString(value.recommendationId) &&
    isNonEmptyString(value.problemId) &&
    isTimestamp(value.recommendedAt) &&
    Array.isArray(value.reasonCodes) &&
    value.reasonCodes.every(isNonEmptyString) &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score)
  )
}

export function assertStudentState(value: unknown): asserts value is StudentState {
  if (!isStudentState(value)) throw new Error('Invalid student state v1')
}

export function isAttemptOutcome(value: unknown): value is AttemptOutcome {
  return (
    typeof value === 'string' &&
    ATTEMPT_OUTCOMES.includes(value as AttemptOutcome)
  )
}

export function emptyHelpLevelMap(): Record<HelpLevel, number> {
  return Object.fromEntries(HELP_LEVELS.map((level) => [level, 0])) as Record<
    HelpLevel,
    number
  >
}
