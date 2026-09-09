import {
  helpLevelIndex,
  type HelpLevel,
  type SourceReference,
  type TutorEvidence,
  type TutorIntent,
} from '../domain'
import type { HelpDecision } from './helpPolicy'

export const TUTOR_RESPONSE_SCHEMA_VERSION = 1 as const

export interface TutorResponseContent {
  title: string
  explanation: string
  guidanceSteps: string[]
  reflectionQuestion: string
  pseudocodeSteps: string[] | null
  safetyNotice: string | null
}

export interface StructuredTutorResponse {
  schemaVersion: typeof TUTOR_RESPONSE_SCHEMA_VERSION
  responseId: string
  intent: TutorIntent
  helpLevel: HelpLevel
  grounded: boolean
  fallback: boolean
  content: TutorResponseContent
  sources: SourceReference[]
}

export interface TutorGenerationInput {
  responseId: string
  intent: TutorIntent
  problemTitle: string
  question: string
  decision: HelpDecision
  evidence: TutorEvidence[]
  evidenceSufficient: boolean
}

export interface TutorResponseValidation {
  valid: boolean
  errors: string[]
}

export interface TutorGenerator {
  generate(input: TutorGenerationInput): Promise<StructuredTutorResponse>
}

function compactText(value: string, maximumLength = 280): string {
  const compact = value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\b(?:int\s+main\s*\(|public\s+static\s+void\s+main\s*\()/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (compact.length <= maximumLength) return compact
  return `${compact.slice(0, maximumLength - 1).trimEnd()}…`
}

function uniqueSources(evidence: readonly TutorEvidence[]): SourceReference[] {
  const seen = new Set<string>()
  const sources: SourceReference[] = []
  for (const item of evidence) {
    const key = `${item.sourceId}\u0000${item.chunkId}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({
      sourceId: item.sourceId,
      chunkId: item.chunkId,
      title: item.title,
      ...(item.uri ? { uri: item.uri } : {}),
    })
  }
  return sources
}

function allowedEvidence(
  evidence: readonly TutorEvidence[],
  level: HelpLevel,
): TutorEvidence[] {
  return evidence.filter(
    (item) => helpLevelIndex(item.accessLevel) <= helpLevelIndex(level),
  )
}

function conceptName(evidence: readonly TutorEvidence[]): string {
  return evidence.flatMap((item) => item.concepts)[0] ?? 'el concepto principal'
}

function groundedContent(
  input: TutorGenerationInput,
  evidence: readonly TutorEvidence[],
): TutorResponseContent {
  const excerpt = compactText(evidence[0]?.excerpt ?? '')
  const concept = conceptName(evidence)
  const title = `${input.decision.selectedLevel} · ${input.problemTitle}`

  switch (input.decision.selectedLevel) {
    case 'N0':
      return {
        title,
        explanation:
          'Antes de elegir una técnica, delimitemos exactamente qué dato entra y qué resultado debe producirse.',
        guidanceSteps: [
          `Contrasta tu interpretación con esta evidencia: ${excerpt}`,
          'Expresa el objetivo en una sola oración, sin describir todavía el algoritmo.',
        ],
        reflectionQuestion:
          '¿Qué parte del enunciado —entrada, salida o restricción— necesitas precisar?',
        pseudocodeSteps: null,
        safetyNotice: null,
      }
    case 'N1':
      return {
        title,
        explanation:
          'Separa el problema en datos disponibles, resultado esperado y condición que debe mantenerse.',
        guidanceSteps: [
          `Evidencia recuperada: ${excerpt}`,
          'Prueba tu interpretación con el ejemplo más pequeño que puedas construir.',
        ],
        reflectionQuestion:
          '¿Qué relación observas entre los datos de entrada y el resultado esperado?',
        pseudocodeSteps: null,
        safetyNotice: null,
      }
    case 'N2':
      return {
        title,
        explanation: `El concepto que conviene revisar es ${concept}. La evidencia indica: ${excerpt}`,
        guidanceSteps: [
          'Define con tus palabras la propiedad central del concepto.',
          'Identifica qué restricción del problema permite aplicarla.',
        ],
        reflectionQuestion:
          '¿Qué condición tendría que cumplirse para que este concepto deje de ser aplicable?',
        pseudocodeSteps: null,
        safetyNotice: null,
      }
    case 'N3':
      return {
        title,
        explanation: `La observación estratégica se apoya en ${concept}: ${excerpt}`,
        guidanceSteps: [
          'Construye primero una solución manual para un caso mínimo.',
          'Anota qué información reutilizas entre un paso y el siguiente.',
          'Relaciona esa información con la complejidad exigida.',
        ],
        reflectionQuestion:
          '¿Qué estado mínimo necesitas conservar para no repetir trabajo?',
        pseudocodeSteps: null,
        safetyNotice: null,
      }
    case 'N4':
      return {
        title,
        explanation: `Usa esta guía para localizar el fallo sin sustituir tu implementación. Evidencia: ${excerpt}`,
        guidanceSteps: [
          'Traza tu estado después de cada iteración con un caso pequeño.',
          'Compara el primer estado divergente con la propiedad esperada.',
          'Corrige solo la transición responsable y vuelve a ejecutar el caso.',
        ],
        reflectionQuestion:
          '¿En qué primera transición tu estado deja de cumplir la propiedad esperada?',
        pseudocodeSteps: [
          'Inicializar únicamente el estado necesario.',
          'Recorrer los datos y actualizar el estado preservando la propiedad.',
          'Obtener el resultado desde el estado final.',
        ],
        safetyNotice:
          'El pseudocódigo es deliberadamente estructural: adapta cada paso a tu propio intento.',
      }
    case 'N5':
      return {
        title,
        explanation: `Como el problema está resuelto o en upsolve autorizado, se ofrece una explicación integral no ejecutable. Evidencia: ${excerpt}`,
        guidanceSteps: [
          `Justifica por qué ${concept} modela el problema.`,
          'Deriva el estado y cada transición desde las restricciones.',
          'Demuestra la corrección mediante la propiedad que se conserva.',
          'Calcula tiempo y memoria, y verifica los casos límite.',
        ],
        reflectionQuestion:
          '¿Puedes explicar por qué cada transición conserva la propiedad y cubre todos los casos?',
        pseudocodeSteps: [
          'Definir el estado y su significado matemático.',
          'Establecer el caso base.',
          'Aplicar transiciones válidas en orden.',
          'Extraer y validar la respuesta.',
        ],
        safetyNotice:
          'Se explica el procedimiento completo, pero no se entrega código listo para enviar.',
      }
  }
}

function fallbackContent(input: TutorGenerationInput): TutorResponseContent {
  return {
    title: `${input.decision.selectedLevel} · evidencia insuficiente`,
    explanation:
      'No encontré evidencia suficiente y compatible con el nivel de ayuda para responder de forma fundamentada.',
    guidanceSteps: [
      'Reformula la duda indicando el concepto o el punto exacto de bloqueo.',
      'Comparte el resultado observado de tu propio intento, sin datos personales.',
    ],
    reflectionQuestion:
      '¿Qué esperabas que ocurriera y qué ocurrió realmente en el primer caso que falla?',
    pseudocodeSteps: null,
    safetyNotice:
      'Se evita completar la solución cuando las fuentes recuperadas no bastan.',
  }
}

export class DeterministicTutorGenerator implements TutorGenerator {
  generate(input: TutorGenerationInput): Promise<StructuredTutorResponse> {
    const evidence = allowedEvidence(input.evidence, input.decision.selectedLevel)
    const grounded = input.evidenceSufficient && evidence.length > 0
    const response: StructuredTutorResponse = {
      schemaVersion: TUTOR_RESPONSE_SCHEMA_VERSION,
      responseId: input.responseId.trim(),
      intent: input.intent,
      helpLevel: input.decision.selectedLevel,
      grounded,
      fallback: !grounded,
      content: grounded
        ? groundedContent(input, evidence)
        : fallbackContent(input),
      sources: grounded ? uniqueSources(evidence) : [],
    }
    const validation = validateTutorResponse(response)
    if (!validation.valid) {
      return Promise.reject(
        new Error(`Invalid tutor response: ${validation.errors.join('; ')}`),
      )
    }
    return Promise.resolve(response)
  }
}

export function validateTutorResponse(
  value: unknown,
): TutorResponseValidation {
  const errors: string[] = []
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['response must be an object'] }
  }
  const response = value as Partial<StructuredTutorResponse>
  if (response.schemaVersion !== TUTOR_RESPONSE_SCHEMA_VERSION) {
    errors.push('unsupported schemaVersion')
  }
  if (typeof response.responseId !== 'string' || !response.responseId.trim()) {
    errors.push('responseId is required')
  }
  if (!response.helpLevel) errors.push('helpLevel is required')
  if (typeof response.grounded !== 'boolean') errors.push('grounded is required')
  if (typeof response.fallback !== 'boolean') errors.push('fallback is required')
  if (!response.content) {
    errors.push('content is required')
  } else {
    if (!response.content.title.trim()) errors.push('content.title is required')
    if (!response.content.explanation.trim()) {
      errors.push('content.explanation is required')
    }
    if (response.content.guidanceSteps.length === 0) {
      errors.push('at least one guidance step is required')
    }
    if (!response.content.reflectionQuestion.trim()) {
      errors.push('content.reflectionQuestion is required')
    }
  }
  if (!Array.isArray(response.sources)) {
    errors.push('sources must be an array')
  } else if (response.grounded && response.sources.length === 0) {
    errors.push('grounded responses require sources')
  } else if (!response.grounded && response.sources.length > 0) {
    errors.push('ungrounded responses cannot claim sources')
  }
  return { valid: errors.length === 0, errors }
}

export function renderTutorResponse(response: StructuredTutorResponse): string {
  const lines = [
    response.content.title,
    response.content.explanation,
    ...response.content.guidanceSteps.map((step, index) => `${index + 1}. ${step}`),
  ]
  if (response.content.pseudocodeSteps) {
    lines.push(
      ...response.content.pseudocodeSteps.map(
        (step, index) => `P${index + 1}. ${step}`,
      ),
    )
  }
  lines.push(response.content.reflectionQuestion)
  if (response.content.safetyNotice) lines.push(response.content.safetyNotice)
  return lines.join('\n')
}

