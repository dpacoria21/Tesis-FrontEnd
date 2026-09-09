# Auditoría técnica inicial

## Resultado ejecutivo

La línea base es una SPA React/Vite funcional de entrenamiento para Codeforces,
pero no era todavía el tutor RAG definido por la tesis. La estrategia acordada
es una extensión vertical aislada, preservando el producto y su almacenamiento
existentes. Esta instantánea describe el estado **anterior** a la implementación
del tutor; no se actualizará para hacer desaparecer las brechas originales.

## Componentes encontrados

| Componente | Evidencia inicial | Utilidad conservada | Brecha frente al corte |
|---|---|---|---|
| Shell y navegación | `src/App.tsx`, `src/styles.css` | Diseño responsive, navegación y patrones visuales | Sin página ni recorrido de tutor |
| Catálogo | `src/data/seedProblems.ts`, IndexedDB en `src/storage.ts` | Problemas locales y sincronización | Sin enunciados, estrategias, pistas, licencia ni chunks pedagógicos |
| Codeforces | `src/services/codeforces.ts` | API pública con cola y normalización | No es una fuente RAG ni contiene editoriales autorizadas |
| Estado | `TrainingState v1` en `src/types.ts` y `src/storage.ts` | Progreso general y sesiones | Sin dominio conceptual, nivel de ayuda ni eventos pedagógicos |
| Recomendación | `src/domain/recommendations.ts` | Ranking determinista orientado a rating/tags | Sin prerrequisitos, dependencia de pistas ni reglas expuestas por candidato |
| Métricas | `src/domain/metrics.ts` | Funciones puras para el dashboard | No conectadas al benchmark RAG |
| Pruebas | Tres archivos, 18 casos aprobados | Base de regresión real | Sin corpus, retrieval, pedagogía, feedback, estado o E2E de tutor |

## Riesgos preservados o corregibles

| Prioridad | Hallazgo | Riesgo | Tratamiento del corte |
|---:|---|---|---|
| P0 | No había corpus, índices, RRF, política ni generador | Impide el objetivo central | Implementar como `src/tutor/` con contratos y pruebas |
| P0 | `App.tsx` concentra coordinación y UI | Colisiones y regresiones al modificar el monolito | Añadir solo composición y una vista autónoma |
| P0 | La importación comprueba únicamente `version` y `handle` antes de guardar | Un JSON mal formado puede degradar el estado | No reutilizarla para el tutor; validar el sobre versionado del nuevo estado |
| P1 | El historial de rating muestra una curva fallback predefinida con el rótulo "Historial de concursos" | Puede confundirse con datos sincronizados reales | Rotular explícitamente la curva como referencia cuando no haya sincronización |
| P1 | El cálculo de intentos filtra toda la colección por cada submission | Coste cuadrático en historiales grandes | Registrar como deuda; no es dependencia del tutor local |
| P1 | `metrics.ts` duplica cálculos hechos directamente en `App.tsx` | Divergencia de definiciones | No usar estas cifras como benchmark sin reconciliación |
| P1 | La SPA estaba personalizada para un perfil nominal | No representa todavía al estudiante ingresante de la tesis | El tutor usa un ID local neutro y mantiene separado el perfil heredado |
| P2 | El fixture de problemas existente no documenta licencia editorial | Riesgo de procedencia | Crear fixture pedagógico nuevo, sintético y claramente rotulado |

## Restricciones de implementación

- No existe carpeta `.git`; se conserva el error reproducible y no se crea un
  repositorio.
- Los artefactos `dist/`, `output/`, dependencias y archivos de la SPA se tratan
  como propiedad del usuario.
- No hay `OPENAI_API_KEY` legítima disponible. El proveedor real es opcional;
  pruebas y demostración usan dobles deterministas sin fingir un smoke real.
- No se copian editoriales de plataformas. El corpus de aceptación será un
  fixture demostrativo con derechos y procedencia explícitos.

## Arquitectura incremental priorizada

1. Corpus validado e ingesta idempotente.
2. Embedding local y recuperación BM25/Dense/RRF/filtros.
3. Estado estudiantil y evento versionado separados.
4. Política N0--N5, generación estructurada y guardas pre/post.
5. Feedback y recomendador de reglas.
6. Servicio de aplicación local y vista Tutor IA.
7. Suite integral, protocolo prefijado, benchmark y evidencias.

La arquitectura detallada y sus interfaces se mantienen en
`docs/presentacion/ARQUITECTURA.md`; los requisitos y su trazabilidad están en
`docs/tesis/REQUISITOS.md`.

