import { describe, expect, it } from 'vitest'
import type { ProblemCatalogEntry } from '../types'
import { generateRandomSession } from './randomSession'

function problem(
  id: string,
  rating: number,
  tags: string[] = [],
): ProblemCatalogEntry {
  const match = /^(\d+)([A-Z].*)$/.exec(id)
  if (!match) throw new Error(`Bad test problem id: ${id}`)
  return {
    id,
    contestId: Number(match[1]),
    index: match[2],
    name: `Problem ${id}`,
    rating,
    tags,
    url: `https://codeforces.com/problemset/problem/${match[1]}/${match[2]}`,
    source: 'seed',
  }
}

const balancedCatalog = [
  problem('101A', 1500, ['dp']),
  problem('102A', 1500, ['greedy']),
  problem('103A', 1500, ['graphs']),
  problem('104A', 1500, ['math']),
  problem('201A', 1300, ['implementation']),
  problem('202A', 1400, ['dp']),
  problem('203A', 1600, ['graphs']),
  problem('204A', 1700, ['math']),
]

function selectionIds(result: ReturnType<typeof generateRandomSession>): string[] {
  return result.selections.map((selection) => selection.problem.id)
}

describe('generateRandomSession', () => {
  it('covers the exact dominant quota first and fills the rest with other ratings', () => {
    const result = generateRandomSession({
      problems: balancedCatalog,
      totalProblems: 5,
      minRating: 1300,
      maxRating: 1700,
      dominantRating: 1500,
      seed: 'exact-quota',
    })

    expect(result.selections).toHaveLength(5)
    expect(result.selections.slice(0, 3).map(({ problem }) => problem.rating)).toEqual([
      1500,
      1500,
      1500,
    ])
    expect(
      result.selections.slice(3).every(({ problem }) => problem.rating !== 1500),
    ).toBe(true)
    expect(new Set(selectionIds(result))).toHaveLength(5)
    expect(new Set(result.selections.slice(3).map(({ problem }) => problem.rating)).size).toBe(2)
    expect(result.metadata).toMatchObject({
      isComplete: true,
      dominantTargetCount: 3,
      dominantSelectedCount: 3,
      dominantShortfallCount: 0,
      fallbackFromOtherRatingsCount: 0,
    })
  })

  it('falls back to the rest of the range when there are too few dominant problems', () => {
    const catalog = [
      problem('101A', 1500),
      problem('201A', 1300),
      problem('202A', 1400),
      problem('203A', 1600),
      problem('204A', 1700),
    ]
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 5,
      minRating: 1300,
      maxRating: 1700,
      dominantRating: 1500,
      dominantCount: 3,
      seed: 'dominant-shortage',
    })

    expect(result.selections).toHaveLength(5)
    expect(result.selections[0].problem.rating).toBe(1500)
    expect(result.metadata).toMatchObject({
      dominantAvailableCount: 1,
      dominantSelectedCount: 1,
      dominantShortfallCount: 2,
      fallbackFromOtherRatingsCount: 2,
      isComplete: true,
    })
    expect(result.explanation).toContain('Solo había 1 de 3')
    expect(result.explanation).toContain('2 cupos se sustituyeron')
  })

  it('excludes solved and completed IDs and removes duplicate catalog IDs', () => {
    const result = generateRandomSession({
      problems: [...balancedCatalog, balancedCatalog[2]],
      totalProblems: 5,
      minRating: 1300,
      maxRating: 1700,
      dominantRating: 1500,
      solvedProblemIds: ['101A', '201A'],
      completedProblemIds: new Set(['102A', '202A']),
      seed: 'exclusions',
    })

    expect(selectionIds(result)).not.toContain('101A')
    expect(selectionIds(result)).not.toContain('102A')
    expect(selectionIds(result)).not.toContain('201A')
    expect(selectionIds(result)).not.toContain('202A')
    expect(new Set(selectionIds(result))).toHaveLength(result.selections.length)
    expect(result.metadata.availableCount).toBe(4)
  })

  it('is deterministic for one seed and changes the random selection for another', () => {
    const catalog = Array.from({ length: 12 }, (_, index) =>
      problem(`${300 + index}A`, 1400),
    )
    const input = {
      problems: catalog,
      totalProblems: 4,
      minRating: 1300,
      maxRating: 1600,
      dominantRating: 1500,
      dominantCount: 0,
    }

    const first = generateRandomSession({ ...input, seed: 'repeatable' })
    const repeated = generateRandomSession({ ...input, seed: 'repeatable' })
    const different = generateRandomSession({ ...input, seed: 'different' })

    expect(first).toEqual(repeated)
    expect(selectionIds(first)).not.toEqual(selectionIds(different))
  })

  it('rotates away from the previous session when enough alternatives exist', () => {
    const catalog = [
      ...Array.from({ length: 6 }, (_, index) => problem(`${610 + index}A`, 1500)),
      ...Array.from({ length: 6 }, (_, index) => problem(`${710 + index}A`, 1400)),
    ]
    const input = {
      problems: catalog,
      totalProblems: 4,
      minRating: 1400,
      maxRating: 1500,
      dominantRating: 1500,
      dominantCount: 2,
    }
    const first = generateRandomSession({ ...input, seed: 'first-session' })
    const second = generateRandomSession({
      ...input,
      seed: 'regenerated-session',
      previousSelectionIds: selectionIds(first),
    })

    expect(selectionIds(second).filter((id) => selectionIds(first).includes(id))).toHaveLength(0)
    expect(second.metadata.previousSelectionSelectedCount).toBe(0)
  })

  it('returns every available problem and shortage metadata when n exceeds capacity', () => {
    const result = generateRandomSession({
      problems: balancedCatalog.slice(0, 3),
      totalProblems: 20,
      minRating: 1500,
      maxRating: 1500,
      dominantRating: 1500,
      seed: 'limited-capacity',
    })

    expect(result.selections).toHaveLength(3)
    expect(new Set(selectionIds(result))).toHaveLength(3)
    expect(result.metadata).toMatchObject({
      requestedCount: 20,
      availableCount: 3,
      selectedCount: 3,
      isComplete: false,
      shortageCount: 17,
    })
    expect(result.explanation).toContain('faltan 17 problemas')
  })

  it('fills min=max=z sessions with extra dominant problems when needed', () => {
    const catalog = Array.from({ length: 6 }, (_, index) =>
      problem(`${400 + index}A`, 1500),
    )
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 5,
      minRating: 1500,
      maxRating: 1500,
      dominantRating: 1500,
      dominantCount: 3,
      seed: 'single-rating',
    })

    expect(result.selections).toHaveLength(5)
    expect(result.selections.every(({ problem }) => problem.rating === 1500)).toBe(
      true,
    )
    expect(result.selections.map(({ role }) => role)).toEqual([
      'dominant',
      'dominant',
      'dominant',
      'fallback',
      'fallback',
    ])
    expect(result.metadata).toMatchObject({
      dominantSelectedCount: 5,
      dominantShortfallCount: 0,
      extraDominantCount: 2,
      isComplete: true,
    })
  })

  it('prioritizes weak tags and penalizes recently recommended problems', () => {
    const catalog = [
      problem('501A', 1500, ['dp']),
      problem('502A', 1500, ['greedy']),
      problem('503A', 1500, ['dp']),
    ]
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 1,
      minRating: 1500,
      maxRating: 1500,
      dominantRating: 1500,
      dominantCount: 1,
      weakTags: ['DP'],
      recentlyRecommendedProblemIds: ['501A'],
      seed: 'profile-priorities',
    })

    expect(result.selections[0].problem.id).toBe('503A')
    expect(result.selections[0].matchedWeakTags).toEqual(['dp'])
    expect(result.selections[0].wasRecentlyRecommended).toBe(false)
    expect(result.selections[0].explanation).toContain('áreas débiles')
  })

  it('clamps counts, snaps ratings to steps of 100 and repairs a reversed range', () => {
    const result = generateRandomSession({
      problems: balancedCatalog,
      totalProblems: 99,
      minRating: 1749,
      maxRating: 1249,
      dominantRating: 9999,
      dominantCount: 99,
      seed: 'normalization',
    })

    expect(result.metadata).toMatchObject({
      requestedCount: 20,
      minRating: 1200,
      maxRating: 1700,
      dominantRating: 1700,
      dominantTargetCount: 20,
    })
    expect(result.metadata.normalizationNotes.length).toBeGreaterThan(0)
  })

  it('filters by contest bounds and safely repairs reversed fractional limits', () => {
    const catalog = [
      problem('50A', 1500),
      problem('100A', 1500),
      problem('150A', 1500),
      problem('200A', 1500),
      problem('250A', 1500),
    ]
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 3,
      minRating: 1500,
      maxRating: 1500,
      dominantRating: 1500,
      dominantCount: 3,
      minContestId: 210.4,
      maxContestId: 89.6,
      seed: 'contest-bounds',
    })

    expect(new Set(selectionIds(result))).toEqual(
      new Set(['100A', '150A', '200A']),
    )
    expect(result.metadata).toMatchObject({
      minContestId: 90,
      maxContestId: 210,
      contestBoundsExcludedCount: 2,
      explicitContestExcludedCount: 0,
      availableCount: 3,
      selectedCount: 3,
      dominantSelectedCount: 3,
      isComplete: true,
    })
  })

  it('excludes specific contests after normalizing and deduplicating their IDs', () => {
    const catalog = [
      problem('101A', 1500),
      problem('102A', 1500),
      problem('102B', 1400),
      problem('103A', 1400),
      problem('104A', 1600),
    ]
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 2,
      minRating: 1400,
      maxRating: 1600,
      dominantRating: 1500,
      dominantCount: 1,
      excludedContestIds: [102, 104.2, 102, -1, Number.NaN],
      seed: 'specific-contests',
    })

    expect(selectionIds(result)).toEqual(['101A', '103A'])
    expect(result.metadata).toMatchObject({
      minContestId: null,
      maxContestId: null,
      excludedContestIds: [0, 102, 104],
      contestBoundsExcludedCount: 0,
      explicitContestExcludedCount: 3,
      availableCount: 2,
      selectedCount: 2,
      dominantSelectedCount: 1,
      isComplete: true,
    })
  })

  it('preserves a complete session with range fallback after contest filters reduce the dominant pool', () => {
    const catalog = [
      problem('100A', 1500),
      problem('101A', 1500),
      problem('102A', 1500),
      problem('103A', 1300),
      problem('104A', 1400),
      problem('105A', 1600),
      problem('106A', 1700),
    ]
    const result = generateRandomSession({
      problems: catalog,
      totalProblems: 5,
      minRating: 1300,
      maxRating: 1700,
      dominantRating: 1500,
      dominantCount: 3,
      minContestId: 101,
      excludedContestIds: [102],
      seed: 'filtered-fallback',
    })

    expect(selectionIds(result)).not.toContain('100A')
    expect(selectionIds(result)).not.toContain('102A')
    expect(result.selections).toHaveLength(5)
    expect(new Set(selectionIds(result))).toHaveLength(5)
    expect(result.metadata).toMatchObject({
      contestBoundsExcludedCount: 1,
      explicitContestExcludedCount: 1,
      dominantAvailableCount: 1,
      dominantSelectedCount: 1,
      dominantShortfallCount: 2,
      fallbackFromOtherRatingsCount: 2,
      selectedCount: 5,
      isComplete: true,
    })
  })
})
