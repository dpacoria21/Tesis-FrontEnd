import type { TutorIntent } from '../domain'

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE')
}

export function inferTutorIntent(question: string): TutorIntent {
  const value = normalized(question)
  if (/\b(recomienda|recomendacion|siguiente problema|que practico)\b/.test(value)) {
    return 'recommendation'
  }
  if (
    /\b(codigo|programa|solucion|respuesta)\b.{0,28}\b(completo|completa|final|exacto|lista|listo)\b/.test(
      value,
    ) || /\b(resuelvelo|resuelve el problema)\b/.test(value)
  ) {
    return 'solution'
  }
  if (/\b(error|falla|bug|compila|runtime|linea|depur|intento|wrong answer)\b/.test(value)) {
    return 'debug'
  }
  if (/\b(estrategia|idea|algoritmo|observacion|enfoque|como organizo)\b/.test(value)) {
    return 'strategy'
  }
  if (/\b(concepto|explica|por que|invariante|complejidad|prerrequisito)\b/.test(value)) {
    return 'concept'
  }
  if (/\b(entender|comprender|enunciado|entrada|salida|objetivo)\b/.test(value)) {
    return 'understand'
  }
  return 'clarify'
}

