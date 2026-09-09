import type { CorpusSnapshot } from '../corpus/ingest'
import { stableDigest } from '../corpus/schema'
import {
  helpLevelIndex,
  type HelpLevel,
  type ProblemCandidate,
  type TutorEvidence,
} from '../domain'
import {
  analyzeAttemptAndUpdateStudent,
  type AttemptAnalysisInput,
} from '../feedback/analyzeAttempt'
import {
  DeterministicTutorGenerator,
  renderTutorResponse,
  validateTutorResponse,
  type StructuredTutorResponse,
  type TutorGenerationInput,
  type TutorGenerator,
} from '../pedagogy/generator'
import {
  decideHelpLevel,
  DEFAULT_TEACHER_HELP_RULES,
  type TeacherHelpRules,
} from '../pedagogy/helpPolicy'
import {
  detectPreGenerationLeakage,
  guardGeneratedText,
} from '../pedagogy/leakageGuard'
import {
  recommendNextAndUpdateStudent,
} from '../recommendation/recommendNext'
import {
  type PedagogicalAccessLevel,
} from '../corpus/schema'
import {
  type RetrievalSuite,
} from '../retrieval'
import {
  createPedagogicalEvent,
  type ProtectionAction,
  type ProtectionSignal,
} from '../student/events'
import { recordHelpUsage } from '../student/model'
import { LocalTutorRepository } from '../student/repository'
import { inferTutorIntent } from './intent'
import type {
  AskTutorInput,
  AskTutorResult,
  RecommendationResult,
  SubmitTutorAttemptInput,
  SubmitTutorAttemptResult,
  TutorApi,
  TutorProblemSummary,
  TutorServiceConfiguration,
  TutorSystemInfo,
} from './types'

export interface TutorServiceDependencies {
  snapshot: CorpusSnapshot
  retrieval: RetrievalSuite
  repository?: LocalTutorRepository
  generator?: TutorGenerator
  teacherRules?: TeacherHelpRules
  clock?: () => string
  monotonicNow?: () => number
  idFactory?: (kind: 'response' | 'event' | 'attempt', payload: unknown) => string
}

const DEFAULT_CONFIGURATION: TutorServiceConfiguration = {
  teacherRules: DEFAULT_TEACHER_HELP_RULES,
  retrievalLimit: 5,
  implementationLabel: 'hybrid_rrf_filtered + deterministic_local_generator',
}

function averageMastery(values: Readonly<Record<string, number>>): number {
  const numbers = Object.values(values)
  if (numbers.length === 0) return 0.3
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function allowedAccessLevels(level: HelpLevel): PedagogicalAccessLevel[] {
  if (level === 'N5') return ['safe', 'guided', 'solution']
  if (helpLevelIndex(level) >= helpLevelIndex('N3')) return ['safe', 'guided']
  return ['safe']
}

function evidenceAccessLevel(level: PedagogicalAccessLevel): HelpLevel {
  if (level === 'solution') return 'N5'
  if (level === 'guided') return 'N3'
  return 'N0'
}

function cloneRules(rules: TeacherHelpRules): TeacherHelpRules {
  return { ...rules }
}

function protectedResponse(
  response: StructuredTutorResponse,
  safeText: string,
  action: 'reduced' | 'blocked',
): StructuredTutorResponse {
  return {
    ...response,
    fallback: false,
    content: {
      title: `${response.helpLevel} · salida protegida`,
      explanation: safeText,
      guidanceSteps: [
        'Describe el primer estado de tu intento que difiere de lo esperado.',
        'Solicita una pista localizada sobre ese estado, no un programa para copiar.',
      ],
      reflectionQuestion:
        '¿Qué propiedad debería cumplirse justo antes del primer fallo?',
      pseudocodeSteps: null,
      safetyNotice:
        action === 'blocked'
          ? 'La salida se bloqueó porque contenía una solución ejecutable o un artefacto protegido.'
          : 'La salida se redujo para respetar el nivel de ayuda permitido.',
    },
  }
}

function mapEvidence(
  items: AskTutorResult['retrieval']['items'],
): TutorEvidence[] {
  return items.map((item) => ({
    sourceId: item.source.externalId,
    chunkId: item.documentId,
    title: item.metadata.title,
    ...(item.source.url ? { uri: item.source.url } : {}),
    excerpt: item.fragment,
    concepts: [...new Set([...item.metadata.topics, ...item.metadata.tags])],
    accessLevel: evidenceAccessLevel(item.metadata.accessLevel),
  }))
}

export class TutorService implements TutorApi {
  private readonly repository: LocalTutorRepository
  private readonly generator: TutorGenerator
  private readonly clock: () => string
  private readonly monotonicNow: () => number
  private readonly idFactory: TutorServiceDependencies['idFactory']
  private readonly configuration: TutorServiceConfiguration
  private sequence = 0

  constructor(private readonly dependencies: TutorServiceDependencies) {
    this.repository = dependencies.repository ?? new LocalTutorRepository()
    this.generator = dependencies.generator ?? new DeterministicTutorGenerator()
    this.clock = dependencies.clock ?? (() => new Date().toISOString())
    this.monotonicNow = dependencies.monotonicNow ?? (() => performance.now())
    this.configuration = {
      ...DEFAULT_CONFIGURATION,
      teacherRules: cloneRules(dependencies.teacherRules ?? DEFAULT_TEACHER_HELP_RULES),
    }
    this.idFactory = dependencies.idFactory
  }

  getSystemInfo(): TutorSystemInfo {
    const descriptor = this.dependencies.retrieval.denseIndex.embedding
    return {
      mode: 'deterministic_local_demo',
      corpusId: this.dependencies.retrieval.corpus.corpusId,
      corpusVersion: this.dependencies.retrieval.corpus.corpusVersion,
      corpusDigest: this.dependencies.retrieval.corpus.corpusDigest,
      documentCount: this.dependencies.snapshot.documents.length,
      chunkCount: this.dependencies.retrieval.corpus.chunks.length,
      embeddingLabel: `${descriptor.providerId}/${descriptor.modelId}@${descriptor.modelVersion} · ${descriptor.dimensions}d`,
    }
  }

  listProblems(): TutorProblemSummary[] {
    return this.dependencies.snapshot.documents
      .map((document) => ({
        id: document.id,
        title: document.title,
        statement: document.statement,
        rating: document.rating,
        difficulty: document.difficulty,
        tags: [...document.tags],
        topics: [...document.topics],
        concepts: [...document.concepts],
        prerequisites: [...document.prerequisites],
        sourceLabel: `${document.source.provider} · ${document.source.license}`,
        synthetic: document.source.synthetic,
      }))
      .sort((left, right) => left.rating - right.rating || left.id.localeCompare(right.id))
  }

  getStudent(studentId: string) {
    return this.repository.getOrCreateStudent(studentId)
  }

  listEvents(studentId: string) {
    return this.repository.listPedagogicalEvents(studentId)
  }

  async ask(input: AskTutorInput): Promise<AskTutorResult> {
    const startedAt = this.monotonicNow()
    const occurredAt = input.occurredAt ?? this.clock()
    const student = this.repository.getOrCreateStudent(input.studentId)
    const previousDirectRequests =
      student.directSolutionRequestsByProblem[input.problemId] ?? 0
    const preGenerationGuard = detectPreGenerationLeakage(
      input.question,
      previousDirectRequests,
    )
    const inferredIntent = input.intent ?? inferTutorIntent(input.question)
    const intent = preGenerationGuard.directSolutionRequested
      ? 'solution'
      : inferredIntent
    const problemAttempts = student.attempts.filter(
      (attempt) => attempt.problemId === input.problemId,
    )
    const detectedErrors = student.detectedErrors
      .filter((error) => error.problemId === input.problemId)
      .map((error) => error.category)
    const decision = decideHelpLevel(
      {
        intent,
        ...(input.requestedLevel ? { requestedLevel: input.requestedLevel } : {}),
        currentMaxHelpLevel: student.maxHelpLevelByProblem[input.problemId],
        attemptCount: problemAttempts.length,
        minutesBlocked: input.minutesBlocked ?? 0,
        mastery: averageMastery(student.masteryByConcept),
        detectedErrors,
        directSolutionRequested: preGenerationGuard.directSolutionRequested,
        evasionDetected: preGenerationGuard.evasionDetected,
        previousDirectRequests,
        problemSolved: student.solvedProblemIds.includes(input.problemId),
        isUpsolve: input.isUpsolve ?? false,
      },
      this.configuration.teacherRules,
    )

    const retrieval = this.dependencies.retrieval.retrieve(
      'hybrid_rrf_filtered',
      {
        query: input.question,
        limit: this.configuration.retrievalLimit,
        filters: {
          languages: ['es'],
          problemIds: [input.problemId],
          accessLevels: allowedAccessLevels(decision.selectedLevel),
        },
      },
    )
    const evidence = mapEvidence(retrieval.items)
    const problem = this.dependencies.snapshot.documents.find(
      (document) => document.id === input.problemId,
    )
    const responseId = this.makeId('response', {
      studentId: input.studentId,
      problemId: input.problemId,
      question: input.question,
      occurredAt,
    })
    const generationInput: TutorGenerationInput = {
      responseId,
      intent,
      problemTitle: problem?.title ?? 'problema no identificado',
      question: input.question,
      decision,
      evidence,
      evidenceSufficient: evidence.length > 0,
    }

    let generated: StructuredTutorResponse
    let regenerated = false
    try {
      generated = await this.generator.generate(generationInput)
      if (!validateTutorResponse(generated).valid) {
        regenerated = true
        generated = await new DeterministicTutorGenerator().generate(generationInput)
      }
    } catch {
      regenerated = true
      generated = await new DeterministicTutorGenerator().generate(generationInput)
    }

    const guarded = guardGeneratedText({
      text: renderTutorResponse(generated),
      selectedLevel: decision.selectedLevel,
      allowExecutableSolution: false,
      protectedArtifacts: problem ? [problem.editorial] : [],
    })
    const response = guarded.action === 'none'
      ? generated
      : protectedResponse(generated, guarded.text, guarded.action)
    const finalValidation = validateTutorResponse(response)
    if (!finalValidation.valid) {
      throw new Error(`Tutor response failed final validation: ${finalValidation.errors.join('; ')}`)
    }

    const nextStudent = recordHelpUsage(student, {
      problemId: input.problemId,
      level: decision.selectedLevel,
      occurredAt,
      directSolutionRequest: preGenerationGuard.directSolutionRequested,
    })
    const persistedStudent = this.repository.saveStudent(nextStudent)
    const protectionSignals: ProtectionSignal[] = []
    if (preGenerationGuard.directSolutionRequested) protectionSignals.push('direct_solution_request')
    if (preGenerationGuard.evasionDetected) protectionSignals.push('evasion_attempt')
    if (preGenerationGuard.repeatedDirectRequest) protectionSignals.push('repeated_direct_request')
    if (guarded.assessment.leaksSolution) protectionSignals.push('post_generation_leakage')
    if (response.fallback) protectionSignals.push('insufficient_evidence')
    let protectionAction: ProtectionAction = 'none'
    if (response.fallback) protectionAction = 'fallback'
    else if (guarded.action === 'blocked') protectionAction = 'blocked'
    else if (guarded.action === 'reduced') protectionAction = 'reduced'
    else if (regenerated) protectionAction = 'regenerated'
    else if (preGenerationGuard.directSolutionRequested) protectionAction = 'blocked'

    const event = createPedagogicalEvent({
      eventId: this.makeId('event', { responseId, occurredAt }),
      responseId,
      studentId: input.studentId,
      problemId: input.problemId,
      occurredAt,
      intent,
      selectedHelpLevel: decision.selectedLevel,
      reasonCodes: decision.reasonCodes,
      sources: response.sources,
      protection: { signals: protectionSignals, action: protectionAction },
      evidenceSufficient: response.grounded,
      latencyMs: Math.max(0, this.monotonicNow() - startedAt),
    })
    this.repository.appendPedagogicalEvent(event)

    return {
      response,
      decision,
      retrieval,
      preGenerationGuard,
      postGenerationGuard: guarded.assessment,
      event,
      student: persistedStudent,
    }
  }

  submitAttempt(input: SubmitTutorAttemptInput): SubmitTutorAttemptResult {
    const occurredAt = input.occurredAt ?? this.clock()
    const problem = this.dependencies.snapshot.documents.find(
      (document) => document.id === input.problemId,
    )
    const attemptId = input.attemptId ?? this.makeId('attempt', {
      studentId: input.studentId,
      problemId: input.problemId,
      occurredAt,
    })
    const analysisInput: AttemptAnalysisInput = {
      attemptId,
      problemId: input.problemId,
      occurredAt,
      outcome: input.outcome,
      durationMs: input.durationMs,
      conceptIds: problem?.concepts ?? [],
      helpLevelUsed: input.helpLevelUsed,
      ...(input.code ? { code: input.code } : {}),
      ...(input.studentGoal ? { studentGoal: input.studentGoal } : {}),
      ...(input.expectedGoal ? { expectedGoal: input.expectedGoal } : {}),
      ...(input.missingConcepts ? { missingConcepts: input.missingConcepts } : {}),
      ...(input.strategyIssue ? { strategyIssue: input.strategyIssue } : {}),
      ...(input.complexityIssue ? { complexityIssue: input.complexityIssue } : {}),
      ...(input.implementationIssue ? { implementationIssue: input.implementationIssue } : {}),
      ...(input.suspectedLine ? { suspectedLine: input.suspectedLine } : {}),
      ...(input.compilerMessage ? { compilerMessage: input.compilerMessage } : {}),
      ...(input.runtimeMessage ? { runtimeMessage: input.runtimeMessage } : {}),
      ...(input.failedTests ? { failedTests: input.failedTests } : {}),
    }
    const transition = analyzeAttemptAndUpdateStudent(
      this.repository.getOrCreateStudent(input.studentId),
      analysisInput,
    )
    const persisted = this.repository.saveStudent(transition.state)
    return {
      feedback: transition.feedback,
      student: persisted,
      inserted: transition.inserted,
    }
  }

  recommend(studentId: string, recommendedAt = this.clock()): RecommendationResult {
    const candidates: ProblemCandidate[] = this.dependencies.snapshot.documents.map(
      (document) => ({
        id: document.id,
        title: document.title,
        difficulty: document.rating,
        tags: [...document.tags, ...document.concepts],
        prerequisites: [...document.prerequisites],
        sourceId: document.source.externalId,
      }),
    )
    const transition = recommendNextAndUpdateStudent(
      candidates,
      this.repository.getOrCreateStudent(studentId),
      recommendedAt,
      { targetDifficulty: 900, maximumDifficultyDistance: 600 },
    )
    const persisted = transition.recommendation
      ? this.repository.saveStudent(transition.state)
      : transition.state
    return { recommendation: transition.recommendation, student: persisted }
  }

  private makeId(
    kind: 'response' | 'event' | 'attempt',
    payload: unknown,
  ): string {
    if (this.idFactory) return this.idFactory(kind, payload)
    this.sequence += 1
    return `${kind}_${stableDigest({ payload, sequence: this.sequence })}`
  }
}
