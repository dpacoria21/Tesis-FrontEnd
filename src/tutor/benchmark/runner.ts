import {
  DEMONSTRATION_CORPUS,
  DEMONSTRATION_CORPUS_MANIFEST,
} from '../corpus/fixture'
import { ingestCorpus, type IngestionReport } from '../corpus/ingest'
import type {
  DifficultyBand,
  KnowledgeContentType,
} from '../corpus/schema'
import {
  createRetrievalSuite,
  type DenseIndexBuildReport,
  type RetrievedEvidence,
  type RetrievalFilters,
  type RetrievalMethod,
} from '../retrieval'
import {
  BENCHMARK_CASES,
  BENCHMARK_CASESET_FROZEN_AT,
  BENCHMARK_CASESET_VERSION,
  type BenchmarkCase,
} from './cases'
import {
  evaluateRanking,
  macroMean,
  nearestRankPercentile,
  type RetrievalMetrics,
} from './metrics'

export const BENCHMARK_METHODS: readonly RetrievalMethod[] = [
  'bm25',
  'dense',
  'hybrid_rrf',
  'hybrid_rrf_filtered',
] as const

export interface BenchmarkRunOptions {
  runAt: string
  repetitions?: number
  topK?: number
  now?: () => number
}

export interface RawRetrievalCaseResult {
  caseId: string
  category: BenchmarkCase['category']
  method: RetrievalMethod
  relevantChunkIds: string[]
  rankedChunkIds: string[]
  rankings: Array<{
    chunkId: string
    rank: number
    score: number
    bm25Rank: number | null
    denseRank: number | null
  }>
  metrics: RetrievalMetrics
  filterPrecision: number | null
  latenciesMs: number[]
  warnings: string[]
}

export interface RetrievalMethodSummary {
  method: RetrievalMethod
  evaluableCases: number
  recallAt5: number | null
  recallAt10: number | null
  mrrAt10: number | null
  ndcgAt10: number | null
  filterPrecision: number | null
  latencyP50Ms: number | null
  latencyP95Ms: number | null
}

export interface TutorRetrievalBenchmarkResult {
  schemaVersion: 1
  benchmarkVersion: typeof BENCHMARK_CASESET_VERSION
  judgmentsFrozenAt: typeof BENCHMARK_CASESET_FROZEN_AT
  runAt: string
  configuration: {
    corpusId: string
    corpusVersion: string
    corpusDigest: string
    caseCount: number
    repetitions: number
    topK: number
    methods: readonly RetrievalMethod[]
    bm25K1: number
    bm25B: number
    rrfKappa: number
    embeddingProvider: string
    embeddingModel: string
    embeddingVersion: string
    embeddingDimensions: number
  }
  reproducibility: {
    firstIngestion: IngestionReport
    secondIngestion: IngestionReport
    firstDenseIndex: DenseIndexBuildReport
    secondDenseIndex: DenseIndexBuildReport
    stableCorpusSnapshot: boolean
    stableDenseIndex: boolean
  }
  raw: RawRetrievalCaseResult[]
  summary: RetrievalMethodSummary[]
}

function mapFilters(benchmarkCase: BenchmarkCase): RetrievalFilters {
  return {
    ...(benchmarkCase.filters.language
      ? { languages: [benchmarkCase.filters.language] }
      : {}),
    ...(benchmarkCase.filters.topics
      ? { topicsAny: [...benchmarkCase.filters.topics] }
      : {}),
    ...(benchmarkCase.filters.tags
      ? { tagsAny: [...benchmarkCase.filters.tags] }
      : {}),
    ...(benchmarkCase.filters.difficulty
      ? {
          difficultyBands: benchmarkCase.filters
            .difficulty as DifficultyBand[],
        }
      : {}),
    ...(benchmarkCase.filters.contentTypes
      ? {
          contentTypes: benchmarkCase.filters
            .contentTypes as KnowledgeContentType[],
        }
      : {}),
    ...(benchmarkCase.filters.problemId
      ? { problemIds: [benchmarkCase.filters.problemId] }
      : {}),
  }
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('es-PE')
}

function intersects(actual: readonly string[], expected: readonly string[]): boolean {
  const actualValues = new Set(actual.map(normalized))
  return expected.some((value) => actualValues.has(normalized(value)))
}

function matchesFilters(item: RetrievedEvidence, filters: RetrievalFilters): boolean {
  if (filters.languages && !filters.languages.map(normalized).includes(normalized(item.metadata.language))) {
    return false
  }
  if (filters.topicsAny && !intersects(item.metadata.topics, filters.topicsAny)) return false
  if (filters.tagsAny && !intersects(item.metadata.tags, filters.tagsAny)) return false
  if (filters.difficultyBands && !filters.difficultyBands.includes(item.metadata.difficulty)) {
    return false
  }
  if (filters.contentTypes && !filters.contentTypes.includes(item.metadata.contentType)) {
    return false
  }
  if (filters.problemIds && !filters.problemIds.includes(item.problemId)) return false
  return true
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function summarize(
  method: RetrievalMethod,
  raw: readonly RawRetrievalCaseResult[],
): RetrievalMethodSummary {
  const entries = raw.filter((entry) => entry.method === method)
  const latencies = entries.flatMap((entry) => entry.latenciesMs)
  return {
    method,
    evaluableCases: entries.filter((entry) => entry.metrics.recallAt5 !== null).length,
    recallAt5: macroMean(entries.map((entry) => entry.metrics.recallAt5)),
    recallAt10: macroMean(entries.map((entry) => entry.metrics.recallAt10)),
    mrrAt10: macroMean(entries.map((entry) => entry.metrics.reciprocalRankAt10)),
    ndcgAt10: macroMean(entries.map((entry) => entry.metrics.ndcgAt10)),
    filterPrecision: macroMean(entries.map((entry) => entry.filterPrecision)),
    latencyP50Ms: nearestRankPercentile(latencies, 0.5),
    latencyP95Ms: nearestRankPercentile(latencies, 0.95),
  }
}

export function runRetrievalBenchmark(
  options: BenchmarkRunOptions,
): TutorRetrievalBenchmarkResult {
  if (!Number.isFinite(Date.parse(options.runAt))) throw new Error('runAt must be an ISO timestamp')
  const repetitions = Math.max(1, Math.floor(options.repetitions ?? 5))
  const topK = Math.max(1, Math.floor(options.topK ?? 10))
  const now = options.now ?? (() => performance.now())
  const identity = {
    corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
    corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
  }
  const firstIngestion = ingestCorpus(DEMONSTRATION_CORPUS, identity)
  const firstSuite = createRetrievalSuite(firstIngestion.snapshot)
  const secondIngestion = ingestCorpus(
    DEMONSTRATION_CORPUS,
    identity,
    firstIngestion.snapshot,
  )
  const suite = createRetrievalSuite(secondIngestion.snapshot, {
    previousDenseIndex: firstSuite.denseIndex,
  })

  const raw: RawRetrievalCaseResult[] = []
  for (const benchmarkCase of BENCHMARK_CASES) {
    const filters = mapFilters(benchmarkCase)
    for (const method of BENCHMARK_METHODS) {
      const request = {
        query: benchmarkCase.query,
        limit: topK,
        ...(method === 'hybrid_rrf_filtered' ? { filters } : {}),
      }

      // Warm-up is excluded from latency statistics but uses the exact request.
      const warmup = suite.retrieve(method, request)
      const latenciesMs: number[] = []
      let response = warmup
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        const start = now()
        response = suite.retrieve(method, request)
        latenciesMs.push(rounded(Math.max(0, now() - start)))
      }
      const relevantIds = new Set(benchmarkCase.relevantChunkIds)
      const rankedChunkIds = response.items.map((item) => item.documentId)
      const filtered = method === 'hybrid_rrf_filtered'
      const filterPrecision = filtered
        ? response.items.length === 0
          ? 1
          : rounded(
              response.items.filter((item) => matchesFilters(item, filters)).length /
                response.items.length,
            )
        : null

      raw.push({
        caseId: benchmarkCase.id,
        category: benchmarkCase.category,
        method,
        relevantChunkIds: [...benchmarkCase.relevantChunkIds],
        rankedChunkIds,
        rankings: response.items.map((item) => ({
          chunkId: item.documentId,
          rank: item.rank,
          score: item.score,
          bm25Rank: item.componentRanks.bm25?.rank ?? null,
          denseRank: item.componentRanks.dense?.rank ?? null,
        })),
        metrics: evaluateRanking({ rankedIds: rankedChunkIds, relevantIds }),
        filterPrecision,
        latenciesMs,
        warnings: [...response.audit.warnings],
      })
    }
  }

  const descriptor = suite.denseIndex.embedding
  return {
    schemaVersion: 1,
    benchmarkVersion: BENCHMARK_CASESET_VERSION,
    judgmentsFrozenAt: BENCHMARK_CASESET_FROZEN_AT,
    runAt: options.runAt,
    configuration: {
      corpusId: suite.corpus.corpusId,
      corpusVersion: suite.corpus.corpusVersion,
      corpusDigest: suite.corpus.corpusDigest,
      caseCount: BENCHMARK_CASES.length,
      repetitions,
      topK,
      methods: BENCHMARK_METHODS,
      bm25K1: 1.2,
      bm25B: 0.75,
      rrfKappa: 60,
      embeddingProvider: descriptor.providerId,
      embeddingModel: descriptor.modelId,
      embeddingVersion: descriptor.modelVersion,
      embeddingDimensions: descriptor.dimensions,
    },
    reproducibility: {
      firstIngestion: firstIngestion.report,
      secondIngestion: secondIngestion.report,
      firstDenseIndex: firstSuite.denseIndexReport,
      secondDenseIndex: suite.denseIndexReport,
      stableCorpusSnapshot:
        firstIngestion.snapshot.snapshotDigest ===
        secondIngestion.snapshot.snapshotDigest,
      stableDenseIndex:
        firstSuite.denseIndex.indexDigest === suite.denseIndex.indexDigest,
    },
    raw,
    summary: BENCHMARK_METHODS.map((method) => summarize(method, raw)),
  }
}

