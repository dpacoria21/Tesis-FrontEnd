import { describe, expect, it } from 'vitest'
import {
  createPedagogicalEvent,
  validatePedagogicalEvent,
} from './events'
import { createStudentState, recordHelpUsage } from './model'
import {
  LocalTutorRepository,
  MemoryStorageAdapter,
  TUTOR_STATE_STORAGE_KEY,
} from './repository'

function event(eventId = 'event-1') {
  return createPedagogicalEvent({
    eventId,
    responseId: 'response-1',
    studentId: 'student-demo',
    problemId: 'p1',
    occurredAt: '2026-09-03T12:30:00.000Z',
    intent: 'strategy',
    selectedHelpLevel: 'N3',
    reasonCodes: ['progressive_disclosure'],
    sources: [
      { sourceId: 'source-1', chunkId: 'chunk-1', title: 'Arrays' },
    ],
    protection: { signals: [], action: 'none' },
    evidenceSufficient: true,
    latencyMs: 12.7,
  })
}

describe('LocalTutorRepository', () => {
  it('creates, updates and recovers a student through an injected adapter', () => {
    const storage = new MemoryStorageAdapter()
    const firstRepository = new LocalTutorRepository(storage)
    const created = firstRepository.getOrCreateStudent('student-demo')
    const updated = recordHelpUsage(created, {
      problemId: 'p1',
      level: 'N2',
      occurredAt: '2026-09-03T12:00:00.000Z',
    })
    firstRepository.saveStudent(updated)

    const secondRepository = new LocalTutorRepository(storage)
    expect(secondRepository.getStudent('student-demo')).toEqual(updated)
    expect(secondRepository.getStudent('missing')).toBeNull()
  })

  it('deduplicates identical events and rejects id collisions', () => {
    const repository = new LocalTutorRepository(new MemoryStorageAdapter())
    expect(repository.appendPedagogicalEvent(event()).inserted).toBe(true)
    expect(repository.appendPedagogicalEvent(event()).inserted).toBe(false)
    expect(repository.listPedagogicalEvents('student-demo')).toHaveLength(1)

    expect(() =>
      repository.appendPedagogicalEvent({
        ...event(),
        selectedHelpLevel: 'N2',
      }),
    ).toThrow(/id collision/)
  })

  it('validates the complete pedagogical event schema', () => {
    expect(event()).toMatchObject({
      schemaVersion: 1,
      latencyMs: 13,
      protection: { action: 'none', signals: [] },
    })
    const validation = validatePedagogicalEvent({
      ...event('invalid-event'),
      schemaVersion: undefined,
      latencyMs: -1,
    })
    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(
      expect.arrayContaining(['unsupported schemaVersion', 'latencyMs must be a non-negative number']),
    )
  })

  it('rejects a stale revision instead of overwriting newer state', () => {
    const repository = new LocalTutorRepository(new MemoryStorageAdapter())
    const initial = repository.getOrCreateStudent('student-demo')
    const current = recordHelpUsage(initial, {
      problemId: 'p1',
      level: 'N1',
      occurredAt: '2026-09-03T12:00:00.000Z',
    })
    repository.saveStudent(current)

    expect(() => repository.saveStudent(initial)).toThrow(/Stale student revision/)
  })

  it('migrates the documented v0 envelope to the separate v1 key', () => {
    const storage = new MemoryStorageAdapter()
    const legacyStudent = createStudentState('student-demo')
    storage.setItem(
      TUTOR_STATE_STORAGE_KEY,
      JSON.stringify({ version: 0, students: [legacyStudent], events: [event()] }),
    )

    const repository = new LocalTutorRepository(storage)
    expect(repository.getStudent('student-demo')).toEqual(legacyStudent)
    expect(repository.listPedagogicalEvents('student-demo')).toHaveLength(1)
    expect(JSON.parse(storage.getItem(TUTOR_STATE_STORAGE_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
    })
  })

  it('does not silently erase corrupt persisted data', () => {
    const storage = new MemoryStorageAdapter()
    storage.setItem(TUTOR_STATE_STORAGE_KEY, '{not-json')

    expect(() => new LocalTutorRepository(storage).getStudent('student-demo')).toThrow(
      /not valid JSON/,
    )
  })
})
