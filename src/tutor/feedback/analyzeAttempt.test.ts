import { describe, expect, it } from 'vitest'
import type { ErrorCategory } from '../domain'
import { createStudentState } from '../student/model'
import {
  analyzeAttempt,
  analyzeAttemptAndUpdateStudent,
  type AttemptAnalysisInput,
} from './analyzeAttempt'

function input(
  overrides: Partial<AttemptAnalysisInput> = {},
): AttemptAnalysisInput {
  return {
    attemptId: 'attempt-1',
    problemId: 'problem-1',
    occurredAt: '2026-09-03T14:00:00.000Z',
    outcome: 'failed',
    durationMs: 60_000,
    conceptIds: ['arrays'],
    helpLevelUsed: 'N2',
    ...overrides,
  }
}

describe('analyzeAttempt', () => {
  it.each<[ErrorCategory, Partial<AttemptAnalysisInput>]>([
    [
      'comprehension',
      { studentGoal: 'maximizar la suma', expectedGoal: 'minimizar la suma' },
    ],
    ['concept', { missingConcepts: ['invariante de prefijos'] }],
    ['strategy', { strategyIssue: 'recalcula cada rango desde cero' }],
    ['complexity', { complexityIssue: 'O(n²) excede n=200000' }],
    ['implementation', { implementationIssue: 'actualización incorrecta', suspectedLine: 17 }],
    [
      'edge_case',
      { failedTests: [{ name: 'arreglo vacío', kind: 'edge_case' }] },
    ],
    ['syntax_execution', { compilerMessage: 'error en línea 23: expected ;' }],
  ])('distinguishes the %s category with localized feedback', (category, signal) => {
    const result = analyzeAttempt(input(signal))

    expect(result.primaryCategory).toBe(category)
    expect(result.findings[0]).toMatchObject({ category })
    expect(result.findings[0].location.value).not.toBe('')
    expect(result.findings[0].nextStep).not.toBe('')
    expect(result.replacementCode).toBeNull()
  })

  it('orders multiple findings by the fixed seven-category taxonomy', () => {
    const result = analyzeAttempt(
      input({
        complexityIssue: 'O(n²)',
        failedTests: [{ name: 'n=0', kind: 'edge_case' }],
        compilerMessage: 'runtime error',
      }),
    )

    expect(result.findings.map((finding) => finding.category)).toEqual([
      'complexity',
      'edge_case',
      'syntax_execution',
    ])
  })

  it('returns no invented diagnosis for a solved attempt without error evidence', () => {
    const result = analyzeAttempt(input({ outcome: 'solved' }))

    expect(result.primaryCategory).toBeNull()
    expect(result.findings).toEqual([])
    expect(result.summary).toContain('No se detectaron')
  })

  it('falls back to a low-confidence implementation finding when evidence is sparse', () => {
    const result = analyzeAttempt(input())

    expect(result.findings[0]).toMatchObject({
      category: 'implementation',
      confidence: 'low',
    })
  })
})

describe('attempt → feedback → student state', () => {
  it('stores categories and a code fingerprint, never the raw student code', () => {
    const rawCode = 'int secret_value = 42;'
    const result = analyzeAttemptAndUpdateStudent(
      createStudentState('student-demo'),
      input({
        code: rawCode,
        implementationIssue: 'índice incorrecto',
        suspectedLine: 1,
      }),
    )

    expect(result.inserted).toBe(true)
    expect(result.state.attempts[0]).toMatchObject({
      errors: ['implementation'],
      codeSizeChars: rawCode.length,
    })
    expect(result.state.attempts[0].codeFingerprint).toMatch(/^fnv1a32:/)
    expect(JSON.stringify(result.state)).not.toContain(rawCode)
    expect(result.state.detectedErrors[0].category).toBe('implementation')
  })

  it('does not apply the same feedback attempt twice', () => {
    const first = analyzeAttemptAndUpdateStudent(
      createStudentState('student-demo'),
      input({ complexityIssue: 'O(n²)' }),
    )
    const duplicate = analyzeAttemptAndUpdateStudent(
      first.state,
      input({ complexityIssue: 'O(n²)' }),
    )

    expect(duplicate.inserted).toBe(false)
    expect(duplicate.state).toEqual(first.state)
  })
})

