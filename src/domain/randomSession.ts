import type { ProblemCatalogEntry, ProblemId } from '../types'

const MIN_CODEFORCES_RATING = 800
const MAX_CODEFORCES_RATING = 3500
const DEFAULT_TOTAL_PROBLEMS = 5
const DEFAULT_DOMINANT_COUNT = 3

export interface RandomSessionInput {
  problems: readonly ProblemCatalogEntry[]
  totalProblems: number
  minRating: number
  maxRating: number
  dominantRating: number
  dominantCount?: number
  minContestId?: number | null
  maxContestId?: number | null
  excludedContestIds?: Iterable<number>
  solvedProblemIds?: Iterable<ProblemId>
  completedProblemIds?: Iterable<ProblemId>
  weakTags?: readonly string[]
  recentlyRecommendedProblemIds?: Iterable<ProblemId>
  previousSelectionIds?: Iterable<ProblemId>
  seed?: string | number
}

export type RandomSessionSelectionRole =
  | 'dominant'
  | 'range'
  | 'fallback'

export interface RandomSessionSelection {
  problem: ProblemCatalogEntry
  isDominant: boolean
  role: RandomSessionSelectionRole
  matchedWeakTags: string[]
  wasRecentlyRecommended: boolean
  wasPreviousSelection: boolean
  score: number
  explanation: string
}

export interface RandomSessionMetadata {
  requestedCount: number
  selectedCount: number
  availableCount: number
  isComplete: boolean
  shortageCount: number
  minRating: number
  maxRating: number
  dominantRating: number
  minContestId: number | null
  maxContestId: number | null
  excludedContestIds: number[]
  contestBoundsExcludedCount: number
  explicitContestExcludedCount: number
  dominantTargetCount: number
  dominantAvailableCount: number
  dominantSelectedCount: number
  dominantShortfallCount: number
  fallbackFromOtherRatingsCount: number
  extraDominantCount: number
  recentlyRecommendedSelectedCount: number
  previousSelectionSelectedCount: number
  weakTagSelectedCount: number
  seed: string
  normalizationNotes: string[]
}

export interface RandomSessionResult {
  selections: RandomSessionSelection[]
  metadata: RandomSessionMetadata
  explanation: string
}

interface NormalizedSettings {
  totalProblems: number
  minRating: number
  maxRating: number
  dominantRating: number
  dominantCount: number
  minContestId: number | null
  maxContestId: number | null
  excludedContestIds: number[]
  seed: string
  normalizationNotes: string[]
}

interface AvailableProblemsResult {
  problems: ProblemCatalogEntry[]
  contestBoundsExcludedCount: number
  explicitContestExcludedCount: number
}

interface RankedCandidate {
  problem: ProblemCatalogEntry
  matchedWeakTags: string[]
  wasRecentlyRecommended: boolean
  wasPreviousSelection: boolean
  score: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return clamp(fallback, minimum, maximum)
  return clamp(Math.round(value as number), minimum, maximum)
}

function normalizeRating(value: number, fallback: number): number {
  const finiteValue = Number.isFinite(value) ? value : fallback
  return clamp(
    Math.round(finiteValue / 100) * 100,
    MIN_CODEFORCES_RATING,
    MAX_CODEFORCES_RATING,
  )
}

function normalizeOptionalContestId(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null
  }
  return Math.max(0, Math.round(value))
}

function normalizeExcludedContestIds(
  values: Iterable<number> | undefined,
): number[] {
  const normalized = new Set<number>()

  for (const value of values ?? []) {
    if (!Number.isFinite(value)) continue
    normalized.add(Math.max(0, Math.round(value)))
  }

  return [...normalized].sort((left, right) => left - right)
}

function describeChange(
  label: string,
  original: number | undefined,
  normalized: number,
): string | undefined {
  return original === normalized
    ? undefined
    : `${label} se normalizó de ${String(original)} a ${normalized}.`
}

function createRandomSeed(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`
}

function normalizeSeed(seed: string | number | undefined): string {
  if (typeof seed === 'number' && Number.isFinite(seed)) return String(seed)
  if (typeof seed === 'string' && seed.trim()) return seed.trim()
  return createRandomSeed()
}

function normalizeSettings(input: RandomSessionInput): NormalizedSettings {
  const totalProblems = normalizeInteger(
    input.totalProblems,
    DEFAULT_TOTAL_PROBLEMS,
    1,
    20,
  )
  const firstRating = normalizeRating(input.minRating, MIN_CODEFORCES_RATING)
  const secondRating = normalizeRating(input.maxRating, MAX_CODEFORCES_RATING)
  const minRating = Math.min(firstRating, secondRating)
  const maxRating = Math.max(firstRating, secondRating)
  const snappedDominantRating = normalizeRating(
    input.dominantRating,
    Math.round((minRating + maxRating) / 200) * 100,
  )
  const dominantRating = clamp(
    snappedDominantRating,
    minRating,
    maxRating,
  )
  const dominantCount = normalizeInteger(
    input.dominantCount,
    DEFAULT_DOMINANT_COUNT,
    0,
    totalProblems,
  )
  const firstContestId = normalizeOptionalContestId(input.minContestId)
  const secondContestId = normalizeOptionalContestId(input.maxContestId)
  const minContestId =
    firstContestId !== null && secondContestId !== null
      ? Math.min(firstContestId, secondContestId)
      : firstContestId
  const maxContestId =
    firstContestId !== null && secondContestId !== null
      ? Math.max(firstContestId, secondContestId)
      : secondContestId
  const excludedContestIds = normalizeExcludedContestIds(
    input.excludedContestIds,
  )

  const normalizationNotes = [
    describeChange('La cantidad total', input.totalProblems, totalProblems),
    describeChange('El rating mínimo', input.minRating, minRating),
    describeChange('El rating máximo', input.maxRating, maxRating),
    describeChange(
      'El rating predominante',
      input.dominantRating,
      dominantRating,
    ),
    describeChange(
      'La cuota predominante',
      input.dominantCount,
      dominantCount,
    ),
    input.minContestId !== undefined && input.minContestId !== minContestId
      ? `El contest mínimo se normalizó de ${String(input.minContestId)} a ${String(minContestId)}.`
      : undefined,
    input.maxContestId !== undefined && input.maxContestId !== maxContestId
      ? `El contest máximo se normalizó de ${String(input.maxContestId)} a ${String(maxContestId)}.`
      : undefined,
  ].filter((note): note is string => Boolean(note))

  return {
    totalProblems,
    minRating,
    maxRating,
    dominantRating,
    dominantCount,
    minContestId,
    maxContestId,
    excludedContestIds,
    seed: normalizeSeed(input.seed),
    normalizationNotes,
  }
}

function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase()
}

function asIdSet(values: Iterable<ProblemId> | undefined): Set<ProblemId> {
  return new Set(values ?? [])
}

/** A compact seeded hash with a final avalanche, used only for random ordering. */
function stableHash(value: string): number {
  let hash = 1779033703 ^ value.length
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
  return (hash ^ (hash >>> 16)) >>> 0
}

function seededFraction(seed: string, phase: string, problemId: string): number {
  return stableHash(`${seed}:${phase}:${problemId}`) / 0x100000000
}

function rankCandidates(
  candidates: readonly ProblemCatalogEntry[],
  weakTags: Set<string>,
  recentlyRecommended: Set<ProblemId>,
  previousSelection: Set<ProblemId>,
  seed: string,
  phase: string,
): RankedCandidate[] {
  return [...candidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((problem) => {
      const matchedWeakTags = [
        ...new Set(
          problem.tags
            .map(normalizeTag)
            .filter((tag) => tag && weakTags.has(tag)),
        ),
      ]
      const wasRecentlyRecommended = recentlyRecommended.has(problem.id)
      const wasPreviousSelection = previousSelection.has(problem.id)
      const randomTieBreaker = seededFraction(seed, phase, problem.id) * 100
      const qualityBoost = Math.log10((problem.solvedCount ?? 0) + 1) * 8
      const score =
        matchedWeakTags.length * 1000 -
        (wasPreviousSelection ? 10000 : 0) -
        (wasRecentlyRecommended ? 250 : 0) +
        qualityBoost +
        randomTieBreaker

      return {
        problem,
        matchedWeakTags,
        wasRecentlyRecommended,
        wasPreviousSelection,
        score: Math.round(score * 1000) / 1000,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.problem.id.localeCompare(right.problem.id),
    )
}

function takeRatingDiverseCandidates(
  candidates: readonly RankedCandidate[],
  count: number,
): RankedCandidate[] {
  const remaining = [...candidates]
  const selected: RankedCandidate[] = []
  const usedRatings = new Set<number>()

  while (selected.length < count && remaining.length) {
    const freshRatingIndex = remaining.findIndex(
      (candidate) => !usedRatings.has(candidate.problem.rating),
    )
    const selectedIndex = freshRatingIndex >= 0 ? freshRatingIndex : 0
    const [candidate] = remaining.splice(selectedIndex, 1)
    selected.push(candidate)
    usedRatings.add(candidate.problem.rating)
  }

  return selected
}

function getAvailableProblems(
  input: RandomSessionInput,
  settings: NormalizedSettings,
): AvailableProblemsResult {
  const excluded = new Set([
    ...asIdSet(input.solvedProblemIds),
    ...asIdSet(input.completedProblemIds),
  ])
  const excludedContestIds = new Set(settings.excludedContestIds)
  const seen = new Set<ProblemId>()
  const problems: ProblemCatalogEntry[] = []
  let contestBoundsExcludedCount = 0
  let explicitContestExcludedCount = 0

  for (const problem of input.problems) {
    if (
      !problem ||
      typeof problem.id !== 'string' ||
      seen.has(problem.id) ||
      !Number.isFinite(problem.rating) ||
      !Number.isFinite(problem.contestId)
    ) {
      continue
    }

    seen.add(problem.id)

    if (
      excluded.has(problem.id) ||
      problem.rating < settings.minRating ||
      problem.rating > settings.maxRating
    ) {
      continue
    }

    if (
      (settings.minContestId !== null &&
        problem.contestId < settings.minContestId) ||
      (settings.maxContestId !== null &&
        problem.contestId > settings.maxContestId)
    ) {
      contestBoundsExcludedCount += 1
      continue
    }

    if (excludedContestIds.has(problem.contestId)) {
      explicitContestExcludedCount += 1
      continue
    }

    problems.push(problem)
  }

  return {
    problems,
    contestBoundsExcludedCount,
    explicitContestExcludedCount,
  }
}

function createSelection(
  candidate: RankedCandidate,
  role: RandomSessionSelectionRole,
  dominantRating: number,
): RandomSessionSelection {
  const roleExplanation: Record<RandomSessionSelectionRole, string> = {
    dominant: `Cubre la cuota principal de rating ${dominantRating}.`,
    range: `Aporta variedad dentro del rango con rating ${candidate.problem.rating}.`,
    fallback:
      candidate.problem.rating === dominantRating
        ? `Completa la sesión con rating ${dominantRating} porque faltaban opciones en otros ratings.`
        : `Sustituye un cupo sin candidato disponible en rating ${dominantRating}.`,
  }
  const weakTagExplanation = candidate.matchedWeakTags.length
    ? ` Refuerza áreas débiles: ${candidate.matchedWeakTags.join(', ')}.`
    : ''
  const recentExplanation = candidate.wasRecentlyRecommended
    ? ' Se usó pese a ser una recomendación reciente porque seguía siendo una de las mejores opciones disponibles.'
    : ''
  const repeatedExplanation = candidate.wasPreviousSelection
    ? ' Se repite porque no quedaban suficientes alternativas para conservar la composición.'
    : ''

  return {
    problem: candidate.problem,
    isDominant: candidate.problem.rating === dominantRating,
    role,
    matchedWeakTags: candidate.matchedWeakTags,
    wasRecentlyRecommended: candidate.wasRecentlyRecommended,
    wasPreviousSelection: candidate.wasPreviousSelection,
    score: candidate.score,
    explanation: `${roleExplanation[role]}${weakTagExplanation}${recentExplanation}${repeatedExplanation}`,
  }
}

function buildResultExplanation(metadata: RandomSessionMetadata): string {
  const parts: string[] = []

  if (metadata.dominantTargetCount === 0) {
    parts.push('No se solicitó una cuota de rating predominante.')
  } else if (metadata.dominantShortfallCount > 0) {
    parts.push(
      `Solo había ${metadata.dominantAvailableCount} de ${metadata.dominantTargetCount} problemas solicitados en rating ${metadata.dominantRating}.`,
    )
    if (metadata.fallbackFromOtherRatingsCount > 0) {
      parts.push(
        `${metadata.fallbackFromOtherRatingsCount} cupos se sustituyeron con otros ratings del rango.`,
      )
    }
  } else {
    parts.push(
      `Se cubrió la cuota de ${metadata.dominantTargetCount} problemas en rating ${metadata.dominantRating}.`,
    )
  }

  if (metadata.extraDominantCount > 0) {
    parts.push(
      `${metadata.extraDominantCount} cupos adicionales usaron rating ${metadata.dominantRating} porque faltaban opciones en otros ratings.`,
    )
  }

  if (!metadata.isComplete) {
    parts.push(
      `La sesión quedó en ${metadata.selectedCount} de ${metadata.requestedCount}: faltan ${metadata.shortageCount} problemas sin resolver dentro del rango.`,
    )
  } else {
    parts.push(`La sesión contiene los ${metadata.requestedCount} problemas pedidos.`)
  }

  return parts.join(' ')
}

/**
 * Builds a profile-aware random session. The same normalized input and seed
 * always produce the same problems in the same order.
 */
export function generateRandomSession(
  input: RandomSessionInput,
): RandomSessionResult {
  const settings = normalizeSettings(input)
  const weakTags = new Set(
    (input.weakTags ?? []).map(normalizeTag).filter(Boolean),
  )
  const recentlyRecommended = asIdSet(input.recentlyRecommendedProblemIds)
  const previousSelection = asIdSet(input.previousSelectionIds)
  const availableResult = getAvailableProblems(input, settings)
  const available = availableResult.problems
  const dominantCandidates = rankCandidates(
    available.filter(
      (problem) => problem.rating === settings.dominantRating,
    ),
    weakTags,
    recentlyRecommended,
    previousSelection,
    settings.seed,
    'dominant',
  )
  const otherCandidates = rankCandidates(
    available.filter(
      (problem) => problem.rating !== settings.dominantRating,
    ),
    weakTags,
    recentlyRecommended,
    previousSelection,
    settings.seed,
    'range',
  )

  const dominantQuotaCount = Math.min(
    settings.dominantCount,
    dominantCandidates.length,
  )
  const dominantQuota = dominantCandidates.slice(0, dominantQuotaCount)
  const remainingAfterDominant = settings.totalProblems - dominantQuota.length
  const selectedOther = takeRatingDiverseCandidates(
    otherCandidates,
    remainingAfterDominant,
  )
  const remainingAfterOther =
    remainingAfterDominant - selectedOther.length
  const extraDominant = dominantCandidates.slice(
    dominantQuotaCount,
    dominantQuotaCount + remainingAfterOther,
  )

  const ordinaryRangeTarget = settings.totalProblems - settings.dominantCount
  const selections: RandomSessionSelection[] = [
    ...dominantQuota.map((candidate) =>
      createSelection(candidate, 'dominant', settings.dominantRating),
    ),
    ...selectedOther.map((candidate, index) =>
      createSelection(
        candidate,
        index < ordinaryRangeTarget ? 'range' : 'fallback',
        settings.dominantRating,
      ),
    ),
    ...extraDominant.map((candidate) =>
      createSelection(candidate, 'fallback', settings.dominantRating),
    ),
  ]

  const dominantSelectedCount = selections.filter(
    (selection) => selection.problem.rating === settings.dominantRating,
  ).length
  const dominantShortfallCount = Math.max(
    0,
    settings.dominantCount - dominantQuota.length,
  )
  const fallbackFromOtherRatingsCount = Math.max(
    0,
    selectedOther.length - ordinaryRangeTarget,
  )
  const selectedCount = selections.length
  const metadata: RandomSessionMetadata = {
    requestedCount: settings.totalProblems,
    selectedCount,
    availableCount: available.length,
    isComplete: selectedCount === settings.totalProblems,
    shortageCount: settings.totalProblems - selectedCount,
    minRating: settings.minRating,
    maxRating: settings.maxRating,
    dominantRating: settings.dominantRating,
    minContestId: settings.minContestId,
    maxContestId: settings.maxContestId,
    excludedContestIds: settings.excludedContestIds,
    contestBoundsExcludedCount:
      availableResult.contestBoundsExcludedCount,
    explicitContestExcludedCount:
      availableResult.explicitContestExcludedCount,
    dominantTargetCount: settings.dominantCount,
    dominantAvailableCount: dominantCandidates.length,
    dominantSelectedCount,
    dominantShortfallCount,
    fallbackFromOtherRatingsCount,
    extraDominantCount: extraDominant.length,
    recentlyRecommendedSelectedCount: selections.filter(
      (selection) => selection.wasRecentlyRecommended,
    ).length,
    previousSelectionSelectedCount: selections.filter(
      (selection) => selection.wasPreviousSelection,
    ).length,
    weakTagSelectedCount: selections.filter(
      (selection) => selection.matchedWeakTags.length > 0,
    ).length,
    seed: settings.seed,
    normalizationNotes: settings.normalizationNotes,
  }

  return {
    selections,
    metadata,
    explanation: buildResultExplanation(metadata),
  }
}
