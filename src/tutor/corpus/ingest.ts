import {
  CORPUS_SCHEMA_VERSION,
  materializeCorpusDocument,
  stableDigest,
  validateCorpusDocument,
  type CorpusDocument,
  type ValidationIssue,
} from './schema'

export interface CorpusIdentity {
  corpusId: string
  corpusVersion: string
}

export interface CorpusSnapshot extends CorpusIdentity {
  schemaVersion: typeof CORPUS_SCHEMA_VERSION
  documents: CorpusDocument[]
  snapshotDigest: string
}

export interface ProcessedCorpusItem {
  inputIndex: number
  documentId: string
  contentDigest: string
}

export interface OmittedCorpusItem {
  inputIndex: number
  documentId: string
  reason: 'duplicate_unchanged'
}

export interface RejectedCorpusItem {
  inputIndex: number
  documentId?: string
  reason: 'schema_validation_failed' | 'identity_conflict'
  issues: ValidationIssue[]
}

export interface IngestionReport {
  corpusId: string
  corpusVersion: string
  schemaVersion: typeof CORPUS_SCHEMA_VERSION
  inputCount: number
  processedCount: number
  omittedCount: number
  rejectedCount: number
  totalDocuments: number
  unchanged: boolean
  processed: ProcessedCorpusItem[]
  omitted: OmittedCorpusItem[]
  rejected: RejectedCorpusItem[]
}

export interface IngestionResult {
  snapshot: CorpusSnapshot
  report: IngestionReport
}

function snapshotDigest(identity: CorpusIdentity, documents: readonly CorpusDocument[]): string {
  return stableDigest({
    ...identity,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    documents: documents.map((document) => ({ id: document.id, digest: document.contentDigest })),
  })
}

export function createEmptyCorpusSnapshot(identity: CorpusIdentity): CorpusSnapshot {
  return {
    ...identity,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    documents: [],
    snapshotDigest: snapshotDigest(identity, []),
  }
}

function verifyCompatibleSnapshot(identity: CorpusIdentity, previous: CorpusSnapshot): void {
  if (
    previous.corpusId !== identity.corpusId ||
    previous.corpusVersion !== identity.corpusVersion ||
    previous.schemaVersion !== CORPUS_SCHEMA_VERSION
  ) {
    throw new Error(
      `Corpus snapshot incompatible: expected ${identity.corpusId}@${identity.corpusVersion} schema ${CORPUS_SCHEMA_VERSION}.`,
    )
  }
}

/**
 * Adds only validated, previously unseen identities. Replaying the same batch is
 * a no-op; conflicting content under an existing identity is rejected instead
 * of silently overwriting its provenance.
 */
export function ingestCorpus(
  inputs: readonly unknown[],
  identity: CorpusIdentity,
  previous: CorpusSnapshot = createEmptyCorpusSnapshot(identity),
): IngestionResult {
  verifyCompatibleSnapshot(identity, previous)

  const byId = new Map(previous.documents.map((document) => [document.id, document]))
  const processed: ProcessedCorpusItem[] = []
  const omitted: OmittedCorpusItem[] = []
  const rejected: RejectedCorpusItem[] = []

  inputs.forEach((input, inputIndex) => {
    const validation = validateCorpusDocument(input)
    if (!validation.valid) {
      rejected.push({
        inputIndex,
        reason: 'schema_validation_failed',
        issues: validation.issues,
      })
      return
    }

    const document = materializeCorpusDocument(validation.value)
    const existing = byId.get(document.id)
    if (existing?.contentDigest === document.contentDigest) {
      omitted.push({ inputIndex, documentId: document.id, reason: 'duplicate_unchanged' })
      return
    }
    if (existing) {
      rejected.push({
        inputIndex,
        documentId: document.id,
        reason: 'identity_conflict',
        issues: [
          {
            path: '$.source.externalId',
            code: 'invalid_value',
            message:
              'La identidad ya existe con contenido diferente; use una versión o identificador de fuente distinto.',
          },
        ],
      })
      return
    }

    byId.set(document.id, document)
    processed.push({
      inputIndex,
      documentId: document.id,
      contentDigest: document.contentDigest,
    })
  })

  const documents = [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
  const digest = snapshotDigest(identity, documents)
  const snapshot: CorpusSnapshot = {
    ...identity,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    documents,
    snapshotDigest: digest,
  }

  return {
    snapshot,
    report: {
      ...identity,
      schemaVersion: CORPUS_SCHEMA_VERSION,
      inputCount: inputs.length,
      processedCount: processed.length,
      omittedCount: omitted.length,
      rejectedCount: rejected.length,
      totalDocuments: documents.length,
      unchanged: digest === previous.snapshotDigest,
      processed,
      omitted,
      rejected,
    },
  }
}
