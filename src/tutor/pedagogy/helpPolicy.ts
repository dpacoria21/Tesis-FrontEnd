import {
  helpLevelAt,
  helpLevelIndex,
  type ErrorCategory,
  type HelpLevel,
  type TutorIntent,
} from '../domain'

export interface TeacherHelpRules {
  maxHelpLevel: HelpLevel
  allowN5WhenSolved: boolean
  allowN5DuringUpsolve: boolean
  allowN5ForUnsolved: boolean
  minimumMinutesBlockedForStrategy: number
  minimumAttemptsForDebug: number
  requireProgressiveDisclosure: boolean
}

export const DEFAULT_TEACHER_HELP_RULES: TeacherHelpRules = {
  maxHelpLevel: 'N5',
  allowN5WhenSolved: true,
  allowN5DuringUpsolve: true,
  allowN5ForUnsolved: false,
  minimumMinutesBlockedForStrategy: 5,
  minimumAttemptsForDebug: 1,
  requireProgressiveDisclosure: true,
}

export interface HelpPolicyContext {
  intent: TutorIntent
  requestedLevel?: HelpLevel
  currentMaxHelpLevel?: HelpLevel
  attemptCount: number
  minutesBlocked: number
  mastery: number
  detectedErrors: ErrorCategory[]
  directSolutionRequested: boolean
  evasionDetected: boolean
  previousDirectRequests: number
  problemSolved: boolean
  isUpsolve: boolean
}

export type HelpReasonCode =
  | 'intent_mapped'
  | 'progressive_disclosure'
  | 'strategy_requires_engagement'
  | 'debug_requires_attempt'
  | 'n5_requires_solved_or_upsolve'
  | 'teacher_level_cap'
  | 'direct_solution_protected'
  | 'evasion_protected'
  | 'repeated_direct_request'
  | 'low_mastery_scaffold'

export interface HelpDecision {
  requestedLevel: HelpLevel
  selectedLevel: HelpLevel
  previousLevel: HelpLevel | null
  reasonCodes: HelpReasonCode[]
  explanation: string
  protectionActivated: boolean
  mayRevealCompleteSolution: boolean
}

const INTENT_LEVEL: Record<TutorIntent, HelpLevel> = {
  clarify: 'N0',
  understand: 'N1',
  concept: 'N2',
  strategy: 'N3',
  debug: 'N4',
  solution: 'N5',
  recommendation: 'N1',
}

function boundedNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function minimumLevel(levels: readonly HelpLevel[]): HelpLevel {
  return levels.reduce((minimum, level) =>
    helpLevelIndex(level) < helpLevelIndex(minimum) ? level : minimum,
  )
}

function uniqueReasons(reasons: HelpReasonCode[]): HelpReasonCode[] {
  return [...new Set(reasons)]
}

export function decideHelpLevel(
  rawContext: HelpPolicyContext,
  rules: TeacherHelpRules = DEFAULT_TEACHER_HELP_RULES,
): HelpDecision {
  const context = {
    ...rawContext,
    attemptCount: boundedNonNegative(Math.floor(rawContext.attemptCount)),
    minutesBlocked: boundedNonNegative(rawContext.minutesBlocked),
    mastery: Math.max(0, Math.min(1, rawContext.mastery)),
    previousDirectRequests: boundedNonNegative(
      Math.floor(rawContext.previousDirectRequests),
    ),
  }
  const requestedLevel = context.requestedLevel ?? INTENT_LEVEL[context.intent]
  const reasons: HelpReasonCode[] = ['intent_mapped']
  const ceilings: HelpLevel[] = [requestedLevel, rules.maxHelpLevel]

  if (helpLevelIndex(requestedLevel) > helpLevelIndex(rules.maxHelpLevel)) {
    reasons.push('teacher_level_cap')
  }

  if (rules.requireProgressiveDisclosure && requestedLevel !== 'N0') {
    const previousIndex = context.currentMaxHelpLevel
      ? helpLevelIndex(context.currentMaxHelpLevel)
      : 0
    const progressiveCeiling = helpLevelAt(previousIndex + 1)
    ceilings.push(progressiveCeiling)
    if (helpLevelIndex(requestedLevel) > helpLevelIndex(progressiveCeiling)) {
      reasons.push('progressive_disclosure')
    }
  }

  if (
    helpLevelIndex(requestedLevel) >= helpLevelIndex('N3') &&
    context.attemptCount === 0 &&
    context.minutesBlocked < rules.minimumMinutesBlockedForStrategy
  ) {
    ceilings.push('N2')
    reasons.push('strategy_requires_engagement')
  }

  if (
    helpLevelIndex(requestedLevel) >= helpLevelIndex('N4') &&
    context.attemptCount < rules.minimumAttemptsForDebug &&
    context.detectedErrors.length === 0
  ) {
    ceilings.push('N3')
    reasons.push('debug_requires_attempt')
  }

  const n5Allowed =
    rules.allowN5ForUnsolved ||
    (context.problemSolved && rules.allowN5WhenSolved) ||
    (context.isUpsolve && rules.allowN5DuringUpsolve)
  if (requestedLevel === 'N5' && !n5Allowed) {
    ceilings.push('N4')
    reasons.push('n5_requires_solved_or_upsolve')
  }

  if (context.directSolutionRequested) {
    reasons.push('direct_solution_protected')
  }
  if (context.evasionDetected) {
    reasons.push('evasion_protected')
  }
  if (context.previousDirectRequests > 0 && context.directSolutionRequested) {
    reasons.push('repeated_direct_request')
  }
  if (context.mastery < 0.35 && helpLevelIndex(requestedLevel) >= 2) {
    reasons.push('low_mastery_scaffold')
  }

  const selectedLevel = minimumLevel(ceilings)
  const protectionActivated =
    context.directSolutionRequested ||
    context.evasionDetected ||
    (requestedLevel === 'N5' && !n5Allowed)

  return {
    requestedLevel,
    selectedLevel,
    previousLevel: context.currentMaxHelpLevel ?? null,
    reasonCodes: uniqueReasons(reasons),
    explanation: explainDecision(selectedLevel, reasons, protectionActivated),
    protectionActivated,
    mayRevealCompleteSolution: selectedLevel === 'N5' && n5Allowed,
  }
}

function explainDecision(
  level: HelpLevel,
  reasons: readonly HelpReasonCode[],
  protectedRequest: boolean,
): string {
  if (protectedRequest) {
    return `Se entrega ${level}: la solicitud de solución se transforma en el siguiente apoyo permitido y se mantiene la progresión docente.`
  }
  if (reasons.includes('progressive_disclosure')) {
    return `Se entrega ${level} para avanzar exactamente un nivel respecto de la ayuda ya utilizada.`
  }
  if (reasons.includes('teacher_level_cap')) {
    return `Se entrega ${level}, que es el máximo permitido por la configuración docente.`
  }
  return `Se entrega ${level}, consistente con la intención y la evidencia de trabajo disponible.`
}

