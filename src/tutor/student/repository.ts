import {
  assertPedagogicalEvent,
  type PedagogicalEvent,
} from './events'
import {
  assertStudentState,
  createStudentState,
  type StudentState,
} from './model'

export const TUTOR_STATE_STORAGE_KEY = 'momentum-cf:tutor-state:v1'

const REPOSITORY_SCHEMA_VERSION = 1 as const

interface RepositoryEnvelope {
  schemaVersion: typeof REPOSITORY_SCHEMA_VERSION
  students: Record<string, StudentState>
  pedagogicalEvents: PedagogicalEvent[]
}

interface LegacyEnvelopeV0 {
  version: 0
  students?: StudentState[]
  events?: PedagogicalEvent[]
}

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function emptyEnvelope(): RepositoryEnvelope {
  return {
    schemaVersion: REPOSITORY_SCHEMA_VERSION,
    students: {},
    pedagogicalEvents: [],
  }
}

function defaultStorage(): StorageAdapter {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage
    }
  } catch {
    // Some privacy modes expose localStorage but reject access. The in-memory
    // fallback keeps the local-only prototype usable without losing type safety.
  }
  return new MemoryStorageAdapter()
}

function cloneStudent(state: StudentState): StudentState {
  return JSON.parse(JSON.stringify(state)) as StudentState
}

function cloneEvent(event: PedagogicalEvent): PedagogicalEvent {
  return JSON.parse(JSON.stringify(event)) as PedagogicalEvent
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  )
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function validateEnvelope(envelope: RepositoryEnvelope): void {
  if (envelope.schemaVersion !== REPOSITORY_SCHEMA_VERSION) {
    throw new Error('Unsupported tutor repository schema version')
  }
  for (const [studentId, state] of Object.entries(envelope.students)) {
    assertStudentState(state)
    if (state.studentId !== studentId) {
      throw new Error(`Student key mismatch for ${studentId}`)
    }
  }
  if (!Array.isArray(envelope.pedagogicalEvents)) {
    throw new Error('pedagogicalEvents must be an array')
  }
  envelope.pedagogicalEvents.forEach(assertPedagogicalEvent)
}

function isLegacyEnvelopeV0(value: unknown): value is LegacyEnvelopeV0 {
  return Boolean(value && typeof value === 'object' && 'version' in value && (value as { version?: unknown }).version === 0)
}

function migrateLegacyEnvelope(value: LegacyEnvelopeV0): RepositoryEnvelope {
  const envelope = emptyEnvelope()
  for (const state of value.students ?? []) {
    assertStudentState(state)
    envelope.students[state.studentId] = cloneStudent(state)
  }
  for (const event of value.events ?? []) {
    assertPedagogicalEvent(event)
    if (!envelope.pedagogicalEvents.some((item) => item.eventId === event.eventId)) {
      envelope.pedagogicalEvents.push(cloneEvent(event))
    }
  }
  return envelope
}

export class LocalTutorRepository {
  constructor(
    private readonly storage: StorageAdapter = defaultStorage(),
    private readonly storageKey: string = TUTOR_STATE_STORAGE_KEY,
  ) {}

  getOrCreateStudent(studentId: string): StudentState {
    const normalizedId = studentId.trim()
    if (!normalizedId) throw new Error('studentId must not be empty')
    const envelope = this.readEnvelope()
    const existing = envelope.students[normalizedId]
    if (existing) return cloneStudent(existing)

    const created = createStudentState(normalizedId)
    envelope.students[normalizedId] = created
    this.writeEnvelope(envelope)
    return cloneStudent(created)
  }

  getStudent(studentId: string): StudentState | null {
    const state = this.readEnvelope().students[studentId]
    return state ? cloneStudent(state) : null
  }

  saveStudent(state: StudentState): StudentState {
    assertStudentState(state)
    const envelope = this.readEnvelope()
    const persisted = envelope.students[state.studentId]
    if (persisted && state.revision < persisted.revision) {
      throw new Error(
        `Stale student revision ${state.revision}; current revision is ${persisted.revision}`,
      )
    }
    if (
      persisted &&
      state.revision === persisted.revision &&
      canonicalJson(state) !== canonicalJson(persisted)
    ) {
      throw new Error(`Student revision collision: ${state.revision}`)
    }
    envelope.students[state.studentId] = cloneStudent(state)
    this.writeEnvelope(envelope)
    return cloneStudent(state)
  }

  updateStudent(
    studentId: string,
    transition: (state: StudentState) => StudentState,
  ): StudentState {
    const current = this.getOrCreateStudent(studentId)
    const next = transition(current)
    if (next.studentId !== studentId) {
      throw new Error('A transition cannot change studentId')
    }
    return this.saveStudent(next)
  }

  appendPedagogicalEvent(event: PedagogicalEvent): {
    inserted: boolean
    event: PedagogicalEvent
  } {
    assertPedagogicalEvent(event)
    const envelope = this.readEnvelope()
    const existing = envelope.pedagogicalEvents.find(
      (item) => item.eventId === event.eventId,
    )
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(event)) {
        throw new Error(`Pedagogical event id collision: ${event.eventId}`)
      }
      return { inserted: false, event: cloneEvent(existing) }
    }
    envelope.pedagogicalEvents.push(cloneEvent(event))
    this.writeEnvelope(envelope)
    return { inserted: true, event: cloneEvent(event) }
  }

  listPedagogicalEvents(studentId: string): PedagogicalEvent[] {
    return this.readEnvelope()
      .pedagogicalEvents.filter((event) => event.studentId === studentId)
      .map(cloneEvent)
  }

  clear(): void {
    if (this.storage.removeItem) {
      this.storage.removeItem(this.storageKey)
      return
    }
    this.storage.setItem(this.storageKey, JSON.stringify(emptyEnvelope()))
  }

  private readEnvelope(): RepositoryEnvelope {
    const raw = this.storage.getItem(this.storageKey)
    if (raw === null) return emptyEnvelope()

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Stored tutor state is not valid JSON')
    }

    if (isLegacyEnvelopeV0(parsed)) {
      const migrated = migrateLegacyEnvelope(parsed)
      this.writeEnvelope(migrated)
      return migrated
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Stored tutor state is not an object')
    }
    const envelope = parsed as RepositoryEnvelope
    validateEnvelope(envelope)
    return envelope
  }

  private writeEnvelope(envelope: RepositoryEnvelope): void {
    validateEnvelope(envelope)
    // localStorage.setItem replaces one complete serialized envelope, so callers
    // never observe a partially written student/event transition.
    this.storage.setItem(this.storageKey, JSON.stringify(envelope))
  }
}
