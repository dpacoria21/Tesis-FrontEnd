import { describe, expect, it } from 'vitest'
import type { HelpLevel, TutorEvidence } from '../domain'
import type { HelpDecision } from './helpPolicy'
import {
  DeterministicTutorGenerator,
  renderTutorResponse,
  validateTutorResponse,
} from './generator'
import { inspectGeneratedText } from './leakageGuard'

const evidence: TutorEvidence = {
  sourceId: 'cp-handbook-demo',
  chunkId: 'arrays-1',
  title: 'Arreglos y prefijos',
  uri: 'https://example.test/arrays',
  excerpt:
    'Una suma prefija conserva el acumulado hasta cada posición y evita repetir el recorrido.',
  concepts: ['prefix sums'],
  accessLevel: 'N0',
}

function decision(level: HelpLevel): HelpDecision {
  return {
    requestedLevel: level,
    selectedLevel: level,
    previousLevel: null,
    reasonCodes: ['intent_mapped'],
    explanation: 'Decisión de prueba.',
    protectionActivated: false,
    mayRevealCompleteSolution: level === 'N5',
  }
}

describe('DeterministicTutorGenerator', () => {
  it.each<HelpLevel>(['N0', 'N1', 'N2', 'N3', 'N4', 'N5'])(
    'returns a valid, cited and safe %s response',
    async (level) => {
      const response = await new DeterministicTutorGenerator().generate({
        responseId: `response-${level}`,
        intent: level === 'N5' ? 'solution' : 'strategy',
        problemTitle: 'Consultas de rango',
        question: '¿Cómo avanzo?',
        decision: decision(level),
        evidence: [evidence],
        evidenceSufficient: true,
      })

      expect(validateTutorResponse(response)).toEqual({ valid: true, errors: [] })
      expect(response).toMatchObject({
        helpLevel: level,
        grounded: true,
        fallback: false,
      })
      expect(response.sources).toEqual([
        expect.objectContaining({ sourceId: evidence.sourceId, chunkId: evidence.chunkId }),
      ])
      expect(
        inspectGeneratedText({
          text: renderTutorResponse(response),
          selectedLevel: level,
        }).leaksSolution,
      ).toBe(false)
    },
  )

  it('uses a prudent fallback and claims no sources when evidence is insufficient', async () => {
    const response = await new DeterministicTutorGenerator().generate({
      responseId: 'response-fallback',
      intent: 'concept',
      problemTitle: 'Problema desconocido',
      question: '¿Cuál es la solución?',
      decision: decision('N2'),
      evidence: [],
      evidenceSufficient: false,
    })

    expect(response).toMatchObject({
      grounded: false,
      fallback: true,
      sources: [],
    })
    expect(response.content.explanation).toContain('evidencia suficiente')
  })

  it('does not expose evidence above the selected access level', async () => {
    const response = await new DeterministicTutorGenerator().generate({
      responseId: 'response-filtered',
      intent: 'understand',
      problemTitle: 'Problema demo',
      question: 'Ayuda',
      decision: decision('N1'),
      evidence: [{ ...evidence, accessLevel: 'N4' }],
      evidenceSufficient: true,
    })

    expect(response.grounded).toBe(false)
    expect(response.sources).toEqual([])
  })

  it('rejects an empty response identifier', async () => {
    await expect(
      new DeterministicTutorGenerator().generate({
        responseId: ' ',
        intent: 'concept',
        problemTitle: 'Demo',
        question: 'Ayuda',
        decision: decision('N2'),
        evidence: [evidence],
        evidenceSufficient: true,
      }),
    ).rejects.toThrow(/responseId/)
  })
})

