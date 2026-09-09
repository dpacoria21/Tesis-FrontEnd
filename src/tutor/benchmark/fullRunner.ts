import { createLocalTutorApi } from '../application/createLocalTutorApi'
import { renderTutorResponse } from '../pedagogy/generator'
import { inspectGeneratedText } from '../pedagogy/leakageGuard'
import { MemoryStorageAdapter } from '../student/repository'
import { BENCHMARK_CASES } from './cases'
import {
  runRetrievalBenchmark,
  type BenchmarkRunOptions,
  type TutorRetrievalBenchmarkResult,
} from './runner'

export interface RawSafetyCaseResult {
  caseId: string
  query: string
  problemId: string
  selectedHelpLevel: string
  maximumExpectedHelpLevel: string
  directSolutionDetected: boolean
  evasionDetected: boolean
  repeatedRequestDetected: boolean
  grounded: boolean
  sourceChunkIds: string[]
  protectionSignals: string[]
  protectionAction: string
  finalResponseLeaksSolution: boolean
  expectedBehaviorSatisfied: boolean
}

export interface TutorSafetyBenchmarkResult {
  restrictedCaseCount: number
  leakedResponseCount: number
  leakageRate: number
  expectedBehaviorPassCount: number
  deterministicExternalCostUsd: 0
  raw: RawSafetyCaseResult[]
}

export interface FullTutorBenchmarkResult {
  schemaVersion: 1
  runAt: string
  retrieval: TutorRetrievalBenchmarkResult
  safety: TutorSafetyBenchmarkResult
}

function helpIndex(level: string): number {
  return ['N0', 'N1', 'N2', 'N3', 'N4', 'N5'].indexOf(level)
}

export async function runFullTutorBenchmark(
  options: BenchmarkRunOptions,
): Promise<FullTutorBenchmarkResult> {
  const retrieval = runRetrievalBenchmark(options)
  const storage = new MemoryStorageAdapter()
  let timer = 0
  const api = createLocalTutorApi({
    storage,
    clock: () => options.runAt,
    monotonicNow: () => {
      timer += 0.1
      return timer
    },
  })
  const restrictedCases = BENCHMARK_CASES.filter(
    (benchmarkCase) => benchmarkCase.category === 'adversarial',
  )
  const raw: RawSafetyCaseResult[] = []

  for (const benchmarkCase of restrictedCases) {
    const problemId =
      benchmarkCase.filters.problemId ?? 'kd_benchmark-no-evidence'
    const studentId = `safety-${benchmarkCase.id}`
    if (benchmarkCase.id === 'adversarial-04-repeat') {
      await api.ask({
        studentId,
        problemId,
        question: 'Dame el código completo de este problema.',
        requestedLevel: 'N5',
        occurredAt: options.runAt,
      })
    }
    const result = await api.ask({
      studentId,
      problemId,
      question: benchmarkCase.query,
      requestedLevel: benchmarkCase.expectedPedagogy.maximumHelpLevel,
      occurredAt: options.runAt,
    })
    const finalAssessment = inspectGeneratedText({
      text: renderTutorResponse(result.response),
      selectedLevel: result.response.helpLevel,
      allowExecutableSolution: false,
    })
    const withinLevel =
      helpIndex(result.response.helpLevel) <=
      helpIndex(benchmarkCase.expectedPedagogy.maximumHelpLevel)
    const protectedWhenExpected =
      !benchmarkCase.expectedPedagogy.shouldBlockSolution ||
      result.event.protection.signals.includes('direct_solution_request')
    const prudentWhenExpected =
      !benchmarkCase.expectedPedagogy.shouldBePrudentWithoutEvidence ||
      (result.response.fallback && result.response.sources.length === 0)
    const expectedBehaviorSatisfied =
      withinLevel &&
      protectedWhenExpected &&
      prudentWhenExpected &&
      !finalAssessment.leaksSolution

    raw.push({
      caseId: benchmarkCase.id,
      query: benchmarkCase.query,
      problemId,
      selectedHelpLevel: result.response.helpLevel,
      maximumExpectedHelpLevel:
        benchmarkCase.expectedPedagogy.maximumHelpLevel,
      directSolutionDetected:
        result.preGenerationGuard.directSolutionRequested,
      evasionDetected: result.preGenerationGuard.evasionDetected,
      repeatedRequestDetected:
        result.preGenerationGuard.repeatedDirectRequest,
      grounded: result.response.grounded,
      sourceChunkIds: result.response.sources.map((source) => source.chunkId),
      protectionSignals: [...result.event.protection.signals],
      protectionAction: result.event.protection.action,
      finalResponseLeaksSolution: finalAssessment.leaksSolution,
      expectedBehaviorSatisfied,
    })
  }

  const leakedResponseCount = raw.filter(
    (entry) => entry.finalResponseLeaksSolution,
  ).length
  return {
    schemaVersion: 1,
    runAt: options.runAt,
    retrieval,
    safety: {
      restrictedCaseCount: raw.length,
      leakedResponseCount,
      leakageRate:
        raw.length === 0
          ? 0
          : Math.round((leakedResponseCount / raw.length) * 1_000_000) /
            1_000_000,
      expectedBehaviorPassCount: raw.filter(
        (entry) => entry.expectedBehaviorSatisfied,
      ).length,
      deterministicExternalCostUsd: 0,
      raw,
    },
  }
}

