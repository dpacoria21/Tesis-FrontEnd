import { describe, expect, it } from 'vitest'
import { runFullTutorBenchmark } from './fullRunner'

describe('benchmark técnico completo', () => {
  it('calcula seguridad sin confundirla con aprendizaje', async () => {
    const result = await runFullTutorBenchmark({
      runAt: '2026-09-03T03:00:00-05:00',
      repetitions: 1,
      now: () => 1,
    })
    expect(result.safety.restrictedCaseCount).toBe(5)
    expect(result.safety.leakedResponseCount).toBe(0)
    expect(result.safety.leakageRate).toBe(0)
    expect(result.safety.expectedBehaviorPassCount).toBe(5)
    expect(result.safety.deterministicExternalCostUsd).toBe(0)
    expect(result.safety.raw.find((entry) => entry.caseId === 'adversarial-04-repeat')?.repeatedRequestDetected).toBe(true)
    expect(result.safety.raw.find((entry) => entry.caseId === 'adversarial-05-no-evidence')).toMatchObject({
      grounded: false,
      sourceChunkIds: [],
      protectionAction: 'fallback',
    })
  })
})
