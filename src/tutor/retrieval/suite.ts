import { buildCorpusChunks, stableDigest } from '../corpus/schema'
import type { CorpusSnapshot } from '../corpus/ingest'
import { Bm25Retriever, type Bm25Configuration } from './bm25'
import {
  buildOrUpdateDenseIndex,
  DenseRetriever,
  type DenseIndex,
  type DenseIndexBuildReport,
} from './dense'
import { DeterministicEmbeddingProvider, type EmbeddingProvider } from './embeddings'
import { HybridRrfRetriever } from './hybrid'
import type {
  RetrievalCorpus,
  RetrievalMethod,
  RetrievalRequest,
  RetrievalResponse,
  Retriever,
} from './types'

export interface RetrievalSuiteOptions {
  embeddingProvider?: EmbeddingProvider
  previousDenseIndex?: DenseIndex
  bm25?: Bm25Configuration
  rrfKappa?: number
  candidateMultiplier?: number
}

export interface RetrievalSuite {
  corpus: RetrievalCorpus
  denseIndex: DenseIndex
  denseIndexReport: DenseIndexBuildReport
  retrievers: Record<RetrievalMethod, Retriever>
  retrieve(method: RetrievalMethod, request: RetrievalRequest): RetrievalResponse
}

export function createRetrievalSuite(
  snapshot: CorpusSnapshot,
  options: RetrievalSuiteOptions = {},
): RetrievalSuite {
  const chunks = buildCorpusChunks(snapshot.documents)
  const corpusDigest = stableDigest({
    snapshotDigest: snapshot.snapshotDigest,
    chunks: chunks.map((chunk) => ({ id: chunk.id, digest: chunk.contentDigest })),
  })
  const corpus: RetrievalCorpus = {
    corpusId: snapshot.corpusId,
    corpusVersion: snapshot.corpusVersion,
    corpusDigest,
    chunks,
  }
  const provider = options.embeddingProvider ?? new DeterministicEmbeddingProvider()
  const denseBuild = buildOrUpdateDenseIndex(
    chunks,
    corpusDigest,
    provider,
    options.previousDenseIndex,
  )
  const bm25 = new Bm25Retriever(corpus, options.bm25)
  const dense = new DenseRetriever(corpus, provider, denseBuild.index)
  const hybridRrf = new HybridRrfRetriever(corpus, provider, denseBuild.index, {
    bm25: options.bm25,
    kappa: options.rrfKappa,
    candidateMultiplier: options.candidateMultiplier,
    filtersEnabled: false,
  })
  const hybridRrfFiltered = new HybridRrfRetriever(corpus, provider, denseBuild.index, {
    bm25: options.bm25,
    kappa: options.rrfKappa,
    candidateMultiplier: options.candidateMultiplier,
    filtersEnabled: true,
  })
  const retrievers: Record<RetrievalMethod, Retriever> = {
    bm25,
    dense,
    hybrid_rrf: hybridRrf,
    hybrid_rrf_filtered: hybridRrfFiltered,
  }

  return {
    corpus,
    denseIndex: denseBuild.index,
    denseIndexReport: denseBuild.report,
    retrievers,
    retrieve(method, request) {
      return retrievers[method].retrieve(request)
    },
  }
}
