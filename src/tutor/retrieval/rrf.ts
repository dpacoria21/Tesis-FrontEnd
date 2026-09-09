import type { RankedCandidate, RetrievalComponent } from './types'

export const DEFAULT_RRF_KAPPA = 60

export interface RrfConfiguration {
  kappa: number
}

export interface FusedCandidate {
  documentId: string
  rank: number
  score: number
  componentRanks: Partial<
    Record<RetrievalComponent, { rank: number; rawScore: number; rrfContribution: number }>
  >
}

export type ComponentRankings = Partial<Record<RetrievalComponent, readonly RankedCandidate[]>>

export function reciprocalRankFusion(
  rankings: ComponentRankings,
  limit: number,
  configuration: RrfConfiguration = { kappa: DEFAULT_RRF_KAPPA },
): FusedCandidate[] {
  if (!Number.isFinite(configuration.kappa) || configuration.kappa < 0) {
    throw new Error('RRF kappa must be a finite non-negative number.')
  }
  if (limit <= 0) return []

  const accumulated = new Map<
    string,
    {
      score: number
      componentRanks: FusedCandidate['componentRanks']
      bestRank: number
      coverage: number
    }
  >()

  for (const component of ['bm25', 'dense'] as const) {
    const seen = new Set<string>()
    for (const candidate of rankings[component] ?? []) {
      if (seen.has(candidate.documentId)) continue
      seen.add(candidate.documentId)
      if (!Number.isInteger(candidate.rank) || candidate.rank < 1) {
        throw new Error(`RRF received an invalid ${component} rank for ${candidate.documentId}.`)
      }
      const contribution = 1 / (configuration.kappa + candidate.rank)
      const current = accumulated.get(candidate.documentId) ?? {
        score: 0,
        componentRanks: {},
        bestRank: Number.POSITIVE_INFINITY,
        coverage: 0,
      }
      current.score += contribution
      current.componentRanks[component] = {
        rank: candidate.rank,
        rawScore: candidate.score,
        rrfContribution: contribution,
      }
      current.bestRank = Math.min(current.bestRank, candidate.rank)
      current.coverage += 1
      accumulated.set(candidate.documentId, current)
    }
  }

  return [...accumulated.entries()]
    .map(([documentId, value]) => ({ documentId, ...value }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.bestRank - right.bestRank ||
        right.coverage - left.coverage ||
        left.documentId.localeCompare(right.documentId),
    )
    .slice(0, limit)
    .map(({ documentId, score, componentRanks }, index) => ({
      documentId,
      score,
      componentRanks,
      rank: index + 1,
    }))
}
