import {
  helpLevelIndex,
  type ProblemCandidate,
} from '../domain'
import {
  recordRecommendation,
  type StudentState,
} from '../student/model'

export type RecommendationRuleId =
  | 'mastery_gap'
  | 'difficulty_fit'
  | 'prerequisite_readiness'
  | 'novel_concept'
  | 'help_dependency'
  | 'recently_recommended'

export interface RecommendationWeights {
  masteryGap: number
  difficultyFit: number
  prerequisiteReadiness: number
  novelConcept: number
  helpDependency: number
  recentlyRecommendedPenalty: number
}

export interface RecommendationConfig {
  targetDifficulty: number
  maximumDifficultyDistance: number
  prerequisiteMasteryThreshold: number
  excludeUnmetPrerequisites: boolean
  recentHistoryWindow: number
  weights: RecommendationWeights
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  targetDifficulty: 1000,
  maximumDifficultyDistance: 600,
  prerequisiteMasteryThreshold: 0.45,
  excludeUnmetPrerequisites: true,
  recentHistoryWindow: 5,
  weights: {
    masteryGap: 4,
    difficultyFit: 2,
    prerequisiteReadiness: 1.5,
    novelConcept: 0.75,
    helpDependency: 1,
    recentlyRecommendedPenalty: -2,
  },
}

export interface ActivatedRecommendationRule {
  ruleId: RecommendationRuleId
  contribution: number
  explanation: string
}

export interface CandidateEvaluation {
  problemId: string
  eligible: boolean
  rejectionReasons: string[]
  score: number
  activatedRules: ActivatedRecommendationRule[]
}

export interface ExplainedRecommendation {
  recommendationId: string
  problem: ProblemCandidate
  score: number
  reason: string
  activatedRules: ActivatedRecommendationRule[]
  evaluatedCandidates: CandidateEvaluation[]
  recommendedAt: string
}

export interface RecommendationTransition {
  recommendation: ExplainedRecommendation | null
  state: StudentState
}

function normalizeTags(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
}

function average(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback
  return values.reduce((total, value) => total + value, 0) / values.length
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function mergeConfig(
  override: Partial<RecommendationConfig> | undefined,
): RecommendationConfig {
  return {
    ...DEFAULT_RECOMMENDATION_CONFIG,
    ...override,
    weights: {
      ...DEFAULT_RECOMMENDATION_CONFIG.weights,
      ...override?.weights,
    },
  }
}

function addRule(
  rules: ActivatedRecommendationRule[],
  ruleId: RecommendationRuleId,
  rawContribution: number,
  explanation: string,
): void {
  rules.push({
    ruleId,
    contribution: round(rawContribution),
    explanation,
  })
}

function evaluateCandidate(
  candidate: ProblemCandidate,
  state: StudentState,
  config: RecommendationConfig,
  recentProblemIds: ReadonlySet<string>,
): CandidateEvaluation {
  const rejectionReasons: string[] = []
  if (state.solvedProblemIds.includes(candidate.id)) {
    rejectionReasons.push('already_solved')
  }
  if (!Number.isFinite(candidate.difficulty) || candidate.difficulty <= 0) {
    rejectionReasons.push('invalid_difficulty')
  }

  const tags = normalizeTags(candidate.tags)
  const prerequisites = normalizeTags(candidate.prerequisites)
  const prerequisiteMasteries = prerequisites.map(
    (concept) => state.masteryByConcept[concept] ?? 0,
  )
  const unmetPrerequisites = prerequisites.filter(
    (concept) =>
      (state.masteryByConcept[concept] ?? 0) <
      config.prerequisiteMasteryThreshold,
  )
  if (config.excludeUnmetPrerequisites && unmetPrerequisites.length > 0) {
    rejectionReasons.push(`unmet_prerequisites:${unmetPrerequisites.join(',')}`)
  }

  if (rejectionReasons.length > 0) {
    return {
      problemId: candidate.id,
      eligible: false,
      rejectionReasons,
      score: Number.NEGATIVE_INFINITY,
      activatedRules: [],
    }
  }

  const rules: ActivatedRecommendationRule[] = []
  const tagMasteries = tags.map((tag) => state.masteryByConcept[tag] ?? 0.3)
  const masteryGap = 1 - average(tagMasteries, 0.3)
  addRule(
    rules,
    'mastery_gap',
    masteryGap * config.weights.masteryGap,
    `Refuerza ${tags.join(', ') || 'habilidades generales'} con brecha de dominio ${masteryGap.toFixed(2)}.`,
  )

  const difficultyDistance = Math.abs(
    candidate.difficulty - config.targetDifficulty,
  )
  const difficultyFit =
    1 - Math.min(1, difficultyDistance / config.maximumDifficultyDistance)
  addRule(
    rules,
    'difficulty_fit',
    difficultyFit * config.weights.difficultyFit,
    `La dificultad ${candidate.difficulty} está a ${difficultyDistance} puntos del objetivo ${config.targetDifficulty}.`,
  )

  const readiness = average(prerequisiteMasteries, 1)
  addRule(
    rules,
    'prerequisite_readiness',
    readiness * config.weights.prerequisiteReadiness,
    prerequisites.length === 0
      ? 'No exige prerrequisitos adicionales registrados.'
      : `Los prerrequisitos tienen dominio medio ${readiness.toFixed(2)}.`,
  )

  const novelRatio = average(
    tags.map((tag) => (state.conceptsPracticed[tag] ? 0 : 1)),
    0,
  )
  if (novelRatio > 0) {
    addRule(
      rules,
      'novel_concept',
      novelRatio * config.weights.novelConcept,
      `Introduce ${Math.round(novelRatio * 100)}% de etiquetas aún no practicadas.`,
    )
  }

  const helpDependency = average(
    tags.map((tag) => {
      const level = state.conceptsPracticed[tag]?.maxHelpLevel
      return level ? helpLevelIndex(level) / 5 : 0
    }),
    0,
  )
  if (helpDependency > 0) {
    addRule(
      rules,
      'help_dependency',
      helpDependency * config.weights.helpDependency,
      `Practica conceptos con dependencia de pistas estimada en ${helpDependency.toFixed(2)}.`,
    )
  }

  if (recentProblemIds.has(candidate.id)) {
    addRule(
      rules,
      'recently_recommended',
      config.weights.recentlyRecommendedPenalty,
      'Reduce prioridad porque el problema fue recomendado recientemente.',
    )
  }

  return {
    problemId: candidate.id,
    eligible: true,
    rejectionReasons: [],
    score: round(rules.reduce((total, rule) => total + rule.contribution, 0)),
    activatedRules: rules,
  }
}

export function recommendNextProblem(
  candidates: readonly ProblemCandidate[],
  state: StudentState,
  recommendedAt: string,
  configOverride?: Partial<RecommendationConfig>,
): ExplainedRecommendation | null {
  if (!Number.isFinite(Date.parse(recommendedAt))) {
    throw new Error('recommendedAt must be an ISO-compatible timestamp')
  }
  const config = mergeConfig(configOverride)
  if (config.maximumDifficultyDistance <= 0) {
    throw new Error('maximumDifficultyDistance must be greater than zero')
  }
  const recentProblemIds = new Set(
    state.recommendationHistory
      .slice(-Math.max(0, config.recentHistoryWindow))
      .map((item) => item.problemId),
  )
  const uniqueCandidates = [...candidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter(
      (candidate, index, ordered) =>
        index === 0 || candidate.id !== ordered[index - 1]?.id,
    )
  const evaluations = uniqueCandidates.map((candidate) =>
    evaluateCandidate(candidate, state, config, recentProblemIds),
  )
  const winner = evaluations
    .filter((evaluation) => evaluation.eligible)
    .sort(
      (left, right) =>
        right.score - left.score || left.problemId.localeCompare(right.problemId),
    )[0]
  if (!winner) return null

  const problem = uniqueCandidates.find(
    (candidate) => candidate.id === winner.problemId,
  )
  if (!problem) return null
  const positiveReasons = winner.activatedRules
    .filter((rule) => rule.contribution > 0)
    .sort(
      (left, right) =>
        right.contribution - left.contribution ||
        left.ruleId.localeCompare(right.ruleId),
    )
  return {
    recommendationId: `recommendation:${recommendedAt}:${problem.id}`,
    problem: {
      ...problem,
      tags: [...problem.tags],
      prerequisites: [...problem.prerequisites],
    },
    score: winner.score,
    reason:
      positiveReasons.map((rule) => rule.explanation).join(' ') ||
      'Seleccionado por el orden determinista de candidatos elegibles.',
    activatedRules: winner.activatedRules,
    evaluatedCandidates: evaluations,
    recommendedAt,
  }
}

export function recommendNextAndUpdateStudent(
  candidates: readonly ProblemCandidate[],
  state: StudentState,
  recommendedAt: string,
  configOverride?: Partial<RecommendationConfig>,
): RecommendationTransition {
  const recommendation = recommendNextProblem(
    candidates,
    state,
    recommendedAt,
    configOverride,
  )
  if (!recommendation) return { recommendation: null, state }
  const next = recordRecommendation(state, {
    recommendationId: recommendation.recommendationId,
    problemId: recommendation.problem.id,
    recommendedAt,
    reasonCodes: recommendation.activatedRules.map((rule) => rule.ruleId),
    score: recommendation.score,
  })
  return { recommendation, state: next }
}

