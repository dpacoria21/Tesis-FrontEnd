import { describe, expect, it } from 'vitest'
import {
  evaluateRanking,
  macroMean,
  ndcgAt,
  nearestRankPercentile,
  recallAt,
  reciprocalRankAt,
} from './metrics'

describe('métricas del benchmark', () => {
  const relevant = new Set(['a', 'c'])
  const ranking = ['x', 'a', 'b', 'c']

  it('calcula recall, rango recíproco y nDCG con juicios binarios', () => {
    expect(recallAt(ranking, relevant, 2)).toBe(0.5)
    expect(recallAt(ranking, relevant, 10)).toBe(1)
    expect(reciprocalRankAt(ranking, relevant, 10)).toBe(0.5)
    expect(ndcgAt(ranking, relevant, 10)).toBeCloseTo(0.650921, 6)
    expect(evaluateRanking({ rankedIds: ranking, relevantIds: relevant })).toEqual({
      recallAt5: 1,
      recallAt10: 1,
      reciprocalRankAt10: 0.5,
      ndcgAt10: 0.650921,
    })
  })

  it('excluye de las métricas de relevancia los casos sin documentos relevantes', () => {
    const empty = new Set<string>()
    expect(recallAt(ranking, empty, 5)).toBeNull()
    expect(reciprocalRankAt(ranking, empty, 10)).toBeNull()
    expect(ndcgAt(ranking, empty, 10)).toBeNull()
  })

  it('calcula media macro solo sobre valores calculables', () => {
    expect(macroMean([1, 0.5, null, 0])).toBe(0.5)
    expect(macroMean([null])).toBeNull()
  })

  it('usa nearest-rank para p50 y p95', () => {
    expect(nearestRankPercentile([5, 1, 3, 2, 4], 0.5)).toBe(3)
    expect(nearestRankPercentile([1, 2, 3, 4, 5], 0.95)).toBe(5)
    expect(nearestRankPercentile([], 0.5)).toBeNull()
    expect(() => nearestRankPercentile([1], 1.1)).toThrow(RangeError)
  })
})

