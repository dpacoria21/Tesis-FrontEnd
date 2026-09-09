export type ProblemId = string

export type RecommendationSlot = 'recovery' | 'target' | 'stretch'

export type ProblemProgressStatus =
  | 'recommended'
  | 'attempted'
  | 'solved'
  | 'skipped'

export type SessionResult = 'solved' | 'unsolved'

export type SessionCause =
  | 'IDEA'
  | 'IMPLEMENTATION'
  | 'EDGE_CASE'
  | 'COMPLEXITY'
  | 'MATH'
  | 'READING'
  | 'PANIC_TIME'

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5

export interface ProblemCatalogEntry {
  id: ProblemId
  contestId: number
  index: string
  name: string
  rating: number
  tags: string[]
  url: string
  solvedCount?: number
  source: 'seed' | 'codeforces'
}

export interface ProfileBaseline {
  handle: string
  currentRating: number
  maxRating: number
  totalSolved: number
  solvedThisYear: number
  solvedThisMonth: number
  daysSinceLastSubmission: number
  daysSinceLastRatedContest: number
  targetRating: number
  sourceLabel: string
}

export interface ProblemProgress {
  problemId: ProblemId
  status: ProblemProgressStatus
  attempts: number
  source: 'manual' | 'codeforces'
  firstSeenAt?: string
  lastAttemptAt?: string
  solvedAt?: string
  timeSpentMinutes?: number
  notes?: string
}

export interface RecommendationHistoryEntry {
  date: string
  problemIds: ProblemId[]
}

export interface SessionLog {
  id: string
  problemId: ProblemId
  completedAt: string
  result: SessionResult
  attempts: number
  timeMinutes: number
  firstSubmit: boolean
  cause: SessionCause | null
  confidence: ConfidenceLevel
  editorialUsed: boolean
  notes: string
}

export interface TrainingPreferences {
  targetRating: number
  dailyGoal: number
  preferredTags: string[]
  excludedTags: string[]
  hideTags?: boolean
  enableStretch?: boolean
}

export interface TrainingState {
  version: 1
  handle: string
  createdAt: string
  updatedAt: string
  weakTags: string[]
  completedProblemIds: ProblemId[]
  syncedSolvedProblemIds: ProblemId[]
  progress: Record<ProblemId, ProblemProgress>
  recommendationHistory: RecommendationHistoryEntry[]
  sessionLogs: SessionLog[]
  activityDates: string[]
  preferences: TrainingPreferences
  lastSyncAt: string | null
}

export interface RecommendationInput {
  problems: readonly ProblemCatalogEntry[]
  currentRating: number
  targetRating?: number
  weakTags?: readonly string[]
  solvedProblemIds?: Iterable<ProblemId>
  completedProblemIds?: Iterable<ProblemId>
  recentlyRecommendedProblemIds?: Iterable<ProblemId>
  date?: Date | string
}

export interface DailyRecommendation {
  slot: RecommendationSlot
  problem: ProblemCatalogEntry
  idealRating: number
  matchedWeakTags: string[]
  score: number
  explanation: string
}

export interface DailyRecommendationPlan {
  date: string
  currentRating: number
  targetRating: number
  recommendations: DailyRecommendation[]
}

export interface MetricsInput {
  baseline: ProfileBaseline
  state: TrainingState
  currentRating?: number
  currentTotalSolved?: number
  referenceDate?: Date | string
}

export interface DashboardMetrics {
  currentRating: number
  maxRating: number
  targetRating: number
  ratingGap: number
  goalProgressPercent: number
  totalSolved: number
  solvedDuringTraining: number
  attemptedDuringTraining: number
  completionRatePercent: number
  solvedToday: number
  solvedLast7Days: number
  currentStreakDays: number
  bestStreakDays: number
  dailyGoal: number
  dailyGoalProgressPercent: number
  daysSinceLastActivity: number
  reliabilityPercent: number
  firstSubmitRatePercent: number
  avgWrongAttempts: number
  averageConfidence: number
  editorialUseRatePercent: number
  causeCounts: Record<SessionCause, number>
}

export interface CodeforcesUser {
  handle: string
  rating?: number
  maxRating?: number
  rank?: string
  maxRank?: string
  contribution: number
  friendOfCount: number
  avatar?: string
  titlePhoto?: string
  lastOnlineTimeSeconds: number
  registrationTimeSeconds: number
}

export interface CodeforcesProblem {
  contestId?: number
  problemsetName?: string
  index: string
  name: string
  type: string
  points?: number
  rating?: number
  tags: string[]
}

export interface CodeforcesSubmission {
  id: number
  contestId?: number
  creationTimeSeconds: number
  relativeTimeSeconds: number
  problem: CodeforcesProblem
  author: {
    contestId?: number
    participantType: string
    members: Array<{ handle: string }>
  }
  programmingLanguage: string
  verdict?: string
  testset: string
  passedTestCount: number
  timeConsumedMillis: number
  memoryConsumedBytes: number
}

export interface CodeforcesRatingChange {
  contestId: number
  contestName: string
  handle: string
  rank: number
  ratingUpdateTimeSeconds: number
  oldRating: number
  newRating: number
}

export interface CodeforcesContest {
  id: number
  name: string
  type: string
  phase: string
  frozen: boolean
  durationSeconds: number
  startTimeSeconds?: number
  relativeTimeSeconds?: number
  preparedBy?: string
}

export interface CodeforcesProblemStatistics {
  contestId?: number
  index: string
  solvedCount: number
}

export interface CodeforcesProblemset {
  problems: CodeforcesProblem[]
  problemStatistics: CodeforcesProblemStatistics[]
}
