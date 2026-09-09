import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
  type ErrorCategory,
  type HelpLevel,
} from '../domain'
import {
  recordAttempt,
  type AttemptOutcome,
  type StudentState,
} from '../student/model'

export interface FailedTestObservation {
  name: string
  kind: 'regular' | 'edge_case'
  observation?: string
}

export interface AttemptAnalysisInput {
  attemptId: string
  problemId: string
  occurredAt: string
  outcome: AttemptOutcome
  durationMs: number
  conceptIds: string[]
  helpLevelUsed: HelpLevel
  code?: string
  studentGoal?: string
  expectedGoal?: string
  missingConcepts?: string[]
  strategyIssue?: string
  complexityIssue?: string
  implementationIssue?: string
  suspectedLine?: number
  compilerMessage?: string
  runtimeMessage?: string
  failedTests?: FailedTestObservation[]
}

export interface FeedbackLocation {
  kind: 'interpretation' | 'concept' | 'design' | 'complexity' | 'line' | 'test' | 'execution'
  value: string
}

export interface FeedbackFinding {
  category: ErrorCategory
  label: string
  confidence: 'high' | 'medium' | 'low'
  location: FeedbackLocation
  message: string
  nextStep: string
}

export interface AttemptFeedback {
  attemptId: string
  problemId: string
  primaryCategory: ErrorCategory | null
  findings: FeedbackFinding[]
  summary: string
  replacementCode: null
}

export interface FeedbackStateTransition {
  feedback: AttemptFeedback
  state: StudentState
  inserted: boolean
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extractLine(message: string | undefined): number | null {
  if (!message) return null
  const match = /(?:linea|line)\s*[:#]?\s*(\d+)/i.exec(message)
  return match ? Number(match[1]) : null
}

function finding(
  category: ErrorCategory,
  confidence: FeedbackFinding['confidence'],
  location: FeedbackLocation,
  message: string,
  nextStep: string,
): FeedbackFinding {
  return {
    category,
    label: ERROR_CATEGORY_LABELS[category],
    confidence,
    location,
    message,
    nextStep,
  }
}

export function analyzeAttempt(input: AttemptAnalysisInput): AttemptFeedback {
  const byCategory = new Map<ErrorCategory, FeedbackFinding>()
  const studentGoal = normalize(input.studentGoal ?? '')
  const expectedGoal = normalize(input.expectedGoal ?? '')

  if (studentGoal && expectedGoal && studentGoal !== expectedGoal) {
    byCategory.set(
      'comprehension',
      finding(
        'comprehension',
        'high',
        { kind: 'interpretation', value: 'objetivo del problema' },
        'La interpretación declarada no coincide con el objetivo esperado.',
        'Reescribe qué debe producirse para una entrada mínima antes de modificar el algoritmo.',
      ),
    )
  }

  const missingConcepts = (input.missingConcepts ?? [])
    .map((concept) => concept.trim())
    .filter(Boolean)
  if (missingConcepts.length > 0) {
    byCategory.set(
      'concept',
      finding(
        'concept',
        'high',
        { kind: 'concept', value: missingConcepts.join(', ') },
        `Falta justificar el uso de: ${missingConcepts.join(', ')}.`,
        'Repasa la propiedad del concepto y comprueba qué restricción permite utilizarla.',
      ),
    )
  }

  if (input.strategyIssue?.trim()) {
    byCategory.set(
      'strategy',
      finding(
        'strategy',
        'high',
        { kind: 'design', value: 'estrategia propuesta' },
        'La estrategia no conecta todavía el estado con el objetivo del problema.',
        'Traza un caso mínimo y anota qué información debe conservarse entre pasos.',
      ),
    )
  }

  if (input.complexityIssue?.trim()) {
    byCategory.set(
      'complexity',
      finding(
        'complexity',
        'high',
        { kind: 'complexity', value: input.complexityIssue.trim() },
        'La complejidad observada no es compatible con las restricciones.',
        'Cuenta cuántas veces se procesa cada elemento e identifica el trabajo repetido.',
      ),
    )
  }

  const regularFailure = (input.failedTests ?? []).find(
    (test) => test.kind === 'regular',
  )
  if (input.implementationIssue?.trim() || regularFailure) {
    const line = input.suspectedLine
    byCategory.set(
      'implementation',
      finding(
        'implementation',
        input.implementationIssue ? 'high' : 'medium',
        line
          ? { kind: 'line', value: String(line) }
          : {
              kind: 'test',
              value: regularFailure?.name ?? 'primer caso divergente',
            },
        'La idea puede ser válida, pero una transición produce un estado distinto del esperado.',
        'Compara el estado esperado y el obtenido en la primera transición divergente.',
      ),
    )
  }

  const edgeFailure = (input.failedTests ?? []).find(
    (test) => test.kind === 'edge_case',
  )
  if (edgeFailure) {
    byCategory.set(
      'edge_case',
      finding(
        'edge_case',
        'high',
        { kind: 'test', value: edgeFailure.name },
        'El intento falla en una frontera específica del dominio.',
        'Aísla ese caso y revisa inicialización, índices, vacío, duplicados o límites numéricos.',
      ),
    )
  }

  const executionMessage = input.compilerMessage ?? input.runtimeMessage
  if (executionMessage?.trim()) {
    const line = extractLine(executionMessage)
    byCategory.set(
      'syntax_execution',
      finding(
        'syntax_execution',
        'high',
        line
          ? { kind: 'line', value: String(line) }
          : { kind: 'execution', value: input.compilerMessage ? 'compilación' : 'ejecución' },
        input.compilerMessage
          ? 'El programa no alcanza la ejecución por un error de compilación localizado.'
          : 'La ejecución se interrumpe antes de producir una salida válida.',
        line
          ? `Inspecciona los tipos, delimitadores y accesos alrededor de la línea ${line}.`
          : 'Reduce el caso de entrada y localiza la primera operación que interrumpe la ejecución.',
      ),
    )
  }

  if (byCategory.size === 0 && input.outcome !== 'solved') {
    byCategory.set(
      'implementation',
      finding(
        'implementation',
        'low',
        { kind: 'test', value: 'evidencia pendiente' },
        'El intento no fue aceptado, pero la evidencia disponible no permite localizar una causa más específica.',
        'Añade el primer caso que falla y los estados intermedios esperados y observados.',
      ),
    )
  }

  const findings = ERROR_CATEGORIES.flatMap((category) => {
    const item = byCategory.get(category)
    return item ? [item] : []
  })
  return {
    attemptId: input.attemptId,
    problemId: input.problemId,
    primaryCategory: findings[0]?.category ?? null,
    findings,
    summary:
      findings.length === 0
        ? 'No se detectaron errores con la evidencia proporcionada.'
        : `Se localizaron ${findings.length} categoría(s): ${findings.map((item) => item.label).join(', ')}.`,
    replacementCode: null,
  }
}

function fingerprintCode(code: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function analyzeAttemptAndUpdateStudent(
  state: StudentState,
  input: AttemptAnalysisInput,
): FeedbackStateTransition {
  const feedback = analyzeAttempt(input)
  const transition = recordAttempt(state, {
    attemptId: input.attemptId,
    problemId: input.problemId,
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    durationMs: input.durationMs,
    conceptIds: input.conceptIds,
    errors: feedback.findings.map((item) => item.category),
    helpLevelUsed: input.helpLevelUsed,
    ...(input.code
      ? {
          codeFingerprint: fingerprintCode(input.code),
          codeSizeChars: input.code.length,
        }
      : {}),
  })
  return {
    feedback,
    state: transition.state,
    inserted: transition.inserted,
  }
}

