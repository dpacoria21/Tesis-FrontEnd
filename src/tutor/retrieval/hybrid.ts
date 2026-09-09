import type { CorpusChunk } from '../corpus/schema'
import { Bm25Index, DEFAULT_BM25_CONFIGURATION, type Bm25Configuration } from './bm25'
import { DenseVectorIndex, type DenseIndex } from './dense'
import { assertValidEmbedding, type EmbeddingProvider } from './embeddings'
import { filterCorpusChunks, hasEffectiveFilters } from './filters'
import { DEFAULT_RRF_KAPPA, reciprocalRankFusion } from './rrf'
import type {
  RetrievalCorpus,
  RetrievalMethod,
  RetrievalRequest,
  RetrievalResponse,
  Retriever,
} from './types'

export interface HybridRetrieverOptions {
  kappa?: number
  candidateMultiplier?: number
  maximumCandidateLimit?: number
  bm25?: Bm25Configuration
  filtersEnabled?: boolean
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 5
  return Math.min(100, Math.max(0, Math.floor(value)))
}

export class HybridRrfRetriever implements Retriever {
  readonly method: RetrievalMethod
  private readonly bm25Index: Bm25Index
  private readonly denseIndex: DenseVectorIndex
  private readonly chunksById: Map<string, CorpusChunk>
  private readonly kappa: number
  private readonly candidateMultiplier: number
  private readonly maximumCandidateLimit: number
  private readonly filtersEnabled: boolean

  constructor(
    private readonly corpus: RetrievalCorpus,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly storedDenseIndex: DenseIndex,
    options: HybridRetrieverOptions = {},
  ) {
    this.filtersEnabled = options.filtersEnabled ?? false
    this.method = this.filtersEnabled ? 'hybrid_rrf_filtered' : 'hybrid_rrf'
    this.kappa = options.kappa ?? DEFAULT_RRF_KAPPA
    this.candidateMultiplier = options.candidateMultiplier ?? 4
    this.maximumCandidateLimit = options.maximumCandidateLimit ?? 100
    if (!Number.isFinite(this.kappa) || this.kappa < 0) {
      throw new Error('RRF kappa must be a finite non-negative number.')
    }
    if (!Number.isInteger(this.candidateMultiplier) || this.candidateMultiplier < 1) {
      throw new Error('candidateMultiplier must be a positive integer.')
    }
    if (!Number.isInteger(this.maximumCandidateLimit) || this.maximumCandidateLimit < 1) {
      throw new Error('maximumCandidateLimit must be a positive integer.')
    }
    if (storedDenseIndex.corpusDigest !== corpus.corpusDigest) {
      throw new Error('Dense index does not match the retrieval corpus digest.')
    }
    if (
      storedDenseIndex.embedding.configurationDigest !==
      embeddingProvider.descriptor.configurationDigest
    ) {
      throw new Error('Dense index and embedding provider configurations are incompatible.')
    }

    this.bm25Index = new Bm25Index(corpus.chunks, options.bm25 ?? DEFAULT_BM25_CONFIGURATION)
    this.denseIndex = new DenseVectorIndex(storedDenseIndex)
    this.chunksById = new Map(corpus.chunks.map((chunk) => [chunk.id, chunk]))
  }

  retrieve(request: RetrievalRequest): RetrievalResponse {
    const limit = normalizeLimit(request.limit)
    const effectiveFilters = this.filtersEnabled ? request.filters : undefined
    const eligible = filterCorpusChunks(this.corpus.chunks, effectiveFilters)
    const eligibleIds = new Set(eligible.map((chunk) => chunk.id))
    const candidateLimit = Math.min(
      this.maximumCandidateLimit,
      Math.max(limit, limit * this.candidateMultiplier),
    )
    const bm25Ranking = this.bm25Index.search(request.query, candidateLimit, eligibleIds)
    const queryVector = this.embeddingProvider.embed(request.query)
    assertValidEmbedding(queryVector, this.embeddingProvider.descriptor)
    const denseRanking = this.denseIndex.search(queryVector, candidateLimit, eligibleIds)
    const fused = reciprocalRankFusion(
      { bm25: bm25Ranking, dense: denseRanking },
      limit,
      { kappa: this.kappa },
    )

    const warnings: string[] = []
    if (!this.filtersEnabled && hasEffectiveFilters(request.filters)) {
      warnings.push('filters_ignored_for_unfiltered_variant')
    }
    if (bm25Ranking.length === 0) warnings.push('bm25_empty')
    if (denseRanking.length === 0) warnings.push('dense_empty')
    if (fused.length === 0) warnings.push('no_retrieval_evidence')

    return {
      method: this.method,
      items: fused.flatMap((candidate) => {
        const chunk = this.chunksById.get(candidate.documentId)
        if (!chunk) return []
        return [
          {
            rank: candidate.rank,
            documentId: chunk.id,
            problemId: chunk.documentId,
            score: candidate.score,
            componentRanks: candidate.componentRanks,
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
        candidateLimit,
        filters: {
          requested: request.filters ?? null,
          applied: this.filtersEnabled && hasEffectiveFilters(request.filters),
          inputDocumentCount: this.corpus.chunks.length,
          eligibleDocumentCount: eligible.length,
        },
        configuration: {
          kappa: this.kappa,
          fusion: 'reciprocal_rank_fusion_1_based',
          candidateMultiplier: this.candidateMultiplier,
          filtersEnabled: this.filtersEnabled,
          bm25K1: this.bm25Index.configuration.k1,
          bm25B: this.bm25Index.configuration.b,
          embeddingConfigurationDigest: this.embeddingProvider.descriptor.configurationDigest,
          denseIndexDigest: this.storedDenseIndex.indexDigest,
        },
        components: [
          {
            component: 'bm25',
            returnedCount: bm25Ranking.length,
            ranking: bm25Ranking.map((candidate) => ({
              documentId: candidate.documentId,
              rank: candidate.rank,
              rawScore: candidate.score,
            })),
          },
          {
            component: 'dense',
            returnedCount: denseRanking.length,
            ranking: denseRanking.map((candidate) => ({
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
