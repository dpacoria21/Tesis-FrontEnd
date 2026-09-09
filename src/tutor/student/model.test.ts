import { describe, expect, it } from 'vitest'
import {
  createStudentState,
  isStudentState,
  recordAttempt,
  recordHelpUsage,
  recordRecommendation,
  type ProblemAttempt,
} from './model'

const FIRST_ATTEMPT: ProblemAttempt = {
  attemptId: 'attempt-1',
  problemId: 'demo-two-sum',
  occurredAt: '2026-09-03T10:00:00.000Z',
  outcome: 'solved',
  durationMs: 120_000,
  conceptIds: ['Arrays', 'arrays'],
  errors: [],
  helpLevelUsed: 'N0',
}

describe('student model', () => {
  it('creates a separate, valid and empty v1 state', () => {
    const state = createStudentState('student-demo')

    expect(state).toMatchObject({
      schemaVersion: 1,
      studentId: 'student-demo',
      revision: 0,
      attempts: [],
      solvedProblemIds: [],
      recommendationHistory: [],
    })
    expect(isStudentState(state)).toBe(true)
  })

  it('applies deterministic mastery transitions for repeated attempts', () => {
    const initial = createStudentState('student-demo')
    const first = recordAttempt(initial, FIRST_ATTEMPT)
    const second = recordAttempt(first.state, {
      ...FIRST_ATTEMPT,
      attemptId: 'attempt-2',
      occurredAt: '2026-09-03T10:10:00.000Z',
      outcome: 'failed',
      helpLevelUsed: 'N2',
      errors: ['strategy'],
    })

    expect(first.masteryChanges.arrays).toEqual({ before: 0.3, after: 0.475 })
    expect(second.masteryChanges.arrays).toEqual({
      before: 0.475,
      after: 0.38125,
    })
    expect(second.state.conceptsPracticed.arrays).toMatchObject({
      attempts: 2,
      solvedAttempts: 1,
      totalTimeMs: 240_000,
      maxHelpLevel: 'N2',
    })
    expect(second.state.solvedProblemIds).toEqual(['demo-two-sum'])
    expect(second.state.detectedErrors).toEqual([
      expect.objectContaining({
        errorId: 'attempt-2:strategy',
        category: 'strategy',
      }),
    ])
  })

  it('deduplicates an attempt by its stable id without changing revision', () => {
    const first = recordAttempt(createStudentState('student-demo'), FIRST_ATTEMPT)
    const duplicate = recordAttempt(first.state, {
      ...FIRST_ATTEMPT,
      outcome: 'failed',
    })

    expect(duplicate.inserted).toBe(false)
    expect(duplicate.state).toEqual(first.state)
    expect(duplicate.state.revision).toBe(1)
  })

  it('tracks the maximum help and direct solution requests deterministically', () => {
    const initial = createStudentState('student-demo')
    const high = recordHelpUsage(initial, {
      problemId: 'p1',
      level: 'N4',
      occurredAt: '2026-09-03T11:00:00.000Z',
      directSolutionRequest: true,
    })
    const lower = recordHelpUsage(high, {
      problemId: 'p1',
      level: 'N2',
      occurredAt: '2026-09-03T11:01:00.000Z',
      directSolutionRequest: true,
    })

    expect(lower.maxHelpLevelByProblem.p1).toBe('N4')
    expect(lower.directSolutionRequestsByProblem.p1).toBe(2)
    expect(lower.revision).toBe(2)
  })

  it('persists recommendation history idempotently', () => {
    const entry = {
      recommendationId: 'recommendation-1',
      problemId: 'p2',
      recommendedAt: '2026-09-03T12:00:00.000Z',
      reasonCodes: ['mastery_gap', 'difficulty_fit', 'mastery_gap'],
      score: 3.12345678,
    }
    const first = recordRecommendation(createStudentState('student-demo'), entry)
    const duplicate = recordRecommendation(first, entry)

    expect(first.recommendationHistory[0]).toMatchObject({
      reasonCodes: ['difficulty_fit', 'mastery_gap'],
      score: 3.123457,
    })
    expect(duplicate).toEqual(first)
    expect(duplicate.revision).toBe(1)
  })

  it('rejects malformed persisted mastery values', () => {
    const malformed = {
      ...createStudentState('student-demo'),
      masteryByConcept: { arrays: 1.2 },
    }
    expect(isStudentState(malformed)).toBe(false)
  })
})

