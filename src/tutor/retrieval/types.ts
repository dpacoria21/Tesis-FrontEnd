import type {
  CorpusChunk,
  CorpusChunkMetadata,
  CorpusSource,
  CorpusSourceKind,
  DifficultyBand,
  KnowledgeContentType,
  PedagogicalAccessLevel,
} from '../corpus/schema'

export type RetrievalMethod = 'bm25' | 'dense' | 'hybrid_rrf' | 'hybrid_rrf_filtered'
export type RetrievalComponent = 'bm25' | 'dense'

export interface RatingRange {
  min?: number
  max?: number
}

export interface RetrievalFilters {
  topicsAny?: string[]
  tagsAny?: string[]
  difficultyBands?: DifficultyBand[]
  rating?: RatingRange
  contentTypes?: KnowledgeContentType[]
  languages?: string[]
  programmingLanguagesAny?: string[]
  problemIds?: string[]
  accessLevels?: PedagogicalAccessLevel[]
  sourceKinds?: CorpusSourceKind[]
}

export interface RetrievalRequest {
  query: string
  limit?: number
  filters?: RetrievalFilters
}

export interface ComponentRankTrace {
  rank: number
  rawScore: number
  rrfContribution?: number
}

export interface RetrievedEvidence {
  rank: number
  documentId: string
  problemId: string
  score: number
  componentRanks: Partial<Record<RetrievalComponent, ComponentRankTrace>>
  source: CorpusSource
  metadata: CorpusChunkMetadata
  fragment: string
}

export interface ComponentRankingEntry {
  documentId: string
  rank: number
  rawScore: number
}

export interface ComponentAudit {
  component: RetrievalComponent
  returnedCount: number
  ranking: ComponentRankingEntry[]
}

export interface FilterAudit {
  requested: RetrievalFilters | null
  applied: boolean
  inputDocumentCount: number
  eligibleDocumentCount: number
}

export interface RetrievalAudit {
  method: RetrievalMethod
  corpusId: string
  corpusVersion: string
  corpusDigest: string
  query: string
  requestedLimit: number
  candidateLimit: number
  filters: FilterAudit
  configuration: Record<string, string | number | boolean>
  components: ComponentAudit[]
  warnings: string[]
}

export interface RetrievalResponse {
  method: RetrievalMethod
  items: RetrievedEvidence[]
  audit: RetrievalAudit
}

export interface Retriever {
  readonly method: RetrievalMethod
  retrieve(request: RetrievalRequest): RetrievalResponse
}

export interface RankedCandidate {
  documentId: string
  rank: number
  score: number
}

export interface RetrievalCorpus {
  corpusId: string
  corpusVersion: string
  corpusDigest: string
  chunks: readonly CorpusChunk[]
}
