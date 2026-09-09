import { describe, expect, it } from 'vitest'
import { inferTutorIntent } from './intent'

describe('clasificación explícita de intención', () => {
  it.each([
    ['Recomienda el siguiente problema', 'recommendation'],
    ['Dame el código completo y listo', 'solution'],
    ['Mi intento falla en la línea 4', 'debug'],
    ['¿Qué estrategia debería intentar?', 'strategy'],
    ['Explica el invariante', 'concept'],
    ['No entiendo la salida del enunciado', 'understand'],
    ['Necesito ayuda', 'clarify'],
  ] as const)('clasifica %s', (query, expected) => {
    expect(inferTutorIntent(query)).toBe(expected)
  })
})

