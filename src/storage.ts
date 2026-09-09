import { FERNANDO_BENITO_BASELINE } from './data/baseline'
import { seedProblems } from './data/seedProblems'
import type {
  ProblemCatalogEntry,
  ProblemId,
  ProblemProgress,
  SessionCause,
  SessionLog,
  TrainingState,
} from './types'

export const TRAINING_STATE_KEY = 'momentum-cf:training-state:v1'
export const CATALOG_DATABASE_NAME = 'momentum-cf-catalog'
export const CATALOG_DATABASE_VERSION = 1

const PROBLEM_STORE = 'problems'
const METADATA_STORE = 'metadata'

export interface CatalogMetadata {
  key: 'catalog'
  updatedAt: string
  problemCount: number
}

function isoNow(now: Date | string = new Date()): string {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date.')
  return date.toISOString()
}

export function createInitialTrainingState(
  now: Date | string = new Date(),
): TrainingState {
  const timestamp = isoNow(now)
  return {
    version: 1,
    handle: FERNANDO_BENITO_BASELINE.handle,
    createdAt: timestamp,
    updatedAt: timestamp,
    weakTags: [],
    completedProblemIds: [],
    syncedSolvedProblemIds: [],
    progress: {},
    recommendationHistory: [],
    sessionLogs: [],
    activityDates: [],
    preferences: {
      targetRating: FERNANDO_BENITO_BASELINE.targetRating,
      dailyGoal: 2,
      preferredTags: [],
      excludedTags: [],
      hideTags: true,
      enableStretch: true,
    },
    lastSyncAt: null,
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeProgress(value: unknown): Record<ProblemId, ProblemProgress> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, ProblemProgress] => {
      const progress = entry[1]
      return (
        isRecord(progress) &&
        typeof progress.problemId === 'string' &&
        typeof progress.attempts === 'number' &&
        ['recommended', 'attempted', 'solved', 'skipped'].includes(
          String(progress.status),
        )
      )
    }),
  )
}

const SESSION_CAUSES: SessionCause[] = [
  'IDEA',
  'IMPLEMENTATION',
  'EDGE_CASE',
  'COMPLEXITY',
  'MATH',
  'READING',
  'PANIC_TIME',
]

function sanitizeSessionLogs(value: unknown): SessionLog[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.problemId !== 'string' ||
      typeof entry.completedAt !== 'string' ||
      !['solved', 'unsolved'].includes(String(entry.result)) ||
      typeof entry.attempts !== 'number' ||
      typeof entry.timeMinutes !== 'number' ||
      typeof entry.firstSubmit !== 'boolean' ||
      typeof entry.editorialUsed !== 'boolean' ||
      typeof entry.notes !== 'string' ||
      ![1, 2, 3, 4, 5].includes(Number(entry.confidence)) ||
      !(
        entry.cause === null ||
        SESSION_CAUSES.includes(entry.cause as SessionCause)
      )
    ) {
      return []
    }
    return [entry as unknown as SessionLog]
  })
}

function hydrateTrainingState(value: unknown): TrainingState | null {
  if (!isRecord(value) || value.version !== 1) return null

  const fallback = createInitialTrainingState()
  const rawPreferences = isRecord(value.preferences) ? value.preferences : {}
  const rawHistory = Array.isArray(value.recommendationHistory)
    ? value.recommendationHistory
    : []

  return {
    ...fallback,
    handle: typeof value.handle === 'string' ? value.handle : fallback.handle,
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt:
      typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    weakTags: strings(value.weakTags),
    completedProblemIds: strings(value.completedProblemIds),
    syncedSolvedProblemIds: strings(value.syncedSolvedProblemIds),
    progress: sanitizeProgress(value.progress),
    recommendationHistory: rawHistory.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.date !== 'string') return []
      return [{ date: entry.date, problemIds: strings(entry.problemIds) }]
    }),
    sessionLogs: sanitizeSessionLogs(value.sessionLogs),
    activityDates: strings(value.activityDates),
    preferences: {
      targetRating:
        typeof rawPreferences.targetRating === 'number'
          ? rawPreferences.targetRating
          : fallback.preferences.targetRating,
      dailyGoal:
        typeof rawPreferences.dailyGoal === 'number'
          ? rawPreferences.dailyGoal
          : fallback.preferences.dailyGoal,
      preferredTags: strings(rawPreferences.preferredTags),
      excludedTags: strings(rawPreferences.excludedTags),
      hideTags:
        typeof rawPreferences.hideTags === 'boolean'
          ? rawPreferences.hideTags
          : fallback.preferences.hideTags,
      enableStretch:
        typeof rawPreferences.enableStretch === 'boolean'
          ? rawPreferences.enableStretch
          : fallback.preferences.enableStretch,
    },
    lastSyncAt:
      typeof value.lastSyncAt === 'string' ? value.lastSyncAt : null,
  }
}

export function loadTrainingState(
  storage: Storage | undefined = browserStorage(),
): TrainingState {
  if (!storage) return createInitialTrainingState()
  try {
    const serialized = storage.getItem(TRAINING_STATE_KEY)
    if (!serialized) return createInitialTrainingState()
    return hydrateTrainingState(JSON.parse(serialized)) ?? createInitialTrainingState()
  } catch {
    return createInitialTrainingState()
  }
}

export function saveTrainingState(
  state: TrainingState,
  storage: Storage | undefined = browserStorage(),
  now: Date | string = new Date(),
): TrainingState {
  const nextState: TrainingState = { ...state, version: 1, updatedAt: isoNow(now) }
  storage?.setItem(TRAINING_STATE_KEY, JSON.stringify(nextState))
  return nextState
}

export function updateTrainingState(
  updater: (current: TrainingState) => TrainingState,
  storage: Storage | undefined = browserStorage(),
): TrainingState {
  return saveTrainingState(updater(loadTrainingState(storage)), storage)
}

export function clearTrainingState(
  storage: Storage | undefined = browserStorage(),
): TrainingState {
  storage?.removeItem(TRAINING_STATE_KEY)
  return createInitialTrainingState()
}

function getIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.')
  }
  return indexedDB
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'))
  })
}

export function openCatalogDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = getIndexedDb().open(
      CATALOG_DATABASE_NAME,
      CATALOG_DATABASE_VERSION,
    )

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PROBLEM_STORE)) {
        const store = database.createObjectStore(PROBLEM_STORE, { keyPath: 'id' })
        store.createIndex('rating', 'rating', { unique: false })
        store.createIndex('contestId', 'contestId', { unique: false })
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the problem catalog.'))
  })
}

async function writeCatalog(
  problems: readonly ProblemCatalogEntry[],
  replace: boolean,
): Promise<void> {
  const database = await openCatalogDatabase()
  try {
    const transaction = database.transaction(
      [PROBLEM_STORE, METADATA_STORE],
      'readwrite',
    )
    const store = transaction.objectStore(PROBLEM_STORE)
    if (replace) store.clear()
    for (const problem of problems) store.put(problem)
    const metadataStore = transaction.objectStore(METADATA_STORE)
    if (replace) {
      metadataStore.put({
        key: 'catalog',
        updatedAt: new Date().toISOString(),
        problemCount: problems.length,
      } satisfies CatalogMetadata)
    } else {
      const countRequest = store.count()
      countRequest.onsuccess = () => {
        metadataStore.put({
          key: 'catalog',
          updatedAt: new Date().toISOString(),
          problemCount: countRequest.result,
        } satisfies CatalogMetadata)
      }
    }
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}

export function replaceProblemCatalog(
  problems: readonly ProblemCatalogEntry[],
): Promise<void> {
  return writeCatalog(problems, true)
}

export function upsertProblemCatalog(
  problems: readonly ProblemCatalogEntry[],
): Promise<void> {
  return writeCatalog(problems, false)
}

export async function getProblemCatalog(): Promise<ProblemCatalogEntry[]> {
  const database = await openCatalogDatabase()
  try {
    const transaction = database.transaction(PROBLEM_STORE, 'readonly')
    const result = await requestResult<ProblemCatalogEntry[]>(
      transaction.objectStore(PROBLEM_STORE).getAll(),
    )
    await transactionDone(transaction)
    return result.sort(
      (left, right) => left.rating - right.rating || left.id.localeCompare(right.id),
    )
  } finally {
    database.close()
  }
}

export async function getProblemFromCatalog(
  problemId: ProblemId,
): Promise<ProblemCatalogEntry | undefined> {
  const database = await openCatalogDatabase()
  try {
    const transaction = database.transaction(PROBLEM_STORE, 'readonly')
    const result = await requestResult<ProblemCatalogEntry | undefined>(
      transaction.objectStore(PROBLEM_STORE).get(problemId),
    )
    await transactionDone(transaction)
    return result
  } finally {
    database.close()
  }
}

export async function getCatalogMetadata(): Promise<CatalogMetadata | undefined> {
  const database = await openCatalogDatabase()
  try {
    const transaction = database.transaction(METADATA_STORE, 'readonly')
    const result = await requestResult<CatalogMetadata | undefined>(
      transaction.objectStore(METADATA_STORE).get('catalog'),
    )
    await transactionDone(transaction)
    return result
  } finally {
    database.close()
  }
}

export async function initializeProblemCatalog(): Promise<ProblemCatalogEntry[]> {
  const existing = await getProblemCatalog()
  if (existing.length > 0) {
    await upsertProblemCatalog(seedProblems)
    const merged = new Map(existing.map((problem) => [problem.id, problem]))
    for (const problem of seedProblems) {
      if (!merged.has(problem.id)) merged.set(problem.id, problem)
    }
    return [...merged.values()].sort(
      (left, right) => left.rating - right.rating || left.id.localeCompare(right.id),
    )
  }
  await replaceProblemCatalog(seedProblems)
  return seedProblems.map((problem) => ({ ...problem, tags: [...problem.tags] }))
}
