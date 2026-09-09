import { describe, expect, it } from 'vitest'
import type { ProblemCatalogEntry } from '../types'
import {
  generateDailyRecommendations,
  getIdealRatings,
} from './recommendations'

function problem(
  id: string,
  rating: number,
  tags: string[],
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

const catalog = [
  problem('101A', 1300, ['greedy']),
  problem('102A', 1300, ['dp']),
  problem('201B', 1500, ['math']),
  problem('202B', 1500, ['dp']),
  problem('301C', 1700, ['graphs']),
  problem('302C', 1700, ['dp']),
]

describe('generateDailyRecommendations', () => {
  it('returns the recovery, target and stretch slots at the expected levels', () => {
    expect(getIdealRatings(1354, 1500)).toEqual({
      recovery: 1300,
      target: 1500,
      stretch: 1700,
    })

    const result = generateDailyRecommendations({
      problems: catalog,
      currentRating: 1354,
      targetRating: 1500,
      date: '2026-08-12',
    })

    expect(result.map((item) => item.slot)).toEqual([
      'recovery',
      'target',
      'stretch',
    ])
    expect(result.map((item) => item.idealRating)).toEqual([1300, 1500, 1700])
    expect(new Set(result.map((item) => item.problem.id))).toHaveLength(3)
  })

  it('is deterministic for the same date and inputs', () => {
    const input = {
      problems: catalog,
      currentRating: 1354,
      targetRating: 1500,
      weakTags: ['dp'],
      date: '2026-08-12',
    }

    expect(generateDailyRecommendations(input)).toEqual(
      generateDailyRecommendations(input),
    )
  })

  it('excludes both synced solves and locally completed problems', () => {
    const result = generateDailyRecommendations({
      problems: catalog,
      currentRating: 1354,
      targetRating: 1500,
      solvedProblemIds: new Set(['102A']),
      completedProblemIds: ['202B'],
      date: '2026-08-12',
    })

    expect(result.map((item) => item.problem.id)).not.toContain('102A')
    expect(result.map((item) => item.problem.id)).not.toContain('202B')
  })

  it('prioritizes weak tags within the appropriate rating band and explains why', () => {
    const result = generateDailyRecommendations({
      problems: catalog,
      currentRating: 1354,
      targetRating: 1500,
      weakTags: ['DP'],
      date: '2026-08-12',
    })

    expect(result).toHaveLength(3)
    expect(result.every((item) => item.problem.tags.includes('dp'))).toBe(true)
    expect(result.every((item) => item.matchedWeakTags.includes('dp'))).toBe(true)
    expect(result.every((item) => item.explanation.includes('áreas débiles'))).toBe(
      true,
    )
  })

  it('returns only the remaining available problems when fewer than three exist', () => {
    const result = generateDailyRecommendations({
      problems: catalog.slice(0, 2),
      currentRating: 1354,
      solvedProblemIds: ['101A'],
      date: '2026-08-12',
    })

    expect(result).toHaveLength(1)
    expect(result[0].problem.id).toBe('102A')
  })
})
