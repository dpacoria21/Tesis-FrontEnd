import {
  TUTOR_INTENTS,
  isHelpLevel,
  type HelpLevel,
  type SourceReference,
  type TutorIntent,
} from '../domain'

export const PEDAGOGICAL_EVENT_SCHEMA_VERSION = 1 as const

export const PROTECTION_SIGNALS = [
  'direct_solution_request',
  'evasion_attempt',
  'repeated_direct_request',
  'post_generation_leakage',
  'insufficient_evidence',
] as const

export type ProtectionSignal = (typeof PROTECTION_SIGNALS)[number]

export const PROTECTION_ACTIONS = [
  'none',
  'regenerated',
  'reduced',
  'blocked',
  'fallback',
] as const

export type ProtectionAction = (typeof PROTECTION_ACTIONS)[number]

export interface PedagogicalProtection {
  signals: ProtectionSignal[]
  action: ProtectionAction
}

export interface PedagogicalEvent {
  schemaVersion: typeof PEDAGOGICAL_EVENT_SCHEMA_VERSION
  eventId: string
  responseId: string
  studentId: string
  problemId: string | null
  occurredAt: string
  intent: TutorIntent
  selectedHelpLevel: HelpLevel
  reasonCodes: string[]
  sources: SourceReference[]
  protection: PedagogicalProtection
  evidenceSufficient: boolean
  latencyMs: number
}

export interface EventValidation {
  valid: boolean
  errors: string[]
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validSource(source: SourceReference): boolean {
  const raw = source as unknown as Record<string, unknown>
  return (
    nonEmpty(source.sourceId) &&
    nonEmpty(source.chunkId) &&
    nonEmpty(source.title) &&
    (source.uri === undefined || nonEmpty(source.uri)) &&
    !['excerpt', 'content', 'apiKey', 'token'].some((field) => field in raw)
  )
}

export function validatePedagogicalEvent(value: unknown): EventValidation {
  const errors: string[] = []
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['event must be an object'] }
  }

  const rawEvent = value as Record<string, unknown>
  if (
    ['query', 'prompt', 'responseText', 'code', 'apiKey', 'token', 'secret'].some(
      (field) => field in rawEvent,
    )
  ) {
    errors.push('event contains a forbidden raw or secret field')
  }
  const event = value as Partial<PedagogicalEvent>
  if (event.schemaVersion !== PEDAGOGICAL_EVENT_SCHEMA_VERSION) {
    errors.push('unsupported schemaVersion')
  }
  for (const field of ['eventId', 'responseId', 'studentId'] as const) {
    if (!nonEmpty(event[field])) errors.push(`${field} is required`)
  }
  if (event.problemId !== null && !nonEmpty(event.problemId)) {
    errors.push('problemId must be null or a non-empty string')
  }
  if (!nonEmpty(event.occurredAt) || !Number.isFinite(Date.parse(event.occurredAt))) {
    errors.push('occurredAt must be an ISO-compatible timestamp')
  }
  if (!event.intent || !TUTOR_INTENTS.includes(event.intent)) {
    errors.push('intent is invalid')
  }
  if (!isHelpLevel(event.selectedHelpLevel)) {
    errors.push('selectedHelpLevel is invalid')
  }
  if (
    !Array.isArray(event.reasonCodes) ||
    event.reasonCodes.length === 0 ||
    event.reasonCodes.some((reason) => !nonEmpty(reason))
  ) {
    errors.push('reasonCodes must contain non-empty strings')
  }
  if (
    !Array.isArray(event.sources) ||
    event.sources.some((source) => !validSource(source))
  ) {
    errors.push('sources are invalid')
  }
  if (
    !event.protection ||
    !Array.isArray(event.protection.signals) ||
    event.protection.signals.some(
      (signal) => !PROTECTION_SIGNALS.includes(signal),
    ) ||
    !PROTECTION_ACTIONS.includes(event.protection.action)
  ) {
    errors.push('protection is invalid')
  }
  if (typeof event.evidenceSufficient !== 'boolean') {
    errors.push('evidenceSufficient must be boolean')
  }
  if (
    typeof event.latencyMs !== 'number' ||
    !Number.isFinite(event.latencyMs) ||
    event.latencyMs < 0
  ) {
    errors.push('latencyMs must be a non-negative number')
  }
  return { valid: errors.length === 0, errors }
}

export function assertPedagogicalEvent(
  value: unknown,
): asserts value is PedagogicalEvent {
  const validation = validatePedagogicalEvent(value)
  if (!validation.valid) {
    throw new Error(`Invalid pedagogical event: ${validation.errors.join('; ')}`)
  }
}

export function createPedagogicalEvent(
  input: Omit<PedagogicalEvent, 'schemaVersion'>,
): PedagogicalEvent {
  const event: PedagogicalEvent = {
    schemaVersion: PEDAGOGICAL_EVENT_SCHEMA_VERSION,
    eventId: input.eventId,
    responseId: input.responseId,
    studentId: input.studentId,
    problemId: input.problemId,
    occurredAt: input.occurredAt,
    intent: input.intent,
    selectedHelpLevel: input.selectedHelpLevel,
    reasonCodes: [...new Set(input.reasonCodes)].sort(),
    sources: input.sources.map((source) => ({
      sourceId: source.sourceId,
      chunkId: source.chunkId,
      title: source.title,
      ...(source.uri ? { uri: source.uri } : {}),
    })),
    protection: {
      action: input.protection.action,
      signals: [...new Set(input.protection.signals)].sort(),
    },
    evidenceSufficient: input.evidenceSufficient,
    latencyMs: Math.round(input.latencyMs),
  }
  assertPedagogicalEvent(event)
  return event
}
