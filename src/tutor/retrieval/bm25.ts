import type { CorpusChunk } from '../corpus/schema'
import { filterCorpusChunks, hasEffectiveFilters } from './filters'
import { tokenize } from './tokenizer'
import type {
  RankedCandidate,
  RetrievalCorpus,
  RetrievalRequest,
  RetrievalResponse,
  Retriever,
} from './types'

export interface Bm25Configuration {
  k1: number
  b: number
}

export const DEFAULT_BM25_CONFIGURATION: Bm25Configuration = { k1: 1.2, b: 0.75 }

interface IndexedDocument {
  id: string
  length: number
  termFrequency: Map<string, number>
}

function validateConfiguration(configuration: Bm25Configuration): void {
  if (!Number.isFinite(configuration.k1) || configuration.k1 <= 0) {
    throw new Error('BM25 k1 must be a finite number greater than zero.')
  }
  if (!Number.isFinite(configuration.b) || configuration.b < 0 || configuration.b > 1) {
    throw new Error('BM25 b must be a finite number between zero and one.')
  }
}

function countTerms(tokens: readonly string[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1)
  return result
}

export class Bm25Index {
  readonly configuration: Bm25Configuration
  private readonly documents: IndexedDocument[]

  constructor(chunks: readonly CorpusChunk[], configuration = DEFAULT_BM25_CONFIGURATION) {
    validateConfiguration(configuration)
    this.configuration = { ...configuration }
    const seen = new Set<string>()
    this.documents = [...chunks]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((chunk) => {
        if (seen.has(chunk.id)) throw new Error(`Duplicate retrieval document id: ${chunk.id}`)
        seen.add(chunk.id)
        const tokens = tokenize(chunk.text)
        return { id: chunk.id, length: tokens.length, termFrequency: countTerms(tokens) }
      })
  }

  search(query: string, limit: number, eligibleDocumentIds?: ReadonlySet<string>): RankedCandidate[] {
    if (limit <= 0) return []
    const queryTerms = [...new Set(tokenize(query))]
    if (queryTerms.length === 0) return []

    const eligible = eligibleDocumentIds
      ? this.documents.filter((document) => eligibleDocumentIds.has(document.id))
      : this.documents
    if (eligible.length === 0) return []

    const averageLength =
      eligible.reduce((total, document) => total + document.length, 0) / eligible.length || 1
    const documentFrequency = new Map<string, number>()
    for (const term of queryTerms) {
      documentFrequency.set(
        term,
        eligible.reduce(
          (count, document) => count + (document.termFrequency.has(term) ? 1 : 0),
          0,
        ),
      )
    }

    const scored = eligible.flatMap((document) => {
      let score = 0
      for (const term of queryTerms) {
        const frequency = document.termFrequency.get(term) ?? 0
        if (frequency === 0) continue
        const df = documentFrequency.get(term) ?? 0
        const inverseDocumentFrequency = Math.log(
          1 + (eligible.length - df + 0.5) / (df + 0.5),
        )
        const denominator =
          frequency +
          this.configuration.k1 *
            (1 - this.configuration.b + this.configuration.b * (document.length / averageLength))
        score += inverseDocumentFrequency * ((frequency * (this.configuration.k1 + 1)) / denominator)
      }
      return score > 0 ? [{ documentId: document.id, score }] : []
    })

    return scored
      .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
      .slice(0, limit)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
  }
}

function normalizedLimit(value: number | undefined): number {
  if (value === undefined) return 5
  if (!Number.isFinite(value)) return 5
  return Math.min(100, Math.max(0, Math.floor(value)))
}

function chunkMap(chunks: readonly CorpusChunk[]): Map<string, CorpusChunk> {
  return new Map(chunks.map((chunk) => [chunk.id, chunk]))
}

export class Bm25Retriever implements Retriever {
  readonly method = 'bm25' as const
  private readonly index: Bm25Index
  private readonly chunksById: Map<string, CorpusChunk>

  constructor(
    private readonly corpus: RetrievalCorpus,
    configuration: Bm25Configuration = DEFAULT_BM25_CONFIGURATION,
  ) {
    this.index = new Bm25Index(corpus.chunks, configuration)
    this.chunksById = chunkMap(corpus.chunks)
  }

  retrieve(request: RetrievalRequest): RetrievalResponse {
    const limit = normalizedLimit(request.limit)
    const eligible = filterCorpusChunks(this.corpus.chunks, request.filters)
    const eligibleIds = new Set(eligible.map((chunk) => chunk.id))
    const ranking = this.index.search(request.query, limit, eligibleIds)
    const warnings: string[] = []
    if (tokenize(request.query).length === 0) warnings.push('empty_query')
    else if (ranking.length === 0) warnings.push('no_lexical_evidence')

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
              bm25: { rank: candidate.rank, rawScore: candidate.score },
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
          k1: this.index.configuration.k1,
          b: this.index.configuration.b,
          tokenizer: 'unicode_nfd_lower_stopwords_v1',
        },
        components: [
          {
            component: 'bm25',
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
