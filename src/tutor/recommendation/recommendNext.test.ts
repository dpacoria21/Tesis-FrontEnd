import { describe, expect, it } from 'vitest'
import type { ProblemCandidate } from '../domain'
import {
  createStudentState,
  recordAttempt,
  recordRecommendation,
} from '../student/model'
import {
  recommendNextAndUpdateStudent,
  recommendNextProblem,
} from './recommendNext'

const NOW = '2026-09-03T15:00:00.000Z'

function problem(
  id: string,
  difficulty: number,
  tags: string[],
  prerequisites: string[] = [],
): ProblemCandidate {
  return { id, title: `Problem ${id}`, difficulty, tags, prerequisites }
}

function practicedState() {
  const initial = createStudentState('student-demo')
  const dpAttempt = recordAttempt(initial, {
    attemptId: 'dp-failed',
    problemId: 'old-dp',
    occurredAt: '2026-09-03T13:00:00.000Z',
    outcome: 'failed',
    durationMs: 60_000,
    conceptIds: ['dp'],
    errors: ['strategy'],
    helpLevelUsed: 'N4',
  }).state
  return recordAttempt(dpAttempt, {
    attemptId: 'greedy-solved',
    problemId: 'old-greedy',
    occurredAt: '2026-09-03T13:30:00.000Z',
    outcome: 'solved',
    durationMs: 30_000,
    conceptIds: ['greedy'],
    errors: [],
    helpLevelUsed: 'N0',
  }).state
}

describe('recommendNextProblem', () => {
  it('prioritizes a mastery gap and explains every activated rule', () => {
    const state = practicedState()
    const result = recommendNextProblem(
      [
        problem('dp-next', 1000, ['dp']),
        problem('greedy-next', 1000, ['greedy']),
      ],
      state,
      NOW,
    )

    expect(result?.problem.id).toBe('dp-next')
    expect(result?.activatedRules.map((rule) => rule.ruleId)).toEqual(
      expect.arrayContaining([
        'mastery_gap',
        'difficulty_fit',
        'prerequisite_readiness',
        'help_dependency',
      ]),
    )
    expect(result?.activatedRules.every((rule) => rule.explanation.length > 0)).toBe(
      true,
    )
    expect(result?.reason).toContain('brecha de dominio')
  })

  it('excludes solved problems and unmet prerequisites', () => {
    const state = practicedState()
    const result = recommendNextProblem(
      [
        problem('old-greedy', 1000, ['greedy']),
        problem('graphs-hard', 1000, ['graphs'], ['dfs']),
        problem('arrays-ready', 1000, ['arrays']),
      ],
      state,
      NOW,
    )

    expect(result?.problem.id).toBe('arrays-ready')
    expect(
      result?.evaluatedCandidates.find((item) => item.problemId === 'old-greedy'),
    ).toMatchObject({ eligible: false, rejectionReasons: ['already_solved'] })
    expect(
      result?.evaluatedCandidates.find((item) => item.problemId === 'graphs-hard')
        ?.rejectionReasons[0],
    ).toContain('unmet_prerequisites:dfs')
  })

  it('penalizes recent history and records the selected recommendation', () => {
    const historyState = recordRecommendation(createStudentState('student-demo'), {
      recommendationId: 'previous',
      problemId: 'a-problem',
      recommendedAt: '2026-09-03T14:00:00.000Z',
      reasonCodes: ['difficulty_fit'],
      score: 1,
    })
    const transition = recommendNextAndUpdateStudent(
      [
        problem('a-problem', 1000, ['arrays']),
        problem('b-problem', 1000, ['arrays']),
      ],
      historyState,
      NOW,
    )

    expect(transition.recommendation?.problem.id).toBe('b-problem')
    expect(transition.state.recommendationHistory).toHaveLength(2)
    expect(transition.state.recommendationHistory[1]).toMatchObject({
      problemId: 'b-problem',
      reasonCodes: expect.arrayContaining(['mastery_gap', 'difficulty_fit']),
    })
  })

  it('uses a stable problem-id tie-break and deduplicates candidate ids', () => {
    const candidates = [
      problem('b-problem', 1000, ['arrays']),
      problem('a-problem', 1000, ['arrays']),
      problem('a-problem', 1000, ['arrays']),
    ]
    const first = recommendNextProblem(
      candidates,
      createStudentState('student-demo'),
      NOW,
    )
    const second = recommendNextProblem(
      [...candidates].reverse(),
      createStudentState('student-demo'),
      NOW,
    )

    expect(first).toEqual(second)
    expect(first?.problem.id).toBe('a-problem')
    expect(first?.evaluatedCandidates).toHaveLength(2)
  })

  it('returns null when no candidate is eligible', () => {
    const state = practicedState()
    expect(
      recommendNextProblem(
        [problem('old-greedy', 1000, ['greedy'])],
        state,
        NOW,
      ),
    ).toBeNull()
  })

  it('accepts configurable rule weights', () => {
    const result = recommendNextProblem(
      [
        problem('near', 1000, ['arrays']),
        problem('far', 1500, ['arrays']),
      ],
      createStudentState('student-demo'),
      NOW,
      {
        weights: {
          masteryGap: 0,
          difficultyFit: 10,
          prerequisiteReadiness: 0,
          novelConcept: 0,
          helpDependency: 0,
          recentlyRecommendedPenalty: 0,
        },
      },
    )

    expect(result?.problem.id).toBe('near')
  })
})

