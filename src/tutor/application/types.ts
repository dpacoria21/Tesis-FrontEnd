import type { BenchmarkCategory } from '../benchmark/cases'
import type {
  ErrorCategory,
  HelpLevel,
  TutorIntent,
} from '../domain'
import type {
  AttemptFeedback,
  FailedTestObservation,
} from '../feedback/analyzeAttempt'
import type {
  HelpDecision,
  TeacherHelpRules,
} from '../pedagogy/helpPolicy'
import type {
  PostGenerationAssessment,
  PreGenerationAssessment,
} from '../pedagogy/leakageGuard'
import type { StructuredTutorResponse } from '../pedagogy/generator'
import type { ExplainedRecommendation } from '../recommendation/recommendNext'
import type { RetrievalResponse } from '../retrieval'
import type { PedagogicalEvent } from '../student/events'
import type {
  AttemptOutcome,
  StudentState,
} from '../student/model'

export interface TutorProblemSummary {
  id: string
  title: string
  statement: string
  rating: number
  difficulty: string
  tags: string[]
  topics: string[]
  concepts: string[]
  prerequisites: string[]
  sourceLabel: string
  synthetic: boolean
}

export interface TutorSystemInfo {
  mode: 'deterministic_local_demo'
  corpusId: string
  corpusVersion: string
  corpusDigest: string
  documentCount: number
  chunkCount: number
  embeddingLabel: string
}

export interface AskTutorInput {
  studentId: string
  problemId: string
  question: string
  intent?: TutorIntent
  requestedLevel?: HelpLevel
  minutesBlocked?: number
  isUpsolve?: boolean
  occurredAt?: string
}

export interface AskTutorResult {
  response: StructuredTutorResponse
  decision: HelpDecision
  retrieval: RetrievalResponse
  preGenerationGuard: PreGenerationAssessment
  postGenerationGuard: PostGenerationAssessment
  event: PedagogicalEvent
  student: StudentState
}

export interface SubmitTutorAttemptInput {
  studentId: string
  problemId: string
  attemptId?: string
  occurredAt?: string
  outcome: AttemptOutcome
  durationMs: number
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

export interface SubmitTutorAttemptResult {
  feedback: AttemptFeedback
  student: StudentState
  inserted: boolean
}

export interface RecommendationResult {
  recommendation: ExplainedRecommendation | null
  student: StudentState
}

export interface TutorApi {
  getSystemInfo(): TutorSystemInfo
  listProblems(): TutorProblemSummary[]
  getStudent(studentId: string): StudentState
  listEvents(studentId: string): PedagogicalEvent[]
  ask(input: AskTutorInput): Promise<AskTutorResult>
  submitAttempt(input: SubmitTutorAttemptInput): SubmitTutorAttemptResult
  recommend(studentId: string, recommendedAt?: string): RecommendationResult
}

export interface TutorServiceConfiguration {
  teacherRules: TeacherHelpRules
  retrievalLimit: number
  implementationLabel: string
}

/** Reserved for report grouping; it does not alter runtime behavior. */
export interface DemonstrationScenarioTag {
  benchmarkCategory?: BenchmarkCategory
  expectedError?: ErrorCategory
}
