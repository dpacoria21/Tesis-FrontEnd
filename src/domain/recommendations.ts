import type {
  DailyRecommendation,
  DailyRecommendationPlan,
  ProblemCatalogEntry,
  ProblemId,
  RecommendationInput,
  RecommendationSlot,
} from '../types'

const MIN_TRAINING_RATING = 1200
const MAX_TRAINING_RATING = 2000
const SLOT_ORDER: RecommendationSlot[] = ['recovery', 'target', 'stretch']

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function ratingStep(value: number): number {
  return clamp(
    Math.round(value / 100) * 100,
    MIN_TRAINING_RATING,
    MAX_TRAINING_RATING,
  )
}

function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase()
}

function toDateKey(value: Date | string | undefined): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }

  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('The recommendation date is invalid.')
  }
  return date.toISOString().slice(0, 10)
}

/** Stable FNV-1a hash used only as a deterministic daily tie-breaker. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function asSet(values: Iterable<ProblemId> | undefined): Set<ProblemId> {
  return new Set(values ?? [])
}

export function getIdealRatings(
  currentRating: number,
  targetRating = currentRating + 150,
): Record<RecommendationSlot, number> {
  const recovery = ratingStep(currentRating - 100)
  const target = ratingStep(Math.max(currentRating, targetRating))
  const stretch = ratingStep(Math.max(target + 200, currentRating + 200))

  return { recovery, target, stretch }
}

function describeRecommendation(
  slot: RecommendationSlot,
  idealRating: number,
  matchedWeakTags: string[],
): string {
  const slotReason: Record<RecommendationSlot, string> = {
    recovery: `Recuperación: rating ${idealRating} para reconstruir ritmo con una dificultad controlada.`,
    target: `Objetivo: rating ${idealRating} para trabajar al nivel que quieres consolidar.`,
    stretch: `Stretch: rating ${idealRating} para practicar el siguiente salto sin convertirlo en la base del día.`,
  }
  const tagReason = matchedWeakTags.length
    ? ` Refuerza tus áreas débiles: ${matchedWeakTags.join(', ')}.`
    : ' Se eligió por ajuste de dificultad y rotación diaria.'

  return `${slotReason[slot]}${tagReason}`
}

interface RankedProblem {
  problem: ProblemCatalogEntry
  matchedWeakTags: string[]
  distance: number
  score: number
}

function rankCandidates(
  candidates: readonly ProblemCatalogEntry[],
  idealRating: number,
  weakTags: Set<string>,
  recentlyRecommended: Set<ProblemId>,
  dateKey: string,
  slot: RecommendationSlot,
): RankedProblem[] {
  const inBand = candidates.filter(
    (problem) => Math.abs(problem.rating - idealRating) <= 200,
  )
  const pool = inBand.length > 0 ? inBand : candidates

  return pool
    .map((problem) => {
      const matchedWeakTags = problem.tags.filter((tag) =>
        weakTags.has(normalizeTag(tag)),
      )
      const distance = Math.abs(problem.rating - idealRating)
      const weakTagBoost = matchedWeakTags.length * 110
      const recentPenalty = recentlyRecommended.has(problem.id) ? 35 : 0
      const dailyTieBreaker =
        (stableHash(`${dateKey}:${slot}:${problem.id}`) % 1000) / 1000

      return {
        problem,
        matchedWeakTags,
        distance,
        score: weakTagBoost - distance - recentPenalty + dailyTieBreaker,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.distance - right.distance ||
        left.problem.id.localeCompare(right.problem.id),
    )
}

/**
 * Produces up to three distinct daily problems. Given the same catalog, state
 * and date, the result is byte-for-byte deterministic.
 */
export function generateDailyRecommendations(
  input: RecommendationInput,
): DailyRecommendation[] {
  const dateKey = toDateKey(input.date)
  const solved = asSet(input.solvedProblemIds)
  const completed = asSet(input.completedProblemIds)
  const recentlyRecommended = asSet(input.recentlyRecommendedProblemIds)
  const excluded = new Set([...solved, ...completed])
  const weakTags = new Set((input.weakTags ?? []).map(normalizeTag))
  const idealRatings = getIdealRatings(input.currentRating, input.targetRating)

  const available = input.problems.filter(
    (problem) =>
      !excluded.has(problem.id) &&
      Number.isFinite(problem.rating) &&
      problem.rating >= MIN_TRAINING_RATING &&
      problem.rating <= MAX_TRAINING_RATING,
  )
  const selected = new Set<ProblemId>()
  const recommendations: DailyRecommendation[] = []

  for (const slot of SLOT_ORDER) {
    const remaining = available.filter((problem) => !selected.has(problem.id))
    if (remaining.length === 0) break

    const idealRating = idealRatings[slot]
    const best = rankCandidates(
      remaining,
      idealRating,
      weakTags,
      recentlyRecommended,
      dateKey,
      slot,
    )[0]

    selected.add(best.problem.id)
    recommendations.push({
      slot,
      problem: best.problem,
      idealRating,
      matchedWeakTags: best.matchedWeakTags,
      score: Math.round(best.score * 1000) / 1000,
      explanation: describeRecommendation(
        slot,
        idealRating,
        best.matchedWeakTags,
      ),
    })
  }

  return recommendations
}

export function buildDailyRecommendationPlan(
  input: RecommendationInput,
): DailyRecommendationPlan {
  const date = toDateKey(input.date)
  return {
    date,
    currentRating: input.currentRating,
    targetRating: input.targetRating ?? input.currentRating + 150,
    recommendations: generateDailyRecommendations({ ...input, date }),
  }
}
