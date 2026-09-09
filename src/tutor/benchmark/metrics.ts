export interface RetrievalMetricInput {
  rankedIds: readonly string[]
  relevantIds: ReadonlySet<string>
}

export interface RetrievalMetrics {
  recallAt5: number | null
  recallAt10: number | null
  reciprocalRankAt10: number | null
  ndcgAt10: number | null
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function recallAt(
  rankedIds: readonly string[],
  relevantIds: ReadonlySet<string>,
  k: number,
): number | null {
  if (relevantIds.size === 0) return null
  const retrieved = new Set(rankedIds.slice(0, Math.max(0, k)))
  let hits = 0
  for (const id of relevantIds) if (retrieved.has(id)) hits += 1
  return round(hits / relevantIds.size)
}

export function reciprocalRankAt(
  rankedIds: readonly string[],
  relevantIds: ReadonlySet<string>,
  k: number,
): number | null {
  if (relevantIds.size === 0) return null
  const rank = rankedIds.slice(0, Math.max(0, k)).findIndex((id) => relevantIds.has(id))
  return rank < 0 ? 0 : round(1 / (rank + 1))
}

export function ndcgAt(
  rankedIds: readonly string[],
  relevantIds: ReadonlySet<string>,
  k: number,
): number | null {
  if (relevantIds.size === 0) return null
  const limit = Math.max(0, k)
  const dcg = rankedIds.slice(0, limit).reduce(
    (total, id, index) => total + (relevantIds.has(id) ? 1 / Math.log2(index + 2) : 0),
    0,
  )
  const idealHits = Math.min(relevantIds.size, limit)
  let idcg = 0
  for (let index = 0; index < idealHits; index += 1) {
    idcg += 1 / Math.log2(index + 2)
  }
  return idcg === 0 ? 0 : round(dcg / idcg)
}

export function evaluateRanking(input: RetrievalMetricInput): RetrievalMetrics {
  return {
    recallAt5: recallAt(input.rankedIds, input.relevantIds, 5),
    recallAt10: recallAt(input.rankedIds, input.relevantIds, 10),
    reciprocalRankAt10: reciprocalRankAt(input.rankedIds, input.relevantIds, 10),
    ndcgAt10: ndcgAt(input.rankedIds, input.relevantIds, 10),
  }
}

export function macroMean(values: readonly (number | null)[]): number | null {
  const calculable = values.filter((value): value is number => value !== null)
  if (calculable.length === 0) return null
  return round(calculable.reduce((sum, value) => sum + value, 0) / calculable.length)
}

/** Nearest-rank percentile: rank = ceil(p * n), with p in [0, 1]. */
export function nearestRankPercentile(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
    throw new RangeError('El percentil debe estar entre 0 y 1.')
  }
  const sorted = [...values].sort((left, right) => left - right)
  const rank = Math.max(1, Math.ceil(percentile * sorted.length))
  return sorted[rank - 1]
}

