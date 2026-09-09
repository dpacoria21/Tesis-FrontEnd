# Plan de ejecución verificable

## Objetivo durable

Completar y verificar el prototipo correspondiente al corte de la semana 1 de
septiembre de 2026 de la tesis sobre un tutor inteligente con RAG híbrido para
programación competitiva, siguiendo PROMPT_CODEX_TESIS_POR_FASES.md.

## Línea base conocida

- Entorno: Windows, PowerShell, zona horaria America/Lima.
- Aplicación encontrada: SPA local-first denominada Momentum.
- Stack: React 19, TypeScript estricto, Vite 6 y Vitest 2.
- Persistencia existente: localStorage e IndexedDB.
- Integración externa existente: API pública de Codeforces.
- Metadatos Git: ausentes en la carpeta de trabajo. No se inicializará Git.
- Código fuente inventariado: 17 archivos bajo src/ y public/.
- Artefactos preexistentes: dist/, output/, logs de Vite y dependencias
  instaladas. Se consideran propiedad del usuario.

## Secuencia y estado

| Fase | Resultado | Estado |
|---|---|---|
| 0 | Preflight y estado durable | VERIFICADA |
| 1 | Auditoría, requisitos y arquitectura | VERIFICADA |
| 2 | Línea base ejecutable | VERIFICADA |
| 3 | Corpus e ingesta | VERIFICADA |
| 4 | Recuperación híbrida | VERIFICADA |
| 5 | Modelo del estudiante | VERIFICADA |
| 6 | Política pedagógica y protección | VERIFICADA |
| 7 | Retroalimentación y recomendación | VERIFICADA |
| 8 | API e interfaz integrada | EN_CURSO |
| 9 | Pruebas y corrección | PENDIENTE |
| 10 | Protocolo y conjunto de evaluación | PENDIENTE |
| 11 | Benchmark preliminar | PENDIENTE |
| 12 | Evidencias y cierre | PENDIENTE |

## Dependencias principales

1. Confirmar las fuentes académicas disponibles y extraer el corte.
2. Verificar la línea base antes de modificar código.
3. Definir contratos de datos antes de recuperación y pedagogía.
4. Implementar módulos puros y probados antes de integrarlos en la UI.
5. Fijar el protocolo y los juicios de relevancia antes del benchmark.

## Decisiones conservadoras iniciales

- Conservar la SPA y su diseño; extenderla incrementalmente.
- Mantener el funcionamiento local sin credenciales.
- Usar dobles deterministas para embeddings y LLM en pruebas.
- No considerar dist/ ni capturas preexistentes como evidencia del nuevo tutor
  hasta regenerarlas desde la versión actual.
- Tratar todos los archivos preexistentes como cambios del usuario al no existir
  historial Git.

## Backlog priorizado vigente

1. **P0 — trazabilidad:** cerrar la matriz completa del cronograma, el estado
   del arte dirigido y las decisiones técnicas sin confundir evidencia
   bibliográfica con implementación.
2. **P0 — núcleo técnico:** corpus demostrativo validado, ingesta idempotente,
   embeddings deterministas, BM25, Dense, RRF y filtros bajo un contrato común.
3. **P0 — conducta pedagógica:** estado estudiantil auditable, ayudas N0--N5,
   protección de entrada/salida, feedback localizado y recomendación explicable.
4. **P0 — integración:** recorrido completo del tutor dentro de Momentum con API
   local en proceso, fuentes visibles y eventos persistidos.
5. **P0 — verificación:** pruebas unitarias, integración y ocho escenarios E2E;
   protocolo fijado antes de medir y benchmark reproducible.
6. **P1 — cierre:** evidencias visuales reales, guía de demo, casos, limitaciones,
   informe académico y auditoría final del corte.
7. **Fuera del camino crítico:** PageIndex, Self-RAG, GraphRAG, multiagentes,
   reranking/MMR, recomendador neuronal y entrenamiento de LLM.

## Evidencia de la Fase 0

- Fuentes y alcance: `docs/tesis/FUENTES_Y_ALCANCE.md`.
- Línea base ejecutada: `docs/presentacion/RESULTADOS_PRUEBAS.md`.
- Inventario técnico y arquitectura inicial: `docs/presentacion/ARQUITECTURA.md`.
- Ausencia de Git registrada sin inicializar un repositorio.

## Evidencia de las Fases 1 y 2

- **Fase 1:** `docs/tesis/ESTADO_CRONOGRAMA.md`,
  `docs/tesis/AUDITORIA_TECNICA_INICIAL.md`, `docs/tesis/REQUISITOS.md`,
  `docs/tesis/ESTADO_ARTE_Y_DECISIONES.md` y
  `docs/presentacion/ARQUITECTURA.md` cubren las 25 actividades auditadas, el
  alcance, las fuentes, las decisiones, la brecha, los contratos y el backlog.
- **Fase 2:** `pnpm install --frozen-lockfile`, typecheck, 18 pruebas de línea
  base, build, preview y healthcheck HTTP 200 fueron ejecutados. Los comandos y
  resultados exactos están en `docs/presentacion/RESULTADOS_PRUEBAS.md`.

## Evidencia de las Fases 3 a 7

- **Fase 3:** `pnpm tutor:ingest` informó 6 documentos, 42 chunks, segunda
  ingesta con 6 omitidos y cero rechazados, y segundo índice con 42 vectores
  reutilizados. Digests de snapshot e índice permanecieron estables.
- **Fase 4:** `src/tutor/retrieval/` implementa el contrato común BM25, Dense,
  Hybrid RRF y Hybrid RRF con filtros; sus rankings, contribuciones, metadatos y
  fuentes son auditables.
- **Fase 5:** `src/tutor/student/` persiste estado v1 y eventos en una clave
  separada, con deduplicación y transiciones de dominio deterministas.
- **Fase 6:** `src/tutor/pedagogy/` y `src/tutor/application/` verifican N0--N5,
  progresión, guardas pre/post, fallback sin evidencia, respuesta estructurada,
  fuentes y un evento por consulta.
- **Fase 7:** `src/tutor/feedback/` distingue siete categorías sin guardar ni
  reemplazar el código; `src/tutor/recommendation/` excluye resueltos y expone
  reglas activadas.
- Validación conjunta: `pnpm test:tutor`, código 0, 21 archivos y 109 pruebas.
