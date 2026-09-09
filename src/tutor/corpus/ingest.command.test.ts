import { describe, expect, it } from 'vitest'
import { createRetrievalSuite } from '../retrieval'
import { DEMONSTRATION_CORPUS, DEMONSTRATION_CORPUS_MANIFEST } from './fixture'
import { ingestCorpus } from './ingest'

describe('comando reproducible de ingesta e índice', () => {
  it('reporta dos ejecuciones estables con conteos auditables', () => {
    const identity = {
      corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
      corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
    }
    const first = ingestCorpus(DEMONSTRATION_CORPUS, identity)
    const firstSuite = createRetrievalSuite(first.snapshot)
    const second = ingestCorpus(DEMONSTRATION_CORPUS, identity, first.snapshot)
    const secondSuite = createRetrievalSuite(second.snapshot, {
      previousDenseIndex: firstSuite.denseIndex,
    })
    const commandReport = {
      corpus: identity,
      documents: second.snapshot.documents.length,
      chunks: secondSuite.corpus.chunks.length,
      firstIngestion: {
        processed: first.report.processedCount,
        omitted: first.report.omittedCount,
        rejected: first.report.rejectedCount,
      },
      secondIngestion: {
        processed: second.report.processedCount,
        omitted: second.report.omittedCount,
        rejected: second.report.rejectedCount,
        unchanged: second.report.unchanged,
      },
      firstIndex: {
        generated: firstSuite.denseIndexReport.generatedCount,
        reused: firstSuite.denseIndexReport.reusedCount,
        digest: firstSuite.denseIndex.indexDigest,
      },
      secondIndex: {
        generated: secondSuite.denseIndexReport.generatedCount,
        reused: secondSuite.denseIndexReport.reusedCount,
        digest: secondSuite.denseIndex.indexDigest,
      },
      stableSnapshot:
        first.snapshot.snapshotDigest === second.snapshot.snapshotDigest,
      stableIndex:
        firstSuite.denseIndex.indexDigest === secondSuite.denseIndex.indexDigest,
    }

    expect(commandReport).toMatchObject({
      documents: 6,
      chunks: 42,
      firstIngestion: { processed: 6, omitted: 0, rejected: 0 },
      secondIngestion: { processed: 0, omitted: 6, rejected: 0, unchanged: true },
      firstIndex: { generated: 42, reused: 0 },
      secondIndex: { generated: 0, reused: 42 },
      stableSnapshot: true,
      stableIndex: true,
    })
    console.info(`TUTOR_INGEST_REPORT ${JSON.stringify(commandReport)}`)
  })
})

