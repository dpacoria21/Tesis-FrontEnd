import { describe, expect, it } from 'vitest'
import { DEMONSTRATION_CORPUS, DEMONSTRATION_CORPUS_MANIFEST } from '../corpus/fixture'
import { ingestCorpus } from '../corpus/ingest'
import { buildCorpusChunks, stableDigest } from '../corpus/schema'
import { buildOrUpdateDenseIndex } from './dense'
import { DeterministicEmbeddingProvider, vectorNorm } from './embeddings'

describe('deterministic local embeddings', () => {
  it('produces stable normalized vectors and identifies its configuration', () => {
    const firstProvider = new DeterministicEmbeddingProvider()
    const secondProvider = new DeterministicEmbeddingProvider()
    const first = firstProvider.embed('recorrer un grafo con una cola BFS')
    const second = secondProvider.embed('recorrer un grafo con una cola BFS')

    expect(first).toEqual(second)
    expect(vectorNorm(first)).toBeCloseTo(1, 12)
    expect(firstProvider.descriptor).toEqual(secondProvider.descriptor)
    expect(firstProvider.descriptor).toMatchObject({
      providerId: 'local_deterministic',
      modelId: 'feature_hash_semantic_lexicon',
      modelVersion: '1.0.0',
      dimensions: 192,
      deterministic: true,
    })
    expect(firstProvider.embed('   ')).toEqual(Array<number>(192).fill(0))
  })

  it('builds the same dense index twice and reuses unchanged entries', () => {
    const identity = {
      corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
      corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
    }
    const snapshot = ingestCorpus(DEMONSTRATION_CORPUS, identity).snapshot
    const chunks = buildCorpusChunks(snapshot.documents)
    const corpusDigest = stableDigest(chunks.map((chunk) => chunk.contentDigest))
    const provider = new DeterministicEmbeddingProvider()
    const first = buildOrUpdateDenseIndex(chunks, corpusDigest, provider)
    const second = buildOrUpdateDenseIndex(chunks, corpusDigest, provider, first.index)

    expect(first.report).toMatchObject({
      generatedCount: 42,
      reusedCount: 0,
      totalCount: 42,
      reconfigured: false,
    })
    expect(second.report).toMatchObject({
      generatedCount: 0,
      reusedCount: 42,
      totalCount: 42,
      reconfigured: false,
    })
    expect(second.index).toEqual(first.index)
  })

  it('regenerates only a changed embedding input', () => {
    const identity = {
      corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
      corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
    }
    const snapshot = ingestCorpus(DEMONSTRATION_CORPUS, identity).snapshot
    const chunks = buildCorpusChunks(snapshot.documents)
    const provider = new DeterministicEmbeddingProvider()
    const first = buildOrUpdateDenseIndex(chunks, 'digest-v1', provider)
    const changed = chunks.map((chunk, index) =>
      index === 0 ? { ...chunk, text: `${chunk.text} Cambio controlado.` } : chunk,
    )
    const second = buildOrUpdateDenseIndex(changed, 'digest-v2', provider, first.index)

    expect(second.report.generatedCount).toBe(1)
    expect(second.report.reusedCount).toBe(41)
    expect(second.index.indexDigest).not.toBe(first.index.indexDigest)
  })
})
