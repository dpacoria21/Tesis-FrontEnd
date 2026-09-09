import { helpLevelIndex, type HelpLevel } from '../domain'

export const PRE_GENERATION_SIGNALS = [
  'direct_code_request',
  'complete_solution_request',
  'answer_only_request',
  'instruction_bypass',
  'role_evasion',
  'encoding_evasion',
] as const

export type PreGenerationSignal = (typeof PRE_GENERATION_SIGNALS)[number]

export interface PreGenerationAssessment {
  directSolutionRequested: boolean
  evasionDetected: boolean
  repeatedDirectRequest: boolean
  risk: 'none' | 'medium' | 'high'
  signals: PreGenerationSignal[]
}

export const POST_GENERATION_SIGNALS = [
  'executable_code_block',
  'program_entrypoint',
  'verbatim_protected_artifact',
  'code_above_allowed_level',
] as const

export type PostGenerationSignal = (typeof POST_GENERATION_SIGNALS)[number]

export interface PostGenerationAssessment {
  leaksSolution: boolean
  signals: PostGenerationSignal[]
  action: 'allow' | 'reduce' | 'block'
}

export interface PostGenerationInput {
  text: string
  selectedLevel: HelpLevel
  allowExecutableSolution?: boolean
  protectedArtifacts?: string[]
}

export interface GuardedText {
  text: string
  action: 'none' | 'reduced' | 'blocked'
  assessment: PostGenerationAssessment
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value))
}

export function detectPreGenerationLeakage(
  request: string,
  previousDirectRequests = 0,
): PreGenerationAssessment {
  const value = normalize(request)
  const signals: PreGenerationSignal[] = []

  const codeRequest = matchesAny(value, [
    /\b(dame|pasame|escribe|genera|entrega|muestra)\b.{0,30}\b(codigo|programa|implementacion)\b/,
    /\b(write|give|show|send)\b.{0,24}\b(code|program|implementation)\b/,
    /\b(codigo|code)\b.{0,20}\b(completo|final|entero|full|ready)\b/,
    /\b(lineas?|pasos?)\b.{0,32}\b(exactas?|copiar|copy|peg(ar|ar)?|paste)\b/,
  ])
  if (codeRequest) signals.push('direct_code_request')

  const solutionRequest = matchesAny(value, [
    /\b(dame|entrega|muestra|escribe|pasame)\b.{0,32}\b(solucion|respuesta)\b/,
    /\b(give|show|write|send)\b.{0,32}\b(solution|answer)\b/,
    /\b(solucion|respuesta)\b.{0,20}\b(completa|final|directa|exacta)\b/,
    /\b(complete|full|final|exact)\b.{0,20}\b(solution|answer)\b/,
    /\bresuelv(e|elo|eme)\b/,
    /\bsolve (it|this|the problem)\b/,
  ])
  if (solutionRequest) signals.push('complete_solution_request')

  if (
    matchesAny(value, [
      /\bsolo (el )?(codigo|respuesta)\b/,
      /\bsin (explicacion|explicar)\b/,
      /\b(answer|code) only\b/,
    ])
  ) {
    signals.push('answer_only_request')
  }

  if (
    matchesAny(value, [
      /\bignora (las|tus|todas las|cualquier) (reglas|instrucciones|restricciones)\b/,
      /\bomite (las|tus) (reglas|restricciones)\b/,
      /\bignore (all |your )?(rules|instructions|restrictions)\b/,
    ])
  ) {
    signals.push('instruction_bypass')
  }

  if (
    matchesAny(value, [
      /\b(actua|finge|simula) como\b.{0,32}\b(compilador|concursante|solucionador)\b/,
      /\b(actua|finge|simula) como\b.{0,32}\b(juez|judge)\b/,
      /\b(roleplay|pretend|act as)\b.{0,32}\b(compiler|contestant|solver|judge)\b/,
      /\bhipoteticamente\b/,
    ])
  ) {
    signals.push('role_evasion')
  }

  if (
    matchesAny(value, [
      /\b(base64|rot13|hexadecimal)\b/,
      /\b(codifica|encode|cifra)\b.{0,24}\b(codigo|solucion|code|solution)\b/,
    ])
  ) {
    signals.push('encoding_evasion')
  }

  const directSolutionRequested =
    codeRequest ||
    solutionRequest ||
    signals.includes('answer_only_request')
  const evasionDetected = signals.some((signal) =>
    ['instruction_bypass', 'role_evasion', 'encoding_evasion'].includes(signal),
  )
  const repeatedDirectRequest = directSolutionRequested && previousDirectRequests > 0
  const risk =
    evasionDetected || repeatedDirectRequest
      ? 'high'
      : directSolutionRequested
        ? 'medium'
        : 'none'

  return {
    directSolutionRequested,
    evasionDetected,
    repeatedDirectRequest,
    risk,
    signals: [...new Set(signals)],
  }
}

function hasExecutableCodeBlock(text: string): boolean {
  return /```(?:c\+\+|cpp|c|java|python|py|javascript|typescript|js|ts)\s+[\s\S]*?```/i.test(
    text,
  )
}

function hasProgramEntrypoint(text: string): boolean {
  return /\b(?:int\s+main\s*\(|public\s+static\s+void\s+main\s*\(|if\s+__name__\s*==\s*['"]__main__['"]|function\s+main\s*\()/i.test(
    text,
  )
}

export function inspectGeneratedText(
  input: PostGenerationInput,
): PostGenerationAssessment {
  const signals: PostGenerationSignal[] = []
  const executableBlock = hasExecutableCodeBlock(input.text)
  const entrypoint = hasProgramEntrypoint(input.text)
  if (executableBlock) signals.push('executable_code_block')
  if (entrypoint) signals.push('program_entrypoint')

  const normalizedText = normalize(input.text)
  const containsProtectedArtifact = (input.protectedArtifacts ?? []).some(
    (artifact) => {
      const normalizedArtifact = normalize(artifact)
      return normalizedArtifact.length >= 20 && normalizedText.includes(normalizedArtifact)
    },
  )
  if (containsProtectedArtifact) signals.push('verbatim_protected_artifact')

  if (
    helpLevelIndex(input.selectedLevel) <= helpLevelIndex('N3') &&
    /```[\s\S]*?```/.test(input.text)
  ) {
    signals.push('code_above_allowed_level')
  }

  const leaksSolution =
    containsProtectedArtifact ||
    (!input.allowExecutableSolution && (executableBlock || entrypoint)) ||
    signals.includes('code_above_allowed_level')
  const severe = containsProtectedArtifact || (executableBlock && entrypoint)
  return {
    leaksSolution,
    signals: [...new Set(signals)],
    action: leaksSolution ? (severe ? 'block' : 'reduce') : 'allow',
  }
}

export function guardGeneratedText(input: PostGenerationInput): GuardedText {
  const assessment = inspectGeneratedText(input)
  if (!assessment.leaksSolution) {
    return { text: input.text, action: 'none', assessment }
  }

  let reduced = input.text
    .replace(/```[\s\S]*?```/g, '[fragmento omitido por la política de ayuda]')
    .split('\n')
    .filter(
      (line) =>
        !/\b(?:int\s+main\s*\(|public\s+static\s+void\s+main|if\s+__name__|#include\b|using\s+namespace\b)/i.test(
          line,
        ),
    )
    .join('\n')
    .trim()

  for (const artifact of input.protectedArtifacts ?? []) {
    if (artifact.length >= 20) reduced = reduced.replaceAll(artifact, '')
  }
  reduced = reduced.trim()

  if (!reduced || assessment.action === 'block') {
    return {
      text: 'No puedo entregar una solución ejecutable en este nivel. Puedo ayudarte a identificar el siguiente paso y revisar tu propio intento.',
      action: 'blocked',
      assessment,
    }
  }
  return { text: reduced, action: 'reduced', assessment }
}
