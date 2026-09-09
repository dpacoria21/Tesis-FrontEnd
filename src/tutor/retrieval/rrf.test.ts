import { describe, expect, it } from 'vitest'
import { reciprocalRankFusion } from './rrf'

describe('reciprocal rank fusion', () => {
  it('uses one-based ranks, known contributions and deterministic ties', () => {
    const fused = reciprocalRankFusion(
      {
        bm25: [
          { documentId: 'a', rank: 1, score: 9 },
          { documentId: 'b', rank: 2, score: 8 },
        ],
        dense: [
          { documentId: 'b', rank: 1, score: 0.9 },
          { documentId: 'a', rank: 2, score: 0.8 },
        ],
      },
      2,
      { kappa: 60 },
    )

    expect(fused.map((item) => item.documentId)).toEqual(['a', 'b'])
    expect(fused[0].score).toBeCloseTo(1 / 61 + 1 / 62, 12)
    expect(fused[0].componentRanks.bm25?.rrfContribution).toBeCloseTo(1 / 61, 12)
    expect(fused[0].componentRanks.dense?.rrfContribution).toBeCloseTo(1 / 62, 12)
  })

  it('continues with the available ranking when the other retriever is empty', () => {
    const fused = reciprocalRankFusion(
      { bm25: [], dense: [{ documentId: 'only', rank: 1, score: 0.7 }] },
      5,
    )
    expect(fused).toHaveLength(1)
    expect(fused[0].documentId).toBe('only')
  })

  it('returns an empty contract for two empty rankings', () => {
    expect(reciprocalRankFusion({ bm25: [], dense: [] }, 5)).toEqual([])
  })
})
