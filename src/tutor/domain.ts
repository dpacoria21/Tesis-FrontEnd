export const HELP_LEVELS = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5'] as const

export type HelpLevel = (typeof HELP_LEVELS)[number]

export const TUTOR_INTENTS = [
  'clarify',
  'understand',
  'concept',
  'strategy',
  'debug',
  'solution',
  'recommendation',
] as const

export type TutorIntent = (typeof TUTOR_INTENTS)[number]

export const ERROR_CATEGORIES = [
  'comprehension',
  'concept',
  'strategy',
  'complexity',
  'implementation',
  'edge_case',
  'syntax_execution',
] as const

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number]

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  comprehension: 'Comprensión',
  concept: 'Concepto',
  strategy: 'Estrategia',
  complexity: 'Complejidad',
  implementation: 'Implementación',
  edge_case: 'Caso límite',
  syntax_execution: 'Sintaxis o ejecución',
}

export interface SourceReference {
  sourceId: string
  chunkId: string
  title: string
  uri?: string
}

export interface TutorEvidence extends SourceReference {
  excerpt: string
  concepts: string[]
  accessLevel: HelpLevel
}

export interface ProblemCandidate {
  id: string
  title: string
  difficulty: number
  tags: string[]
  prerequisites: string[]
  sourceId?: string
}

export function helpLevelIndex(level: HelpLevel): number {
  return HELP_LEVELS.indexOf(level)
}

export function helpLevelAt(index: number): HelpLevel {
  const bounded = Math.max(0, Math.min(HELP_LEVELS.length - 1, index))
  return HELP_LEVELS[bounded]
}

export function isHelpLevel(value: unknown): value is HelpLevel {
  return typeof value === 'string' && HELP_LEVELS.includes(value as HelpLevel)
}

export function isErrorCategory(value: unknown): value is ErrorCategory {
  return (
    typeof value === 'string' &&
    ERROR_CATEGORIES.includes(value as ErrorCategory)
  )
}

