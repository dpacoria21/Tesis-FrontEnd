export const CORPUS_SCHEMA_VERSION = 1 as const

export const CONTENT_TYPES = [
  'problem_statement',
  'constraints',
  'example',
  'concept',
  'prerequisite',
  'strategy',
  'editorial',
] as const

export const SOURCE_KINDS = [
  'demonstration_fixture',
  'public_problem',
  'open_educational_resource',
  'author_provided',
] as const

export const DIFFICULTY_BANDS = [
  'introductory',
  'basic',
  'intermediate',
  'advanced',
] as const

export const ACCESS_LEVELS = ['safe', 'guided', 'solution'] as const

export type KnowledgeContentType = (typeof CONTENT_TYPES)[number]
export type CorpusSourceKind = (typeof SOURCE_KINDS)[number]
export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number]
export type PedagogicalAccessLevel = (typeof ACCESS_LEVELS)[number]

export interface CorpusSource {
  kind: CorpusSourceKind
  provider: string
  externalId: string
  title: string
  url?: string
  license: string
  attribution: string
  incorporatedAt: string
  synthetic: boolean
  provenance: string
}

export interface CorpusExample {
  input: string
  output: string
  explanation: string
}

export interface ComplexityClaim {
  time: string
  space: string
}

export interface ProblemStrategy {
  summary: string
  steps: string[]
  complexity: ComplexityClaim
  implementationNotes: string[]
}

/**
 * Authoring shape for one pedagogical problem. The identifier and digest are
 * deliberately absent: ingestion derives both from normalized content.
 */
export interface CorpusDocumentInput {
  schemaVersion: typeof CORPUS_SCHEMA_VERSION
  language: string
  programmingLanguages: string[]
  title: string
  statement: string
  constraints: string[]
  examples: CorpusExample[]
  tags: string[]
  topics: string[]
  rating: number
  difficulty: DifficultyBand
  concepts: string[]
  prerequisites: string[]
  strategy: ProblemStrategy
  editorial: string
  source: CorpusSource
}

export interface CorpusDocument extends CorpusDocumentInput {
  id: string
  contentDigest: string
}

export interface CorpusChunkMetadata {
  title: string
  language: string
  programmingLanguages: string[]
  tags: string[]
  topics: string[]
  rating: number
  difficulty: DifficultyBand
  contentType: KnowledgeContentType
  accessLevel: PedagogicalAccessLevel
  problemId: string
  externalProblemId: string
  sourceKind: CorpusSourceKind
}

export interface CorpusChunk {
  id: string
  documentId: string
  text: string
  metadata: CorpusChunkMetadata
  source: CorpusSource
  contentDigest: string
}

export type ValidationIssueCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_value'
  | 'invalid_format'
  | 'out_of_range'

export interface ValidationIssue {
  path: string
  code: ValidationIssueCode
  message: string
}

export type CorpusValidationResult =
  | { valid: true; value: CorpusDocumentInput; issues: [] }
  | { valid: false; issues: ValidationIssue[] }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(
  issues: ValidationIssue[],
  path: string,
  code: ValidationIssueCode,
  message: string,
): void {
  issues.push({ path, code, message })
}

function requiredString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string {
  const value = record[key]
  if (value === undefined || value === null) {
    issue(issues, path, 'required', 'El campo es obligatorio.')
    return ''
  }
  if (typeof value !== 'string') {
    issue(issues, path, 'invalid_type', 'Se esperaba una cadena.')
    return ''
  }
  const normalized = normalizeText(value)
  if (!normalized) {
    issue(issues, path, 'invalid_value', 'La cadena no puede estar vacía.')
  }
  return normalized
}

function optionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    issue(issues, path, 'invalid_type', 'Se esperaba una cadena.')
    return undefined
  }
  const normalized = value.trim()
  if (!normalized) {
    issue(issues, path, 'invalid_value', 'La cadena no puede estar vacía.')
    return undefined
  }
  return normalized
}

function stringArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
  options: { allowEmpty?: boolean; normalizeLabels?: boolean; preserveOrder?: boolean } = {},
): string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    issue(
      issues,
      path,
      value === undefined ? 'required' : 'invalid_type',
      'Se esperaba una lista de cadenas.',
    )
    return []
  }

  const normalized: string[] = []
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      issue(issues, `${path}[${index}]`, 'invalid_type', 'Se esperaba una cadena.')
      return
    }
    const text = options.normalizeLabels ? normalizeLabel(entry) : normalizeText(entry)
    if (!text) {
      issue(issues, `${path}[${index}]`, 'invalid_value', 'La cadena no puede estar vacía.')
      return
    }
    normalized.push(text)
  })

  if (!options.allowEmpty && normalized.length === 0) {
    issue(issues, path, 'invalid_value', 'La lista debe contener al menos un elemento.')
  }

  const unique = [...new Set(normalized)]
  return options.preserveOrder
    ? unique
    : unique.sort((left, right) => left.localeCompare(right))
}

function validateDate(value: string, path: string, issues: ValidationIssue[]): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    issue(issues, path, 'invalid_format', 'Se esperaba una fecha ISO YYYY-MM-DD.')
    return
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    issue(issues, path, 'invalid_format', 'La fecha no existe en el calendario.')
  }
}

function validateUrl(value: string | undefined, path: string, issues: ValidationIssue[]): void {
  if (value === undefined) return
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      issue(issues, path, 'invalid_format', 'La URL debe usar HTTP o HTTPS.')
    }
  } catch {
    issue(issues, path, 'invalid_format', 'La URL no es válida.')
  }
}

function parseSource(value: unknown, path: string, issues: ValidationIssue[]): CorpusSource {
  if (!isRecord(value)) {
    issue(
      issues,
      path,
      value === undefined ? 'required' : 'invalid_type',
      'Se esperaba un objeto de procedencia.',
    )
    return {
      kind: 'demonstration_fixture',
      provider: '',
      externalId: '',
      title: '',
      license: '',
      attribution: '',
      incorporatedAt: '',
      synthetic: true,
      provenance: '',
    }
  }

  const kindValue = value.kind
  const kind = SOURCE_KINDS.includes(kindValue as CorpusSourceKind)
    ? (kindValue as CorpusSourceKind)
    : 'demonstration_fixture'
  if (!SOURCE_KINDS.includes(kindValue as CorpusSourceKind)) {
    issue(issues, `${path}.kind`, 'invalid_value', `Valor permitido: ${SOURCE_KINDS.join(', ')}.`)
  }

  const syntheticValue = value.synthetic
  if (typeof syntheticValue !== 'boolean') {
    issue(
      issues,
      `${path}.synthetic`,
      syntheticValue === undefined ? 'required' : 'invalid_type',
      'Se esperaba un booleano.',
    )
  }

  const source: CorpusSource = {
    kind,
    provider: requiredString(value, 'provider', `${path}.provider`, issues),
    externalId: requiredString(value, 'externalId', `${path}.externalId`, issues),
    title: requiredString(value, 'title', `${path}.title`, issues),
    license: requiredString(value, 'license', `${path}.license`, issues),
    attribution: requiredString(value, 'attribution', `${path}.attribution`, issues),
    incorporatedAt: requiredString(value, 'incorporatedAt', `${path}.incorporatedAt`, issues),
    synthetic: typeof syntheticValue === 'boolean' ? syntheticValue : false,
    provenance: requiredString(value, 'provenance', `${path}.provenance`, issues),
  }

  const url = optionalString(value, 'url', `${path}.url`, issues)
  if (url !== undefined) source.url = url
  validateUrl(url, `${path}.url`, issues)
  validateDate(source.incorporatedAt, `${path}.incorporatedAt`, issues)

  if (source.kind === 'demonstration_fixture' && !source.synthetic) {
    issue(
      issues,
      `${path}.synthetic`,
      'invalid_value',
      'Una fuente demonstration_fixture debe declararse sintética.',
    )
  }
  if (source.kind !== 'demonstration_fixture' && source.synthetic) {
    issue(
      issues,
      `${path}.synthetic`,
      'invalid_value',
      'Una fuente externa no puede declararse como fixture sintético.',
    )
  }
  if (!source.synthetic && source.url === undefined) {
    issue(issues, `${path}.url`, 'required', 'Una fuente no sintética requiere URL trazable.')
  }

  return source
}

function parseExamples(value: unknown, path: string, issues: ValidationIssue[]): CorpusExample[] {
  if (!Array.isArray(value)) {
    issue(
      issues,
      path,
      value === undefined ? 'required' : 'invalid_type',
      'Se esperaba una lista de ejemplos.',
    )
    return []
  }
  if (value.length === 0) {
    issue(issues, path, 'invalid_value', 'Se requiere al menos un ejemplo.')
  }

  return value.flatMap((entry, index) => {
    const entryPath = `${path}[${index}]`
    if (!isRecord(entry)) {
      issue(issues, entryPath, 'invalid_type', 'Se esperaba un objeto de ejemplo.')
      return []
    }
    return [
      {
        input: requiredString(entry, 'input', `${entryPath}.input`, issues),
        output: requiredString(entry, 'output', `${entryPath}.output`, issues),
        explanation: requiredString(entry, 'explanation', `${entryPath}.explanation`, issues),
      },
    ]
  })
}

function parseStrategy(value: unknown, path: string, issues: ValidationIssue[]): ProblemStrategy {
  if (!isRecord(value)) {
    issue(
      issues,
      path,
      value === undefined ? 'required' : 'invalid_type',
      'Se esperaba un objeto de estrategia.',
    )
    return {
      summary: '',
      steps: [],
      complexity: { time: '', space: '' },
      implementationNotes: [],
    }
  }

  const complexityValue = value.complexity
  let complexity: ComplexityClaim = { time: '', space: '' }
  if (!isRecord(complexityValue)) {
    issue(
      issues,
      `${path}.complexity`,
      complexityValue === undefined ? 'required' : 'invalid_type',
      'Se esperaba un objeto de complejidad.',
    )
  } else {
    complexity = {
      time: requiredString(complexityValue, 'time', `${path}.complexity.time`, issues),
      space: requiredString(complexityValue, 'space', `${path}.complexity.space`, issues),
    }
  }

  return {
    summary: requiredString(value, 'summary', `${path}.summary`, issues),
    steps: stringArray(value, 'steps', `${path}.steps`, issues, { preserveOrder: true }),
    complexity,
    implementationNotes: stringArray(
      value,
      'implementationNotes',
      `${path}.implementationNotes`,
      issues,
      { allowEmpty: true, preserveOrder: true },
    ),
  }
}

export function validateCorpusDocument(value: unknown): CorpusValidationResult {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: '$', code: 'invalid_type', message: 'Se esperaba un objeto de corpus.' }],
    }
  }

  const schemaVersionValue = value.schemaVersion
  if (schemaVersionValue !== CORPUS_SCHEMA_VERSION) {
    issue(
      issues,
      '$.schemaVersion',
      schemaVersionValue === undefined ? 'required' : 'invalid_value',
      `La versión admitida es ${CORPUS_SCHEMA_VERSION}.`,
    )
  }

  const language = requiredString(value, 'language', '$.language', issues).toLocaleLowerCase('en-US')
  if (language && !/^[a-z]{2}(?:-[a-z]{2})?$/.test(language)) {
    issue(issues, '$.language', 'invalid_format', 'Se esperaba un código de idioma BCP-47 corto.')
  }

  const ratingValue = value.rating
  let rating = 0
  if (typeof ratingValue !== 'number' || !Number.isInteger(ratingValue)) {
    issue(
      issues,
      '$.rating',
      ratingValue === undefined ? 'required' : 'invalid_type',
      'Se esperaba un rating entero.',
    )
  } else {
    rating = ratingValue
    if (rating < 0 || rating > 5000) {
      issue(issues, '$.rating', 'out_of_range', 'El rating debe estar entre 0 y 5000.')
    }
  }

  const difficultyValue = value.difficulty
  const difficulty = DIFFICULTY_BANDS.includes(difficultyValue as DifficultyBand)
    ? (difficultyValue as DifficultyBand)
    : 'introductory'
  if (!DIFFICULTY_BANDS.includes(difficultyValue as DifficultyBand)) {
    issue(
      issues,
      '$.difficulty',
      difficultyValue === undefined ? 'required' : 'invalid_value',
      `Valor permitido: ${DIFFICULTY_BANDS.join(', ')}.`,
    )
  }

  const normalized: CorpusDocumentInput = {
    schemaVersion: CORPUS_SCHEMA_VERSION,
    language,
    programmingLanguages: stringArray(
      value,
      'programmingLanguages',
      '$.programmingLanguages',
      issues,
      { normalizeLabels: true },
    ),
    title: requiredString(value, 'title', '$.title', issues),
    statement: requiredString(value, 'statement', '$.statement', issues),
    constraints: stringArray(value, 'constraints', '$.constraints', issues),
    examples: parseExamples(value.examples, '$.examples', issues),
    tags: stringArray(value, 'tags', '$.tags', issues, { normalizeLabels: true }),
    topics: stringArray(value, 'topics', '$.topics', issues, { normalizeLabels: true }),
    rating,
    difficulty,
    concepts: stringArray(value, 'concepts', '$.concepts', issues, { normalizeLabels: true }),
    prerequisites: stringArray(value, 'prerequisites', '$.prerequisites', issues, {
      allowEmpty: true,
      normalizeLabels: true,
    }),
    strategy: parseStrategy(value.strategy, '$.strategy', issues),
    editorial: requiredString(value, 'editorial', '$.editorial', issues),
    source: parseSource(value.source, '$.source', issues),
  }

  return issues.length === 0 ? { valid: true, value: normalized, issues: [] } : { valid: false, issues }
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
}

export function normalizeLabel(value: string): string {
  return normalizeText(value).toLocaleLowerCase('es-PE')
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as UnknownRecord
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

/** Stable, non-cryptographic digest used for reproducibility and change detection. */
export function stableDigest(value: unknown): string {
  const input = canonicalJson(value)
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193) >>> 0
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0
    second ^= second >>> 13
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

function slug(value: string): string {
  const result = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28)
  return result || 'resource'
}

export function corpusDocumentId(document: CorpusDocumentInput): string {
  const identity = {
    provider: normalizeLabel(document.source.provider),
    externalId: normalizeLabel(document.source.externalId),
    language: document.language.toLocaleLowerCase('en-US'),
  }
  return `kd_${slug(document.source.externalId)}_${stableDigest(identity)}`
}

export function materializeCorpusDocument(document: CorpusDocumentInput): CorpusDocument {
  return {
    ...document,
    id: corpusDocumentId(document),
    contentDigest: stableDigest(document),
  }
}

interface ChunkSeed {
  key: string
  contentType: KnowledgeContentType
  accessLevel: PedagogicalAccessLevel
  text: string
}

function chunkSeeds(document: CorpusDocument): ChunkSeed[] {
  const examples = document.examples
    .map(
      (example, index) =>
        `Ejemplo ${index + 1}. Entrada: ${example.input}. Salida: ${example.output}. Explicación: ${example.explanation}`,
    )
    .join('\n')
  return [
    {
      key: 'statement',
      contentType: 'problem_statement',
      accessLevel: 'safe',
      text: `${document.title}. ${document.statement}`,
    },
    {
      key: 'constraints',
      contentType: 'constraints',
      accessLevel: 'safe',
      text: `Restricciones: ${document.constraints.join('; ')}.`,
    },
    { key: 'examples', contentType: 'example', accessLevel: 'guided', text: examples },
    {
      key: 'concepts',
      contentType: 'concept',
      accessLevel: 'safe',
      text: `Conceptos: ${document.concepts.join(', ')}.`,
    },
    {
      key: 'prerequisites',
      contentType: 'prerequisite',
      accessLevel: 'safe',
      text:
        document.prerequisites.length > 0
          ? `Prerrequisitos: ${document.prerequisites.join(', ')}.`
          : 'Prerrequisitos: lectura de entrada, salida y variables básicas.',
    },
    {
      key: 'strategy',
      contentType: 'strategy',
      accessLevel: 'guided',
      text: `${document.strategy.summary} Pasos: ${document.strategy.steps.join(' ')} Complejidad temporal: ${document.strategy.complexity.time}. Complejidad espacial: ${document.strategy.complexity.space}.`,
    },
    {
      key: 'editorial',
      contentType: 'editorial',
      accessLevel: 'solution',
      text: document.editorial,
    },
  ]
}

export function buildCorpusChunks(documents: readonly CorpusDocument[]): CorpusChunk[] {
  return [...documents]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((document) =>
      chunkSeeds(document).map((seed) => {
        const id = `${document.id}:${seed.key}`
        const metadata: CorpusChunkMetadata = {
          title: document.title,
          language: document.language,
          programmingLanguages: [...document.programmingLanguages],
          tags: [...document.tags],
          topics: [...document.topics],
          rating: document.rating,
          difficulty: document.difficulty,
          contentType: seed.contentType,
          accessLevel: seed.accessLevel,
          problemId: document.id,
          externalProblemId: document.source.externalId,
          sourceKind: document.source.kind,
        }
        const text = normalizeText(seed.text)
        return {
          id,
          documentId: document.id,
          text,
          metadata,
          source: { ...document.source },
          contentDigest: stableDigest({ id, text, metadata, source: document.source }),
        }
      }),
    )
}
