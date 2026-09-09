import { stableDigest, type CorpusChunk } from '../corpus/schema'
import { filterCorpusChunks, hasEffectiveFilters } from './filters'
import {
  assertValidEmbedding,
  cosineSimilarity,
  type EmbeddingDescriptor,
  type EmbeddingProvider,
} from './embeddings'
import type {
  RankedCandidate,
  RetrievalCorpus,
  RetrievalRequest,
  RetrievalResponse,
  Retriever,
} from './types'

export const DENSE_INDEX_SCHEMA_VERSION = 1 as const

export interface DenseIndexEntry {
  documentId: string
  embeddingInputDigest: string
  vector: number[]
}

export interface DenseIndex {
  schemaVersion: typeof DENSE_INDEX_SCHEMA_VERSION
  corpusDigest: string
  embedding: EmbeddingDescriptor
  entries: DenseIndexEntry[]
  indexDigest: string
}

export interface DenseIndexBuildReport {
  generatedCount: number
  reusedCount: number
  removedCount: number
  totalCount: number
  reconfigured: boolean
  embedding: EmbeddingDescriptor
  indexDigest: string
}

export interface DenseIndexBuildResult {
  index: DenseIndex
  report: DenseIndexBuildReport
}

function embeddingInputDigest(chunk: CorpusChunk): string {
  return stableDigest({ documentId: chunk.id, text: chunk.text })
}

function cloneDescriptor(descriptor: EmbeddingDescriptor): EmbeddingDescriptor {
  return { ...descriptor }
}

function compatibleEmbedding(
  previous: DenseIndex | undefined,
  descriptor: EmbeddingDescriptor,
): boolean {
  return (
    previous !== undefined &&
    previous.schemaVersion === DENSE_INDEX_SCHEMA_VERSION &&
    previous.embedding.configurationDigest === descriptor.configurationDigest &&
    previous.embedding.dimensions === descriptor.dimensions &&
    previous.embedding.providerId === descriptor.providerId &&
    previous.embedding.modelId === descriptor.modelId &&
    previous.embedding.modelVersion === descriptor.modelVersion
  )
}

export function buildOrUpdateDenseIndex(
  chunks: readonly CorpusChunk[],
  corpusDigest: string,
  provider: EmbeddingProvider,
  previous?: DenseIndex,
): DenseIndexBuildResult {
  const seen = new Set<string>()
  const orderedChunks = [...chunks].sort((left, right) => left.id.localeCompare(right.id))
  for (const chunk of orderedChunks) {
    if (seen.has(chunk.id)) throw new Error(`Duplicate retrieval document id: ${chunk.id}`)
    seen.add(chunk.id)
  }

  const canReuse = compatibleEmbedding(previous, provider.descriptor)
  const previousById = canReuse
    ? new Map(previous?.entries.map((entry) => [entry.documentId, entry]))
    : new Map<string, DenseIndexEntry>()
  let generatedCount = 0
  let reusedCount = 0

  const entries = orderedChunks.map((chunk) => {
    const digest = embeddingInputDigest(chunk)
    const existing = previousById.get(chunk.id)
    if (existing?.embeddingInputDigest === digest) {
      assertValidEmbedding(existing.vector, provider.descriptor)
      reusedCount += 1
      return { ...existing, vector: [...existing.vector] }
    }

    const vector = provider.embed(chunk.text)
    assertValidEmbedding(vector, provider.descriptor)
    generatedCount += 1
    return { documentId: chunk.id, embeddingInputDigest: digest, vector: [...vector] }
  })

  const existingIds = new Set(orderedChunks.map((chunk) => chunk.id))
  const removedCount = previous?.entries.filter((entry) => !existingIds.has(entry.documentId)).length ?? 0
  const indexPayload = {
    schemaVersion: DENSE_INDEX_SCHEMA_VERSION,
    corpusDigest,
    embedding: provider.descriptor,
    entries,
  }
  const indexDigest = stableDigest(indexPayload)
  const index: DenseIndex = {
    ...indexPayload,
    embedding: cloneDescriptor(provider.descriptor),
    indexDigest,
  }

  return {
    index,
    report: {
      generatedCount,
      reusedCount,
      removedCount,
      totalCount: entries.length,
      reconfigured: previous !== undefined && !canReuse,
      embedding: cloneDescriptor(provider.descriptor),
      indexDigest,
    },
  }
}

export class DenseVectorIndex {
  constructor(private readonly index: DenseIndex) {}

  search(
    queryVector: readonly number[],
    limit: number,
    eligibleDocumentIds?: ReadonlySet<string>,
  ): RankedCandidate[] {
    assertValidEmbedding(queryVector, this.index.embedding)
    if (limit <= 0) return []
    return this.index.entries
      .filter((entry) => !eligibleDocumentIds || eligibleDocumentIds.has(entry.documentId))
      .flatMap((entry) => {
        const score = cosineSimilarity(queryVector, entry.vector)
        return score > 0 ? [{ documentId: entry.documentId, score }] : []
      })
      .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
      .slice(0, limit)
      .map((candidate, position) => ({ ...candidate, rank: position + 1 }))
  }
}

function normalizedLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 5
  return Math.min(100, Math.max(0, Math.floor(value)))
}

export class DenseRetriever implements Retriever {
  readonly method = 'dense' as const
  private readonly vectorIndex: DenseVectorIndex
  private readonly chunksById: Map<string, CorpusChunk>

  constructor(
    private readonly corpus: RetrievalCorpus,
    private readonly provider: EmbeddingProvider,
    private readonly index: DenseIndex,
  ) {
    if (!compatibleEmbedding(index, provider.descriptor)) {
      throw new Error('Dense index and embedding provider configurations are incompatible.')
    }
    if (index.corpusDigest !== corpus.corpusDigest) {
      throw new Error('Dense index does not match the retrieval corpus digest.')
    }
    this.vectorIndex = new DenseVectorIndex(index)
    this.chunksById = new Map(corpus.chunks.map((chunk) => [chunk.id, chunk]))
  }

  retrieve(request: RetrievalRequest): RetrievalResponse {
    const limit = normalizedLimit(request.limit)
    const eligible = filterCorpusChunks(this.corpus.chunks, request.filters)
    const eligibleIds = new Set(eligible.map((chunk) => chunk.id))
    const queryVector = this.provider.embed(request.query)
    assertValidEmbedding(queryVector, this.provider.descriptor)
    const ranking = this.vectorIndex.search(queryVector, limit, eligibleIds)
    const warnings: string[] = []
    if (queryVector.every((value) => value === 0)) warnings.push('empty_query_embedding')
    else if (ranking.length === 0) warnings.push('no_dense_evidence')

    return {
      method: this.method,
      items: ranking.flatMap((candidate) => {
        const chunk = this.chunksById.get(candidate.documentId)
        if (!chunk) return []
        return [
          {
            rank: candidate.rank,
            documentId: chunk.id,
            problemId: chunk.documentId,
            score: candidate.score,
            componentRanks: {
              dense: { rank: candidate.rank, rawScore: candidate.score },
            },
            source: { ...chunk.source },
            metadata: { ...chunk.metadata },
            fragment: chunk.text,
          },
        ]
      }),
      audit: {
        method: this.method,
        corpusId: this.corpus.corpusId,
        corpusVersion: this.corpus.corpusVersion,
        corpusDigest: this.corpus.corpusDigest,
        query: request.query,
        requestedLimit: limit,
        candidateLimit: limit,
        filters: {
          requested: request.filters ?? null,
          applied: hasEffectiveFilters(request.filters),
          inputDocumentCount: this.corpus.chunks.length,
          eligibleDocumentCount: eligible.length,
        },
        configuration: {
          providerId: this.provider.descriptor.providerId,
          modelId: this.provider.descriptor.modelId,
          modelVersion: this.provider.descriptor.modelVersion,
          dimensions: this.provider.descriptor.dimensions,
          normalization: this.provider.descriptor.normalization,
          configurationDigest: this.provider.descriptor.configurationDigest,
          deterministic: this.provider.descriptor.deterministic,
          indexDigest: this.index.indexDigest,
        },
        components: [
          {
            component: 'dense',
            returnedCount: ranking.length,
            ranking: ranking.map((candidate) => ({
              documentId: candidate.documentId,
              rank: candidate.rank,
              rawScore: candidate.score,
            })),
          },
        ],
        warnings,
      },
    }
  }
}
