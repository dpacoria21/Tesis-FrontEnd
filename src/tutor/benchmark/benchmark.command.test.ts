import { describe, expect, it } from 'vitest'
import { runFullTutorBenchmark } from './fullRunner'

describe('comando reproducible del benchmark', () => {
  it('emite el resultado crudo y su resumen calculado', async () => {
    const result = await runFullTutorBenchmark({
      runAt: new Date().toISOString(),
      repetitions: 20,
      topK: 10,
    })
    expect(result.retrieval.raw).toHaveLength(100)
    expect(result.retrieval.summary).toHaveLength(4)
    expect(result.retrieval.reproducibility.stableCorpusSnapshot).toBe(true)
    expect(result.retrieval.reproducibility.stableDenseIndex).toBe(true)
    expect(result.safety.restrictedCaseCount).toBe(5)
    console.info(`TUTOR_BENCHMARK_RESULT ${JSON.stringify(result)}`)
  })
})
