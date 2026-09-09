import { describe, expect, it } from 'vitest'
import type { HelpLevel, TutorIntent } from '../domain'
import {
  DEFAULT_TEACHER_HELP_RULES,
  decideHelpLevel,
  type HelpPolicyContext,
} from './helpPolicy'

function context(
  intent: TutorIntent,
  overrides: Partial<HelpPolicyContext> = {},
): HelpPolicyContext {
  return {
    intent,
    attemptCount: 1,
    minutesBlocked: 10,
    mastery: 0.5,
    detectedErrors: [],
    directSolutionRequested: false,
    evasionDetected: false,
    previousDirectRequests: 0,
    problemSolved: false,
    isUpsolve: false,
    ...overrides,
  }
}

describe('decideHelpLevel', () => {
  it.each<[HelpLevel, TutorIntent, HelpLevel | undefined, Partial<HelpPolicyContext>]>([
    ['N0', 'clarify', undefined, { attemptCount: 0 }],
    ['N1', 'understand', undefined, { attemptCount: 0 }],
    ['N2', 'concept', 'N1', {}],
    ['N3', 'strategy', 'N2', {}],
    ['N4', 'debug', 'N3', { detectedErrors: ['implementation'] }],
    ['N5', 'solution', 'N4', { problemSolved: true }],
  ])(
    'selects %s under its defined progression conditions',
    (expected, intent, currentMaxHelpLevel, overrides) => {
      const decision = decideHelpLevel(
        context(intent, { currentMaxHelpLevel, ...overrides }),
      )
      expect(decision.selectedLevel).toBe(expected)
    },
  )

  it('never reveals N5 for an unsolved problem by default', () => {
    const decision = decideHelpLevel(
      context('solution', {
        currentMaxHelpLevel: 'N4',
        directSolutionRequested: true,
      }),
    )

    expect(decision.selectedLevel).toBe('N4')
    expect(decision.mayRevealCompleteSolution).toBe(false)
    expect(decision.reasonCodes).toContain('n5_requires_solved_or_upsolve')
    expect(decision.reasonCodes).toContain('direct_solution_protected')
  })

  it('requires evidence of engagement before strategy and debugging levels', () => {
    const strategy = decideHelpLevel(
      context('strategy', {
        currentMaxHelpLevel: 'N2',
        attemptCount: 0,
        minutesBlocked: 2,
      }),
    )
    const debugging = decideHelpLevel(
      context('debug', {
        currentMaxHelpLevel: 'N3',
        attemptCount: 0,
        minutesBlocked: 10,
      }),
    )

    expect(strategy.selectedLevel).toBe('N2')
    expect(strategy.reasonCodes).toContain('strategy_requires_engagement')
    expect(debugging.selectedLevel).toBe('N3')
    expect(debugging.reasonCodes).toContain('debug_requires_attempt')
  })

  it('applies a configurable teacher cap', () => {
    const decision = decideHelpLevel(context('debug', { currentMaxHelpLevel: 'N3' }), {
      ...DEFAULT_TEACHER_HELP_RULES,
      maxHelpLevel: 'N2',
    })

    expect(decision.selectedLevel).toBe('N2')
    expect(decision.reasonCodes).toContain('teacher_level_cap')
  })

  it('records evasion and repeated direct requests as protection reasons', () => {
    const decision = decideHelpLevel(
      context('solution', {
        currentMaxHelpLevel: 'N2',
        directSolutionRequested: true,
        evasionDetected: true,
        previousDirectRequests: 2,
      }),
    )

    expect(decision.selectedLevel).toBe('N3')
    expect(decision.protectionActivated).toBe(true)
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        'direct_solution_protected',
        'evasion_protected',
        'repeated_direct_request',
      ]),
    )
  })
})

