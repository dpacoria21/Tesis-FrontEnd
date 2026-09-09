import { describe, expect, it } from 'vitest'
import { DEMONSTRATION_CORPUS, DEMONSTRATION_CORPUS_MANIFEST } from './fixture'
import { ingestCorpus } from './ingest'

const identity = {
  corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
  corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
}

describe('corpus ingestion', () => {
  it('reports processed, omitted and rejected counts', () => {
    const invalid = { schemaVersion: 1, title: '' }
    const result = ingestCorpus(
      [DEMONSTRATION_CORPUS[0], DEMONSTRATION_CORPUS[0], invalid],
      identity,
    )

    expect(result.report).toMatchObject({
      inputCount: 3,
      processedCount: 1,
      omittedCount: 1,
      rejectedCount: 1,
      totalDocuments: 1,
      unchanged: false,
    })
    expect(result.report.omitted[0].reason).toBe('duplicate_unchanged')
    expect(result.report.rejected[0].reason).toBe('schema_validation_failed')
  })

  it('is idempotent across two complete runs', () => {
    const first = ingestCorpus(DEMONSTRATION_CORPUS, identity)
    const second = ingestCorpus(DEMONSTRATION_CORPUS, identity, first.snapshot)

    expect(first.report.processedCount).toBe(DEMONSTRATION_CORPUS.length)
    expect(first.report.rejectedCount).toBe(0)
    expect(second.report).toMatchObject({
      processedCount: 0,
      omittedCount: DEMONSTRATION_CORPUS.length,
      rejectedCount: 0,
      totalDocuments: DEMONSTRATION_CORPUS.length,
      unchanged: true,
    })
    expect(second.snapshot).toEqual(first.snapshot)
  })

  it('rejects a conflicting identity without changing the existing document', () => {
    const first = ingestCorpus([DEMONSTRATION_CORPUS[0]], identity)
    const conflict = structuredClone(DEMONSTRATION_CORPUS[0])
    conflict.statement = 'Contenido diferente bajo la misma identidad de fuente.'
    const second = ingestCorpus([conflict], identity, first.snapshot)

    expect(second.report.rejected[0]).toMatchObject({
      reason: 'identity_conflict',
      documentId: first.snapshot.documents[0].id,
    })
    expect(second.report.unchanged).toBe(true)
    expect(second.snapshot).toEqual(first.snapshot)
  })

  it('refuses a snapshot from another corpus instead of mixing versions', () => {
    const first = ingestCorpus([DEMONSTRATION_CORPUS[0]], identity)
    expect(() =>
      ingestCorpus(DEMONSTRATION_CORPUS, { ...identity, corpusVersion: '2.0.0' }, first.snapshot),
    ).toThrow(/snapshot incompatible/i)
  })
})
