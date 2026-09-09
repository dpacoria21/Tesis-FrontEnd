import { describe, expect, it } from 'vitest'
import { BENCHMARK_CASES } from './cases'
import { BENCHMARK_METHODS, runRetrievalBenchmark } from './runner'

describe('runner del benchmark de recuperación', () => {
  it('ejecuta las cuatro variantes y conserva resultados crudos auditables', () => {
    let clock = 0
    const result = runRetrievalBenchmark({
      runAt: '2026-09-03T01:00:00-05:00',
      repetitions: 2,
      now: () => {
        clock += 0.25
        return clock
      },
    })

    expect(result.raw).toHaveLength(BENCHMARK_CASES.length * BENCHMARK_METHODS.length)
    expect(result.summary.map((entry) => entry.method)).toEqual(BENCHMARK_METHODS)
    expect(result.raw.every((entry) => entry.latenciesMs.length === 2)).toBe(true)
    expect(result.raw.every((entry) => entry.rankings.every((rank) => rank.rank > 0))).toBe(true)
    expect(result.reproducibility.stableCorpusSnapshot).toBe(true)
    expect(result.reproducibility.stableDenseIndex).toBe(true)
    expect(result.reproducibility.firstIngestion.processedCount).toBe(6)
    expect(result.reproducibility.secondIngestion.omittedCount).toBe(6)
    expect(result.reproducibility.firstDenseIndex.generatedCount).toBe(42)
    expect(result.reproducibility.secondDenseIndex.reusedCount).toBe(42)
  })

  it('aplica sin contaminación los filtros solo en la variante declarada', () => {
    const result = runRetrievalBenchmark({
      runAt: '2026-09-03T01:00:00-05:00',
      repetitions: 1,
      now: () => 1,
    })
    const filtered = result.raw.filter((entry) => entry.method === 'hybrid_rrf_filtered')
    expect(filtered.every((entry) => entry.filterPrecision === 1)).toBe(true)
    expect(
      result.raw
        .filter((entry) => entry.method !== 'hybrid_rrf_filtered')
        .every((entry) => entry.filterPrecision === null),
    ).toBe(true)
  })
})

