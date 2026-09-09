import { describe, expect, it } from 'vitest'
import { Bm25Index, Bm25Retriever } from './bm25'
import { testChunk, testCorpus } from './testFixtures'

describe('BM25 retrieval', () => {
  it('ranks a controlled lexical match first and exposes its raw score', () => {
    const chunks = [
      testChunk('doc-a', 'ventana punteros presupuesto'),
      testChunk('doc-b', 'ventana presupuesto'),
      testChunk('doc-c', 'grafo cola visitados'),
    ]
    const ranking = new Bm25Index(chunks).search('ventana dos punteros', 3)

    expect(ranking[0].documentId).toBe('doc-a')
    expect(ranking[0].rank).toBe(1)
    expect(ranking[0].score).toBeGreaterThan(ranking[1].score)
  })

  it('uses document id as the final deterministic tie-breaker', () => {
    const chunks = [testChunk('doc-b', 'balance prefijo'), testChunk('doc-a', 'balance prefijo')]
    expect(new Bm25Index(chunks).search('balance', 2).map((item) => item.documentId)).toEqual([
      'doc-a',
      'doc-b',
    ])
  })

  it('returns an empty auditable contract when no lexical evidence exists', () => {
    const corpus = testCorpus([testChunk('doc-a', 'arreglo maximo')])
    const response = new Bm25Retriever(corpus).retrieve({ query: 'xilofono', limit: 5 })

    expect(response.items).toEqual([])
    expect(response.audit.warnings).toContain('no_lexical_evidence')
    expect(response.audit.components[0].ranking).toEqual([])
  })
})
