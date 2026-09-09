import type { CorpusDocumentInput, CorpusSource } from './schema'

export const DEMONSTRATION_CORPUS_MANIFEST = {
  id: 'momentum-tutor-demo-es',
  version: '1.0.0',
  label: 'demonstration_fixture',
  synthetic: true,
  incorporatedAt: '2026-09-02',
  provenance:
    'Contenido original mínimo creado para verificar el prototipo; no reproduce enunciados ni editoriales de jueces externos.',
  rightsNote:
    'Uso académico interno del prototipo. No se afirma que represente el corpus final ni datos reales de estudiantes.',
} as const

function fixtureSource(externalId: string, title: string): CorpusSource {
  return {
    kind: 'demonstration_fixture',
    provider: 'Momentum Tutor - tesis',
    externalId,
    title,
    license: 'uso_demostrativo_interno',
    attribution: 'Fixture sintético original del prototipo Momentum Tutor',
    incorporatedAt: DEMONSTRATION_CORPUS_MANIFEST.incorporatedAt,
    synthetic: true,
    provenance: DEMONSTRATION_CORPUS_MANIFEST.provenance,
  }
}

export const DEMONSTRATION_CORPUS: readonly CorpusDocumentInput[] = [
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Suma de dos mediciones',
    statement:
      'Se reciben dos enteros a y b. Calcula y muestra a + b sin modificar los valores originales.',
    constraints: ['-10^9 <= a, b <= 10^9', 'La suma cabe en un entero con signo de 64 bits'],
    examples: [
      {
        input: '7 -2',
        output: '5',
        explanation: 'La suma algebraica de 7 y -2 es 5.',
      },
    ],
    tags: ['implementation', 'math'],
    topics: ['entrada y salida', 'aritmética'],
    rating: 800,
    difficulty: 'introductory',
    concepts: ['tipos enteros', 'operador suma'],
    prerequisites: [],
    strategy: {
      summary: 'Leer ambos enteros, sumarlos una vez y escribir el resultado.',
      steps: ['Lee a y b.', 'Calcula a + b con un tipo suficientemente amplio.', 'Imprime la suma.'],
      complexity: { time: 'O(1)', space: 'O(1)' },
      implementationNotes: ['Usa un entero de 64 bits para cubrir los límites indicados.'],
    },
    editorial:
      'La única operación necesaria es la suma. Tras leer a y b en variables de 64 bits, se evalúa su suma y se imprime. No se requieren ciclos ni estructuras auxiliares.',
    source: fixtureSource('demo-suma-mediciones', 'Suma de dos mediciones'),
  },
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Mayor temperatura registrada',
    statement:
      'Dada una secuencia de n temperaturas enteras, encuentra el valor máximo observado.',
    constraints: ['1 <= n <= 2 * 10^5', '-10^9 <= temperatura_i <= 10^9'],
    examples: [
      {
        input: '5\n-4 3 9 2 9',
        output: '9',
        explanation: 'Ninguna temperatura supera 9.',
      },
    ],
    tags: ['arrays', 'implementation'],
    topics: ['arreglos', 'recorrido lineal'],
    rating: 800,
    difficulty: 'introductory',
    concepts: ['invariante de máximo', 'recorrido de colección'],
    prerequisites: ['ciclos', 'comparación de enteros'],
    strategy: {
      summary: 'Mantener el máximo del prefijo ya leído durante un único recorrido.',
      steps: [
        'Inicializa el máximo con el primer elemento.',
        'Compara cada elemento restante con el máximo actual.',
        'Actualiza cuando encuentres un valor mayor y al final imprime el máximo.',
      ],
      complexity: { time: 'O(n)', space: 'O(1)' },
      implementationNotes: ['No inicialices el máximo en cero porque todos los valores podrían ser negativos.'],
    },
    editorial:
      'Después de tomar el primer valor como máximo provisional, se inspecciona cada posición exactamente una vez. El invariante es que, antes de avanzar, la variable guarda el máximo del prefijo procesado.',
    source: fixtureSource('demo-mayor-temperatura', 'Mayor temperatura registrada'),
  },
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Frecuencia de un código',
    statement:
      'Dada una lista de n códigos enteros y un código objetivo x, indica cuántas veces aparece x.',
    constraints: ['1 <= n <= 2 * 10^5', '-10^9 <= codigo_i, x <= 10^9'],
    examples: [
      {
        input: '6 4\n4 1 4 2 4 5',
        output: '3',
        explanation: 'El código 4 aparece en las posiciones 1, 3 y 5.',
      },
    ],
    tags: ['arrays', 'counting'],
    topics: ['frecuencias', 'recorrido lineal'],
    rating: 850,
    difficulty: 'introductory',
    concepts: ['contador', 'comparación por igualdad'],
    prerequisites: ['ciclos', 'arreglos'],
    strategy: {
      summary: 'Incrementar un contador únicamente cuando el elemento leído sea igual al objetivo.',
      steps: [
        'Inicializa el contador en cero.',
        'Recorre los n códigos y compara cada uno con x.',
        'Incrementa ante una coincidencia e imprime el contador.',
      ],
      complexity: { time: 'O(n)', space: 'O(1)' },
      implementationNotes: ['Una tabla hash solo sería necesaria si se consultaran muchos objetivos distintos.'],
    },
    editorial:
      'Para una sola consulta basta un recorrido. El contador representa el número de coincidencias encontradas en el prefijo procesado y solo cambia cuando el elemento actual es x.',
    source: fixtureSource('demo-frecuencia-codigo', 'Frecuencia de un código'),
  },
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Paréntesis de laboratorio',
    statement:
      'Determina si una cadena formada solo por paréntesis de apertura y cierre está balanceada.',
    constraints: ['1 <= longitud(s) <= 2 * 10^5', 'Cada carácter de s es ( o )'],
    examples: [
      {
        input: '(())()',
        output: 'SI',
        explanation: 'Cada cierre tiene una apertura previa y al final no queda ninguna pendiente.',
      },
      {
        input: '())(',
        output: 'NO',
        explanation: 'El tercer carácter intenta cerrar cuando no hay una apertura pendiente.',
      },
    ],
    tags: ['data structures', 'strings'],
    topics: ['pilas', 'invariantes de prefijo'],
    rating: 950,
    difficulty: 'basic',
    concepts: ['balance acumulado', 'prefijo válido'],
    prerequisites: ['cadenas', 'ciclos', 'condicionales'],
    strategy: {
      summary: 'Usar un balance que aumenta al abrir y disminuye al cerrar, sin permitir valores negativos.',
      steps: [
        'Inicializa balance en cero.',
        'Actualiza el balance para cada carácter y rechaza si se vuelve negativo.',
        'Acepta solo si el balance final es cero.',
      ],
      complexity: { time: 'O(n)', space: 'O(1)' },
      implementationNotes: ['Con un solo tipo de paréntesis, un contador reemplaza a una pila explícita.'],
    },
    editorial:
      'Un prefijo nunca puede contener más cierres que aperturas, por lo que el balance no debe ser negativo. Al terminar, balance cero garantiza que tampoco quedaron aperturas sin cerrar.',
    source: fixtureSource('demo-parentesis-laboratorio', 'Paréntesis de laboratorio'),
  },
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Tramo dentro del presupuesto',
    statement:
      'Dado un arreglo de costos positivos y un presupuesto B, encuentra la mayor longitud de un segmento contiguo cuya suma no exceda B.',
    constraints: ['1 <= n <= 2 * 10^5', '1 <= costo_i <= 10^9', '1 <= B <= 10^18'],
    examples: [
      {
        input: '5 7\n2 1 3 2 4',
        output: '3',
        explanation: 'El segmento 2, 1, 3 suma 6 y tiene longitud 3; no existe uno válido más largo.',
      },
    ],
    tags: ['arrays', 'two pointers'],
    topics: ['ventana deslizante', 'segmentos contiguos'],
    rating: 1100,
    difficulty: 'basic',
    concepts: ['dos punteros', 'suma de ventana'],
    prerequisites: ['arreglos', 'ciclos', 'complejidad lineal'],
    strategy: {
      summary: 'Expandir el extremo derecho y mover el izquierdo mientras la suma supere el presupuesto.',
      steps: [
        'Mantén izquierda, suma y mejor longitud.',
        'Agrega cada nuevo costo al avanzar derecha.',
        'Mientras la suma sea mayor que B, resta el costo izquierdo y avanza izquierda.',
        'Actualiza la mejor longitud de la ventana válida.',
      ],
      complexity: { time: 'O(n)', space: 'O(1)' },
      implementationNotes: [
        'La técnica depende de que todos los costos sean positivos.',
        'Usa 64 bits para la suma acumulada.',
      ],
    },
    editorial:
      'Como los costos son positivos, al crecer la ventana la suma no disminuye y al retirar elementos desde la izquierda no aumenta. Esta monotonía permite que cada puntero avance como máximo n veces.',
    source: fixtureSource('demo-tramo-presupuesto', 'Tramo dentro del presupuesto'),
  },
  {
    schemaVersion: 1,
    language: 'es',
    programmingLanguages: ['cpp17', 'python3'],
    title: 'Salas conectadas',
    statement:
      'Un edificio se modela como un grafo no dirigido de n salas y m pasillos. Indica cuántas salas son alcanzables desde la sala 1.',
    constraints: ['1 <= n <= 2 * 10^5', '0 <= m <= 2 * 10^5', 'No hay pasillos de una sala hacia sí misma'],
    examples: [
      {
        input: '5 3\n1 2\n2 3\n4 5',
        output: '3',
        explanation: 'Desde la sala 1 se llega a 1, 2 y 3; el componente 4, 5 está separado.',
      },
    ],
    tags: ['graphs', 'dfs and similar'],
    topics: ['grafos', 'búsqueda en anchura'],
    rating: 1100,
    difficulty: 'basic',
    concepts: ['lista de adyacencia', 'visitados', 'bfs'],
    prerequisites: ['colas', 'arreglos', 'ciclos'],
    strategy: {
      summary: 'Recorrer con BFS el componente conectado que contiene a la sala 1.',
      steps: [
        'Construye la lista de adyacencia del grafo no dirigido.',
        'Marca la sala 1, insértala en una cola y procesa sus vecinos no visitados.',
        'Cuenta cada sala en el momento de marcarla.',
      ],
      complexity: { time: 'O(n + m)', space: 'O(n + m)' },
      implementationNotes: ['Marca una sala antes de encolarla para no insertarla varias veces.'],
    },
    editorial:
      'BFS visita exactamente el componente de la fuente. La marca de visitado evita ciclos y duplicados; el contador de marcas es, por definición, la cantidad de salas alcanzables desde 1.',
    source: fixtureSource('demo-salas-conectadas', 'Salas conectadas'),
  },
] satisfies readonly CorpusDocumentInput[]
