import { describe, expect, it } from 'vitest'
import { buildOrUpdateDenseIndex, DenseRetriever } from './dense'
import type { EmbeddingDescriptor, EmbeddingProvider } from './embeddings'
import { testChunk, testCorpus } from './testFixtures'

class ControlledEmbeddingProvider implements EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor = {
    providerId: 'controlled-test-double',
    modelId: 'two-dimensional-map',
    modelVersion: '1',
    dimensions: 2,
    normalization: 'l2',
    deterministic: true,
    configurationDigest: 'controlled-v1',
  }

  embed(text: string): number[] {
    if (text === 'documento alfa') return [1, 0]
    if (text === 'documento beta') return [0, 1]
    if (text === 'consulta alfa') return [0.9, 0.1]
    return [0, 0]
  }

  embedBatch(texts: readonly string[]): number[][] {
    return texts.map((text) => this.embed(text))
  }
}

describe('dense retrieval contract', () => {
  it('uses a substitutable deterministic provider and ranks by cosine similarity', () => {
    const chunks = [testChunk('alpha', 'documento alfa'), testChunk('beta', 'documento beta')]
    const corpus = testCorpus(chunks)
    const provider = new ControlledEmbeddingProvider()
    const build = buildOrUpdateDenseIndex(chunks, corpus.corpusDigest, provider)
    const response = new DenseRetriever(corpus, provider, build.index).retrieve({
      query: 'consulta alfa',
      limit: 2,
    })

    expect(response.items.map((item) => item.documentId)).toEqual(['alpha', 'beta'])
    expect(response.items[0].componentRanks.dense).toMatchObject({ rank: 1 })
    expect(response.audit.configuration.providerId).toBe('controlled-test-double')
  })

  it('rejects invalid dimensions from a provider instead of corrupting the index', () => {
    const provider = new ControlledEmbeddingProvider()
    const invalidProvider: EmbeddingProvider = {
      descriptor: provider.descriptor,
      embed: () => [1],
      embedBatch: () => [[1]],
    }
    expect(() =>
      buildOrUpdateDenseIndex([testChunk('alpha', 'documento alfa')], 'digest', invalidProvider),
    ).toThrow(/dimension mismatch/i)
  })
})
