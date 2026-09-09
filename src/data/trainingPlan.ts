import type { SessionCause } from '../types'

export type TrainingWeekNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12

export type TrainingCheckpointWeek = 4 | 8 | 12

export type TrainingPhaseId =
  | 'reactivacion_precision'
  | 'dp_greedy'
  | 'binary_search_two_pointers'
  | 'grafos_ds_velocidad'
  | 'matematica_invariantes'
  | 'simulacion_competitiva'

export type TrainingMetricKey =
  | 'active_days_per_week'
  | 'deliberate_accepts_per_week'
  | 'first_submit_rate_le_1500'
  | 'wrong_answers_per_solved_problem'
  | 'rating_1600_accepts_per_week'
  | 'rating_1700_plus_accepts_per_week'
  | 'upsolve_first_unsolved'
  | 'div3_ab_time'
  | 'contests_or_virtuals'
  | 'contest_performance'

export interface TrainingMetricTarget {
  key: TrainingMetricKey
  label: string
  target: string
}

export interface TrainingCheckpoint {
  week: TrainingCheckpointWeek
  label: string
  targets: readonly TrainingMetricTarget[]
}

export interface TrainingPhase {
  id: TrainingPhaseId
  label: string
  startWeek: TrainingWeekNumber
  endWeek: TrainingWeekNumber
  startDate: string
  endDate: string
  trainingBand: string
  goal: string
}

export interface TrainingWeek {
  week: TrainingWeekNumber
  phaseId: TrainingPhaseId
  startDate: string
  endDate: string
  dateLabel: string
  focus: string
  minimumWork: string
  milestone: string
  checkpoint?: TrainingCheckpoint
}

export type SessionProtocolTrigger =
  | 'FIRST_10_MINUTES'
  | 'MINUTES_10_TO_35'
  | 'BEFORE_SUBMIT'
  | 'AFTER_FIRST_WA'
  | 'AFTER_SECOND_WA'
  | 'AFTER_SECOND_TLE'

export interface SessionProtocolStep {
  trigger: SessionProtocolTrigger
  label: string
  instruction: string
}

export interface FailureCauseDefinition {
  value: SessionCause
  label: string
  description: string
}

const CHECKPOINTS: Readonly<
  Record<TrainingCheckpointWeek, TrainingCheckpoint>
> = {
  4: {
    week: 4,
    label: 'Objetivo de la semana 4',
    targets: [
      {
        key: 'active_days_per_week',
        label: 'Días activos por semana',
        target: '≥5',
      },
      {
        key: 'deliberate_accepts_per_week',
        label: 'AC deliberados por semana',
        target: '6',
      },
      {
        key: 'first_submit_rate_le_1500',
        label: 'AC al primer submit en problemas de rating ≤1500',
        target: '≥70%',
      },
      {
        key: 'wrong_answers_per_solved_problem',
        label: 'WA por problema resuelto',
        target: '≤1.0',
      },
      {
        key: 'rating_1600_accepts_per_week',
        label: 'Problemas de rating 1600 resueltos por semana',
        target: '≥1',
      },
      {
        key: 'rating_1700_plus_accepts_per_week',
        label: 'Problemas de rating 1700+ resueltos por semana',
        target: '0-1',
      },
      {
        key: 'upsolve_first_unsolved',
        label: 'Upsolve del primer problema no resuelto',
        target: '≤48 h',
      },
      {
        key: 'div3_ab_time',
        label: 'Tiempo en A/B de Div. 3',
        target: 'Registrar baseline',
      },
      {
        key: 'contests_or_virtuals',
        label: 'Contests o virtuales',
        target: '1 por semana',
      },
      {
        key: 'contest_performance',
        label: 'Performance de contest',
        target: 'Establecer baseline',
      },
    ],
  },
  8: {
    week: 8,
    label: 'Objetivo de la semana 8',
    targets: [
      {
        key: 'active_days_per_week',
        label: 'Días activos por semana',
        target: '≥5',
      },
      {
        key: 'deliberate_accepts_per_week',
        label: 'AC deliberados por semana',
        target: '6',
      },
      {
        key: 'first_submit_rate_le_1500',
        label: 'AC al primer submit en problemas de rating ≤1500',
        target: '≥80%',
      },
      {
        key: 'wrong_answers_per_solved_problem',
        label: 'WA por problema resuelto',
        target: '≤0.7',
      },
      {
        key: 'rating_1600_accepts_per_week',
        label: 'Problemas de rating 1600 resueltos por semana',
        target: '≥2',
      },
      {
        key: 'rating_1700_plus_accepts_per_week',
        label: 'Problemas de rating 1700+ resueltos por semana',
        target: '≥1',
      },
      {
        key: 'upsolve_first_unsolved',
        label: 'Upsolve del primer problema no resuelto',
        target: '≤36 h',
      },
      {
        key: 'div3_ab_time',
        label: 'Tiempo en A/B de Div. 3',
        target: '-15% frente al baseline',
      },
      {
        key: 'contests_or_virtuals',
        label: 'Contests o virtuales',
        target: '1-2 por semana',
      },
      {
        key: 'contest_performance',
        label: 'Performance de contest',
        target: 'Mediana ≥1450',
      },
    ],
  },
  12: {
    week: 12,
    label: 'Objetivo de la semana 12',
    targets: [
      {
        key: 'active_days_per_week',
        label: 'Días activos por semana',
        target: '≥5',
      },
      {
        key: 'deliberate_accepts_per_week',
        label: 'AC deliberados por semana',
        target: '6',
      },
      {
        key: 'first_submit_rate_le_1500',
        label: 'AC al primer submit en problemas de rating ≤1500',
        target: '≥85%',
      },
      {
        key: 'wrong_answers_per_solved_problem',
        label: 'WA por problema resuelto',
        target: '≤0.5',
      },
      {
        key: 'rating_1600_accepts_per_week',
        label: 'Problemas de rating 1600 resueltos por semana',
        target: '≥2',
      },
      {
        key: 'rating_1700_plus_accepts_per_week',
        label: 'Problemas de rating 1700+ resueltos por semana',
        target: '1-2',
      },
      {
        key: 'upsolve_first_unsolved',
        label: 'Upsolve del primer problema no resuelto',
        target: '≤24 h',
      },
      {
        key: 'div3_ab_time',
        label: 'Tiempo en A/B de Div. 3',
        target: '-25% frente al baseline',
      },
      {
        key: 'contests_or_virtuals',
        label: 'Contests o virtuales',
        target: '1-2 por semana',
      },
      {
        key: 'contest_performance',
        label: 'Performance de contest',
        target: 'Mediana ≥1500',
      },
    ],
  },
}

export const TRAINING_PHASES = [
  {
    id: 'reactivacion_precision',
    label: 'Reactivación y precisión',
    startWeek: 1,
    endWeek: 2,
    startDate: '2026-08-17',
    endDate: '2026-08-30',
    trainingBand: '1200-1500',
    goal: 'Reducir los WA tempranos',
  },
  {
    id: 'dp_greedy',
    label: 'DP y greedy',
    startWeek: 3,
    endWeek: 4,
    startDate: '2026-08-31',
    endDate: '2026-09-13',
    trainingBand: '1500-1600',
    goal: 'Cerrar Flowers y THU Packing Puzzle',
  },
  {
    id: 'binary_search_two_pointers',
    label: 'Binary search y two pointers',
    startWeek: 5,
    endWeek: 6,
    startDate: '2026-09-14',
    endDate: '2026-09-27',
    trainingBand: '1600-1700',
    goal: 'Completar el primer stretch de rating 1800+',
  },
  {
    id: 'grafos_ds_velocidad',
    label: 'Grafos, estructuras de datos y velocidad',
    startWeek: 7,
    endWeek: 8,
    startDate: '2026-09-28',
    endDate: '2026-10-11',
    trainingBand: 'Contests frecuentes',
    goal: 'Volver a Specialist',
  },
  {
    id: 'matematica_invariantes',
    label: 'Matemática e invariantes',
    startWeek: 9,
    endWeek: 10,
    startDate: '2026-10-12',
    endDate: '2026-10-25',
    trainingBand: '1700-1900',
    goal: 'Cerrar deudas antiguas y controlar los TLE',
  },
  {
    id: 'simulacion_competitiva',
    label: 'Simulación competitiva',
    startWeek: 11,
    endWeek: 12,
    startDate: '2026-10-26',
    endDate: '2026-11-08',
    trainingBand: 'Pico de forma',
    goal: 'Atacar un nivel estable de 1500-1600',
  },
] as const satisfies readonly TrainingPhase[]

export const TRAINING_WEEKS = [
  {
    week: 1,
    phaseId: 'reactivacion_precision',
    startDate: '2026-08-17',
    endDate: '2026-08-23',
    dateLabel: '17-23 ago.',
    focus: 'Reactivación',
    minimumWork:
      '4 problemas de rating 1300-1400, THU Packing Puzzle y 1 virtual Div. 3.',
    milestone:
      '≥6 AC y ≥75% de AC al primer submit en problemas de rating ≤1400.',
  },
  {
    week: 2,
    phaseId: 'reactivacion_precision',
    startDate: '2026-08-24',
    endDate: '2026-08-30',
    dateLabel: '24-30 ago.',
    focus: 'Implementación fiable',
    minimumWork:
      '3 problemas de rating 1400, 3 de rating 1500 y re-solve de Split Into Two Sets.',
    milestone:
      'Como máximo 1 WA por problema de dificultad media y re-solve en ≤35 min.',
  },
  {
    week: 3,
    phaseId: 'dp_greedy',
    startDate: '2026-08-31',
    endDate: '2026-09-06',
    dateLabel: '31 ago.-6 sep.',
    focus: 'DP y prefix sums',
    minimumWork:
      'Flowers, 2 problemas de DP de rating 1500 y 3 problemas de DP de rating 1600.',
    milestone:
      'Flowers AC y capacidad de escribir la recurrencia antes del código.',
  },
  {
    week: 4,
    phaseId: 'dp_greedy',
    startDate: '2026-09-07',
    endDate: '2026-09-13',
    dateLabel: '7-13 sep.',
    focus: 'Greedy y constructive',
    minimumWork:
      'Silhouette y 5 problemas adicionales de rating 1400-1600.',
    milestone: '≥4 de 6 sin editorial y Silhouette en ≤30 min.',
    checkpoint: CHECKPOINTS[4],
  },
  {
    week: 5,
    phaseId: 'binary_search_two_pointers',
    startDate: '2026-09-14',
    endDate: '2026-09-20',
    dateLabel: '14-20 sep.',
    focus: 'Binary search',
    minimumWork:
      '3 problemas de rating 1500-1600 y 3 problemas de rating 1700.',
    milestone:
      '5 de 6 AC y función monótona escrita antes de programar en todos.',
  },
  {
    week: 6,
    phaseId: 'binary_search_two_pointers',
    startDate: '2026-09-21',
    endDate: '2026-09-27',
    dateLabel: '21-27 sep.',
    focus: 'Two pointers y sorting',
    minimumWork:
      '4 problemas de rating 1600 y G2 - Dances como stretch.',
    milestone:
      'G2 AC o postmortem completo después del límite de 75 min.',
  },
  {
    week: 7,
    phaseId: 'grafos_ds_velocidad',
    startDate: '2026-09-28',
    endDate: '2026-10-04',
    dateLabel: '28 sep.-4 oct.',
    focus: 'Grafos y DSU',
    minimumWork:
      'Re-solve de Cyclic Components y 5 problemas de rating 1600.',
    milestone:
      'Cyclic Components en ≤25 min y ≥80% de AC al primer submit en problemas conocidos.',
  },
  {
    week: 8,
    phaseId: 'grafos_ds_velocidad',
    startDate: '2026-10-05',
    endDate: '2026-10-11',
    dateLabel: '5-11 oct.',
    focus: 'Estructuras de datos y velocidad de contest',
    minimumWork:
      '4 problemas de rating 1600-1700 y 2 contests o virtuales.',
    milestone:
      'En Div. 3: A/B/C sin WA evitables y atacar D antes del minuto 70.',
    checkpoint: CHECKPOINTS[8],
  },
  {
    week: 9,
    phaseId: 'matematica_invariantes',
    startDate: '2026-10-12',
    endDate: '2026-10-18',
    dateLabel: '12-18 oct.',
    focus: 'Matemática',
    minimumWork:
      '3 problemas de rating 1600, 3 de rating 1700 y Nezuko in the Clearing.',
    milestone:
      '≥4 AC sin editorial y Nezuko resuelto o con una explicación formal del bloqueo.',
  },
  {
    week: 10,
    phaseId: 'matematica_invariantes',
    startDate: '2026-10-19',
    endDate: '2026-10-25',
    dateLabel: '19-25 oct.',
    focus: 'Number theory y transición a problemas difíciles',
    minimumWork:
      '4 problemas de rating 1700 y C2 - No Cost Too Great como stretch.',
    milestone:
      '3-4 AC de rating 1700; C2 solo después de cerrar la sesión base.',
  },
  {
    week: 11,
    phaseId: 'simulacion_competitiva',
    startDate: '2026-10-26',
    endDate: '2026-11-01',
    dateLabel: '26 oct.-1 nov.',
    focus: 'Simulación',
    minimumWork:
      '2 virtuales completos y upsolve de todos los problemas C/D fallados.',
    milestone:
      '≥1 virtual con performance estimada ≥1500 y 100% de upsolve en 48 h.',
  },
  {
    week: 12,
    phaseId: 'simulacion_competitiva',
    startDate: '2026-11-02',
    endDate: '2026-11-08',
    dateLabel: '2-8 nov.',
    focus: 'Pico competitivo',
    minimumWork:
      '1-2 rated contests o virtuales y 4 problemas de la debilidad detectada.',
    milestone:
      'Rating ≥1500 o, sin depender del rating, 3 contests seguidos con performance ≥1500.',
    checkpoint: CHECKPOINTS[12],
  },
] as const satisfies readonly TrainingWeek[]

export const SESSION_PROTOCOL = [
  {
    trigger: 'FIRST_10_MINUTES',
    label: 'Primeros 10 minutos',
    instruction:
      'Construir ejemplos propios, revisar límites, fijar la complejidad esperada y formular el invariante.',
  },
  {
    trigger: 'MINUTES_10_TO_35',
    label: 'Minutos 10-35',
    instruction: 'Desarrollar la solución y convertirla en código.',
  },
  {
    trigger: 'BEFORE_SUBMIT',
    label: 'Antes de enviar',
    instruction:
      'Hacer una prueba manual obligatoria y construir al menos 3 contraejemplos deliberados. Considerar n=1/2, valores máximos, duplicados, orden ascendente e inverso, todos iguales y casos que cambien una rama lógica.',
  },
  {
    trigger: 'AFTER_FIRST_WA',
    label: 'Después del primer WA',
    instruction:
      'No cambiar el código a ojo. Encontrar una entrada que vuelva falsa una afirmación concreta de la solución.',
  },
  {
    trigger: 'AFTER_SECOND_WA',
    label: 'Después del segundo WA',
    instruction:
      'Dejar de enviar y volver al enunciado para rederivar la solución desde cero durante 10 minutos.',
  },
  {
    trigger: 'AFTER_SECOND_TLE',
    label: 'Después del segundo TLE',
    instruction:
      'Volver a demostrar la complejidad asintótica. No hacer micro-optimizaciones sin esa demostración.',
  },
] as const satisfies readonly SessionProtocolStep[]

export const FAILURE_CAUSES = [
  {
    value: 'IDEA',
    label: 'Idea',
    description: 'La estrategia o el modelo de solución era incorrecto o incompleto.',
  },
  {
    value: 'IMPLEMENTATION',
    label: 'Implementación',
    description: 'La idea era correcta, pero el código no la implementó fielmente.',
  },
  {
    value: 'EDGE_CASE',
    label: 'Caso límite',
    description: 'Faltó validar una entrada extrema o una rama especial.',
  },
  {
    value: 'COMPLEXITY',
    label: 'Complejidad',
    description: 'La solución no cumplía los límites de tiempo o memoria.',
  },
  {
    value: 'MATH',
    label: 'Matemática',
    description: 'Falló una derivación, fórmula, cálculo o propiedad matemática.',
  },
  {
    value: 'READING',
    label: 'Lectura',
    description: 'Se interpretó de forma incorrecta una condición del enunciado.',
  },
  {
    value: 'PANIC_TIME',
    label: 'Pánico o tiempo',
    description: 'La presión del contest afectó la decisión, el ritmo o la verificación.',
  },
] as const satisfies readonly FailureCauseDefinition[]
