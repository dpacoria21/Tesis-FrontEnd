import { describe, expect, it } from 'vitest'
import { DEMONSTRATION_CORPUS, DEMONSTRATION_CORPUS_MANIFEST } from '../corpus/fixture'
import { ingestCorpus } from '../corpus/ingest'
import { buildCorpusChunks } from '../corpus/schema'
import {
  BENCHMARK_CASES,
  BENCHMARK_CASESET_FROZEN_AT,
  BENCHMARK_CATEGORY_COUNTS,
} from './cases'

describe('conjunto prefijado del benchmark', () => {
  it('conserva entre 20 y 30 casos y la distribución declarada', () => {
    expect(BENCHMARK_CASES).toHaveLength(25)
    expect(BENCHMARK_CATEGORY_COUNTS).toEqual({
      conceptual_retrieval: 6,
      problem_search: 4,
      strategy: 5,
      debugging: 5,
      adversarial: 5,
    })
    expect(Number.isNaN(Date.parse(BENCHMARK_CASESET_FROZEN_AT))).toBe(false)
  })

  it('usa IDs y consultas únicas con juicios explícitos', () => {
    expect(new Set(BENCHMARK_CASES.map((entry) => entry.id)).size).toBe(BENCHMARK_CASES.length)
    expect(new Set(BENCHMARK_CASES.map((entry) => entry.query)).size).toBe(BENCHMARK_CASES.length)
    for (const benchmarkCase of BENCHMARK_CASES) {
      expect(benchmarkCase.query.trim().length).toBeGreaterThan(10)
      expect(benchmarkCase.judgmentProvenance.trim().length).toBeGreaterThan(10)
    }
  })

  it('reserva ausencia de evidencia solo para casos prudentes', () => {
    const emptyCases = BENCHMARK_CASES.filter((entry) => entry.relevantChunkIds.length === 0)
    expect(emptyCases).toHaveLength(1)
    expect(emptyCases[0].expectedPedagogy.shouldBePrudentWithoutEvidence).toBe(true)
  })

  it('fija juicios únicamente sobre chunks existentes del fixture', () => {
    const ingestion = ingestCorpus(DEMONSTRATION_CORPUS, {
      corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
      corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
    })
    const chunkIds = new Set(buildCorpusChunks(ingestion.snapshot.documents).map((entry) => entry.id))
    const judgedIds = BENCHMARK_CASES.flatMap((entry) => entry.relevantChunkIds)
    expect(judgedIds.every((id) => chunkIds.has(id))).toBe(true)
  })
})
