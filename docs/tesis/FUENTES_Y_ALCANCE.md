# Fuentes, autoridad y alcance del corte

## Fuentes académicas localizadas

| Fuente | Ubicación | Integridad | Uso |
|---|---|---|---|
| Tesis, Matriz 6 | C:\Users\diego\AppData\Local\Temp\codex-file-preview-B4vrjJ\02-PacoriAnccasiDiegoIvan_PTv6.docx | SHA-256 86EC83ACF7A0D7EEE411CDC3AD94EE545C0B6509F222FC88FB8DD3E72F22D06A | Fuente académica más reciente encontrada; portada 2026 y contenido sin marcadores provisionales |
| Tesis, Matriz 5 | C:\Users\diego\Downloads\PacoriAnccasiDiegoIvan_PTv6.docx | SHA-256 4D3EAEE799717D4F6CF2752DFD9491C054E62B5BA186553DA7D97A20029370F3 | Referencia histórica; contiene texto provisional y no prevalece sobre Matriz 6 |
| Cronograma | C:\Users\diego\Downloads\Cronograma_Tesis_PacoriAnccasi.xlsx | SHA-256 4DAE64658756BECC7B86210A9701DB816E656134180EC19D612809BFE2270A73 | Fuente primaria de fechas por actividad |
| Cronograma, copia | C:\Users\diego\Downloads\Cronograma_Tesis_PacoriAnccasi (1).xlsx | SHA-256 555E508FFF8D57EE63371E704F9FBDFF79B6D6D890951069A34D4CE3225063DF | Mismas actividades; añade marcas agregadas por objetivo |

No se encontró un archivo llamado exactamente Copia de
Cronograma_Tesis_PacoriAnccasi.xlsx. La revisión Matriz 6 está en una ruta
temporal; este resumen conserva su contenido relevante y hash, pero conviene que
el tesista archive el original definitivo en una ubicación estable.

## Jerarquía usada

1. El objetivo activo y PROMPT_CODEX_TESIS_POR_FASES.md definen entregables,
   restricciones y criterios de aceptación.
2. Los AGENTS.md aplicables gobernarían el repositorio; no se encontró ninguno.
3. La Matriz 6 aporta objetivos, metodología, población y contexto académico.
4. El XLSX aporta fechas y celdas del cronograma.
5. Código, ejecución y pruebas demuestran el estado técnico real.

Las X del cronograma expresan planificación, no evidencia de implementación.

## Corte observado en el XLSX

- Hoja1!O19:P19: ingesta y embeddings, julio S3–S4.
- Hoja1!Q20:R20: recuperación híbrida, agosto S1–S2.
- Hoja1!R21:T21: explicaciones, pistas, feedback y recomendación, agosto S2–S4.
- Hoja1!U22: interfaz integrada, septiembre S1.
- Hoja1!U23:V23: pruebas funcionales y corrección, septiembre S1–S2.
- Hoja1!V24: informe del prototipo, septiembre S2.
- Hoja1!W26: protocolo de evaluación, septiembre S3.
- Hoja1!X27:Y27: pruebas evaluativas, septiembre S4–octubre S1.

## Decisiones ante discrepancias

- El objetivo explícito exige ahora el informe de avance y el protocolo, aunque
  el XLSX los sitúa en S2 y S3. Se producirán como adelantos y se etiquetarán así
  en la auditoría.
- La Matriz 6 describe Adaptive-RAG, PageIndex, Self-RAG y niveles N0–N6. El
  objetivo activo simplifica el camino principal a BM25, dense, RRF y niveles
  N0–N5. Los componentes avanzados quedan fuera del camino crítico porque no
  están implementados ni tienen evidencia en este corpus.
- La metodología original menciona ROUGE-L, BERTScore y LLM-as-a-Judge. Se
  conservarán solo como complementos; recuperación, leakage, conducta observable
  y revisión humana serán evidencia principal.
- El producto actual está personalizado para Fernando_Benito. El tutor nuevo
  debe usar un perfil genérico de estudiante ingresante; los datos del entrenador
  existente se conservarán como funcionalidad heredada, no como población de
  evaluación.

## Objetivos académicos extraídos

Objetivo general: desarrollar un tutor inteligente con RAG híbrido para mejorar
el apoyo al aprendizaje de programación competitiva en estudiantes ingresantes.

Objetivos específicos relevantes al prototipo:

1. Analizar el estado del arte de tutores inteligentes, RAG, LLM y herramientas
   para aprender programación competitiva.
2. Diseñar una arquitectura híbrida que recupere conceptos, problemas,
   etiquetas, dificultad y estrategias.
3. Implementar explicaciones, pistas progresivas, feedback y recomendaciones.
4. Preparar la evaluación de relevancia, precisión, fundamentación, coherencia y
   utilidad pedagógica.
5. Dejar la validación definitiva con estudiantes para una fase posterior.

## Límites académicos

- Población objetivo: estudiantes ingresantes o de nivel básico.
- Plataformas principales descritas: Codeforces y AtCoder.
- Fuentes conceptuales descritas: CP-Algorithms y USACO Guide.
- No entrenar un LLM propio.
- No afirmar impacto longitudinal, causalidad o validación institucional.
- Toda medición actual es una prueba técnica preliminar.

