import { stableDigest, type CorpusChunk, type CorpusChunkMetadata } from '../corpus/schema'
import type { RetrievalCorpus } from './types'

export function testChunk(
  id: string,
  text: string,
  metadata: Partial<CorpusChunkMetadata> = {},
): CorpusChunk {
  const completeMetadata: CorpusChunkMetadata = {
    title: metadata.title ?? `Documento ${id}`,
    language: metadata.language ?? 'es',
    programmingLanguages: metadata.programmingLanguages ?? ['cpp17'],
    tags: metadata.tags ?? ['demo'],
    topics: metadata.topics ?? ['prueba'],
    rating: metadata.rating ?? 800,
    difficulty: metadata.difficulty ?? 'introductory',
    contentType: metadata.contentType ?? 'concept',
    accessLevel: metadata.accessLevel ?? 'safe',
    problemId: metadata.problemId ?? `problem-${id}`,
    externalProblemId: metadata.externalProblemId ?? `external-${id}`,
    sourceKind: metadata.sourceKind ?? 'demonstration_fixture',
  }
  const source = {
    kind: completeMetadata.sourceKind,
    provider: 'Test fixture',
    externalId: completeMetadata.externalProblemId,
    title: completeMetadata.title,
    license: 'test-only',
    attribution: 'Prueba automatizada',
    incorporatedAt: '2026-09-02',
    synthetic: completeMetadata.sourceKind === 'demonstration_fixture',
    provenance: 'Objeto mínimo creado exclusivamente para la prueba.',
  } as const
  return {
    id,
    documentId: completeMetadata.problemId,
    text,
    metadata: completeMetadata,
    source,
    contentDigest: stableDigest({ id, text, metadata: completeMetadata, source }),
  }
}

export function testCorpus(chunks: readonly CorpusChunk[], digest = 'test-corpus-digest'): RetrievalCorpus {
  return {
    corpusId: 'test-corpus',
    corpusVersion: '1.0.0',
    corpusDigest: digest,
    chunks,
  }
}
