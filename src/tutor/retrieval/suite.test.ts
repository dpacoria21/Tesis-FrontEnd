import { describe, expect, it } from 'vitest'
import { DEMONSTRATION_CORPUS, DEMONSTRATION_CORPUS_MANIFEST } from '../corpus/fixture'
import { ingestCorpus } from '../corpus/ingest'
import { createRetrievalSuite } from './suite'
import type { RetrievalMethod } from './types'

const identity = {
  corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
  corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
}

function fixtureSnapshot() {
  return ingestCorpus(DEMONSTRATION_CORPUS, identity).snapshot
}

describe('retrieval suite integration', () => {
  it('executes all four variants through one common contract', () => {
    const suite = createRetrievalSuite(fixtureSnapshot())
    const methods: RetrievalMethod[] = [
      'bm25',
      'dense',
      'hybrid_rrf',
      'hybrid_rrf_filtered',
    ]

    for (const method of methods) {
      const response = suite.retrieve(method, {
        query: '¿Cómo mantengo el balance de un prefijo de paréntesis?',
        limit: 3,
      })
      expect(response.method).toBe(method)
      expect(response.items.length).toBeGreaterThan(0)
      expect(response.items.length).toBeLessThanOrEqual(3)
      expect(response.audit.method).toBe(method)
      expect(response.audit.corpusDigest).toBe(suite.corpus.corpusDigest)
      expect(response.items[0].source.synthetic).toBe(true)
      expect(response.items[0].fragment.length).toBeGreaterThan(0)
    }
  })

  it('applies combined metadata filters before both hybrid retrievers', () => {
    const suite = createRetrievalSuite(fixtureSnapshot())
    const problemId = 'kd_demo-parentesis-laboratorio_377ec47c7f0e6e28'
    const response = suite.retrieve('hybrid_rrf_filtered', {
      query: 'balance apertura cierre pasos',
      limit: 5,
      filters: {
        topicsAny: ['pilas'],
        tagsAny: ['strings'],
        rating: { min: 900, max: 1000 },
        difficultyBands: ['basic'],
        contentTypes: ['strategy'],
        languages: ['es'],
        programmingLanguagesAny: ['cpp17'],
        problemIds: [problemId],
        accessLevels: ['guided'],
      },
    })

    expect(response.audit.filters).toMatchObject({ applied: true, eligibleDocumentCount: 1 })
    expect(response.items).toHaveLength(1)
    expect(response.items[0].metadata).toMatchObject({
      problemId,
      contentType: 'strategy',
      accessLevel: 'guided',
    })
    expect(response.items[0].componentRanks.bm25?.rrfContribution).toBeGreaterThan(0)
    expect(response.items[0].componentRanks.dense?.rrfContribution).toBeGreaterThan(0)
  })

  it('keeps the unfiltered hybrid variant distinct and records ignored filters', () => {
    const suite = createRetrievalSuite(fixtureSnapshot())
    const response = suite.retrieve('hybrid_rrf', {
      query: 'grafos bfs',
      filters: { problemIds: ['does-not-exist'] },
    })

    expect(response.items.length).toBeGreaterThan(0)
    expect(response.audit.filters.applied).toBe(false)
    expect(response.audit.warnings).toContain('filters_ignored_for_unfiltered_variant')
  })

  it('returns an empty but fully auditable response when filters remove all evidence', () => {
    const suite = createRetrievalSuite(fixtureSnapshot())
    const response = suite.retrieve('hybrid_rrf_filtered', {
      query: 'ventana',
      limit: 5,
      filters: { problemIds: ['does-not-exist'] },
    })

    expect(response.items).toEqual([])
    expect(response.audit.filters).toMatchObject({ applied: true, eligibleDocumentCount: 0 })
    expect(response.audit.components).toHaveLength(2)
    expect(response.audit.components.every((component) => component.returnedCount === 0)).toBe(true)
    expect(response.audit.warnings).toContain('no_retrieval_evidence')
  })

  it('exposes stable component ranks without summing incompatible raw scores', () => {
    const suite = createRetrievalSuite(fixtureSnapshot(), { rrfKappa: 60 })
    const response = suite.retrieve('hybrid_rrf', {
      query: 'ventana deslizante con dos punteros',
      limit: 3,
    })

    expect(response.audit.configuration).toMatchObject({
      kappa: 60,
      fusion: 'reciprocal_rank_fusion_1_based',
    })
    for (const item of response.items) {
      const contribution = Object.values(item.componentRanks).reduce(
        (sum, trace) => sum + (trace?.rrfContribution ?? 0),
        0,
      )
      expect(item.score).toBeCloseTo(contribution, 12)
    }
  })
})
