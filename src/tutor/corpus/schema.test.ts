import { describe, expect, it } from 'vitest'
import { DEMONSTRATION_CORPUS } from './fixture'
import {
  buildCorpusChunks,
  corpusDocumentId,
  materializeCorpusDocument,
  validateCorpusDocument,
} from './schema'

describe('corpus schema', () => {
  it('validates every synthetic fixture and preserves traceable provenance', () => {
    for (const input of DEMONSTRATION_CORPUS) {
      const result = validateCorpusDocument(input)
      expect(result.valid).toBe(true)
      if (!result.valid) continue
      expect(result.value.source.kind).toBe('demonstration_fixture')
      expect(result.value.source.synthetic).toBe(true)
      expect(result.value.source.provenance).toContain('Contenido original')
      expect(result.value.source.incorporatedAt).toBe('2026-09-02')
    }
  })

  it('rejects missing, malformed and contradictory fields with paths', () => {
    const invalid = structuredClone(DEMONSTRATION_CORPUS[0]) as unknown as Record<string, unknown>
    delete invalid.editorial
    invalid.rating = 6000
    invalid.language = 'spanish'
    const source = invalid.source as Record<string, unknown>
    source.incorporatedAt = '2026-02-31'
    source.synthetic = false

    const result = validateCorpusDocument(invalid)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        '$.editorial',
        '$.rating',
        '$.language',
        '$.source.incorporatedAt',
        '$.source.synthetic',
      ]),
    )
  })

  it('derives a reproducible identity from normalized source identity', () => {
    const firstResult = validateCorpusDocument(DEMONSTRATION_CORPUS[0])
    const equivalent = structuredClone(DEMONSTRATION_CORPUS[0])
    equivalent.source.provider = `  ${equivalent.source.provider}  `
    equivalent.source.externalId = equivalent.source.externalId.toLocaleUpperCase('es-PE')
    equivalent.tags.reverse()
    const secondResult = validateCorpusDocument(equivalent)
    expect(firstResult.valid).toBe(true)
    expect(secondResult.valid).toBe(true)
    if (!firstResult.valid || !secondResult.valid) return

    expect(corpusDocumentId(firstResult.value)).toBe(corpusDocumentId(secondResult.value))
    expect(corpusDocumentId(firstResult.value)).toBe(
      'kd_demo-suma-mediciones_f37e101258e78e86',
    )
    expect(firstResult.value.strategy.steps).toEqual(DEMONSTRATION_CORPUS[0].strategy.steps)
  })

  it('creates stable chunks with explicit pedagogical access levels', () => {
    const documents = DEMONSTRATION_CORPUS.map(materializeCorpusDocument)
    const first = buildCorpusChunks(documents)
    const second = buildCorpusChunks([...documents].reverse())

    expect(first).toEqual(second)
    expect(first).toHaveLength(DEMONSTRATION_CORPUS.length * 7)
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length)
    expect(first.filter((chunk) => chunk.metadata.accessLevel === 'solution')).toHaveLength(
      DEMONSTRATION_CORPUS.length,
    )
    expect(first.every((chunk) => chunk.source.synthetic)).toBe(true)
  })
})
