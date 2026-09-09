import {
  DEMONSTRATION_CORPUS,
  DEMONSTRATION_CORPUS_MANIFEST,
} from '../corpus/fixture'
import { ingestCorpus } from '../corpus/ingest'
import { createRetrievalSuite } from '../retrieval'
import type { TutorGenerator } from '../pedagogy/generator'
import type { TeacherHelpRules } from '../pedagogy/helpPolicy'
import { LocalTutorRepository, type StorageAdapter } from '../student/repository'
import { TutorService } from './tutorService'

export interface LocalTutorApiOptions {
  storage?: StorageAdapter
  generator?: TutorGenerator
  teacherRules?: TeacherHelpRules
  clock?: () => string
  monotonicNow?: () => number
  idFactory?: (kind: 'response' | 'event' | 'attempt', payload: unknown) => string
}

export function createLocalTutorApi(options: LocalTutorApiOptions = {}): TutorService {
  const identity = {
    corpusId: DEMONSTRATION_CORPUS_MANIFEST.id,
    corpusVersion: DEMONSTRATION_CORPUS_MANIFEST.version,
  }
  const ingestion = ingestCorpus(DEMONSTRATION_CORPUS, identity)
  const retrieval = createRetrievalSuite(ingestion.snapshot)
  return new TutorService({
    snapshot: ingestion.snapshot,
    retrieval,
    ...(options.storage
      ? { repository: new LocalTutorRepository(options.storage) }
      : {}),
    ...(options.generator ? { generator: options.generator } : {}),
    ...(options.teacherRules ? { teacherRules: options.teacherRules } : {}),
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.monotonicNow ? { monotonicNow: options.monotonicNow } : {}),
    ...(options.idFactory ? { idFactory: options.idFactory } : {}),
  })
}

export const localTutorApi = createLocalTutorApi()

