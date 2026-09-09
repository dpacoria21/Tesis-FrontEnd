# Informe de avance del prototipo

**Tesis:** Tutor inteligente basado en una arquitectura RAG híbrida para el apoyo al aprendizaje de programación competitiva en estudiantes ingresantes de Ingeniería de Sistemas y Ciencias de la Computación  
**Corte informado:** septiembre de 2026, semana 1  
**Versión preliminar del informe:** 2026-09-03  
**Naturaleza de la evidencia:** desarrollo y evaluación técnica preliminar; no constituye todavía una validación con estudiantes ni una demostración de impacto educativo.

## Resumen ejecutivo

En el corte de este informe se verificaron las fases 0, 1 y 2 del plan técnico: se estableció un estado durable y reanudable, se auditó el alcance académico y la arquitectura objetivo, y se comprobó que la aplicación heredada se instala, compila, prueba e inicia. La fase 3, correspondiente al corpus y la ingesta, se encuentra en curso. Las capacidades propias del tutor RAG —recuperación híbrida, política pedagógica, protección contra filtración, retroalimentación, recomendación explicable, recorrido de interfaz y benchmark— aún no se presentan como resultados ejecutados.

Esta distinción es necesaria porque las fases verificadas acreditan preparación y línea base, no la culminación del prototipo. El estado operativo vigente está registrado en [PLAN_EJECUCION.md](PLAN_EJECUCION.md) y [CHECKPOINT.md](../presentacion/CHECKPOINT.md). La comparación inicial del cronograma consta en [ESTADO_CRONOGRAMA.md](ESTADO_CRONOGRAMA.md).

## 1. Alcance y criterio de evidencia

El objetivo del prototipo es demostrar, en un entorno local y reproducible, una arquitectura que combine recuperación léxica BM25, recuperación semántica densa, fusión Reciprocal Rank Fusion (RRF), filtros de metadatos, un modelo estructurado del estudiante y ayudas pedagógicas progresivas. La población académica objetivo son estudiantes ingresantes o de nivel básico; no se afirma que los usuarios actuales de la aplicación heredada representen esa población.

El corte usa la siguiente precedencia de evidencia: comportamiento reproducible y pruebas; artefactos actuales del repositorio; documento académico vigente; y cronograma. Las marcas de planificación no demuestran implementación. La localización, integridad, jerarquía y límites de las fuentes están documentados en [FUENTES_Y_ALCANCE.md](FUENTES_Y_ALCANCE.md).

La línea base del cronograma contiene 17 actividades exigidas: 12 estaban en estado `Parcial` y 5 en `No implementado`; otras 8 se clasificaron como `Fuera del corte actual`. Estos son valores iniciales y no deben confundirse con el estado final que se incorporará después de ejecutar y verificar las fases restantes. La matriz completa y su puerta de cierre están en [ESTADO_CRONOGRAMA.md](ESTADO_CRONOGRAMA.md).

## 2. Estado de ejecución por fases

| Fase | Estado al redactar esta versión | Evidencia disponible | Interpretación prudente |
|---|---|---|---|
| 0 · Preflight y estado durable | Verificada | [PLAN_EJECUCION.md](PLAN_EJECUCION.md) y [CHECKPOINT.md](../presentacion/CHECKPOINT.md) | El trabajo puede reanudarse con inventario, decisiones y siguiente acción identificados |
| 1 · Auditoría, requisitos y arquitectura | Verificada | [ESTADO_CRONOGRAMA.md](ESTADO_CRONOGRAMA.md), [REQUISITOS.md](REQUISITOS.md), [FUENTES_Y_ALCANCE.md](FUENTES_Y_ALCANCE.md) y [ARQUITECTURA.md](../presentacion/ARQUITECTURA.md) | Se verificó la documentación de alcance y diseño; no la ejecución del tutor |
| 2 · Línea base ejecutable | Verificada | [RESULTADOS_PRUEBAS.md](../presentacion/RESULTADOS_PRUEBAS.md) | La aplicación heredada instala, compila, supera su suite inicial, construye y responde por HTTP |
| 3 · Corpus e ingesta | En curso | [CHECKPOINT.md](../presentacion/CHECKPOINT.md) | No se declara verificada hasta demostrar esquema, procedencia, deduplicación, idempotencia y embeddings reproducibles |
| 4–12 · Recuperación, tutor, evaluación y cierre | Aún no verificadas | [PLAN_EJECUCION.md](PLAN_EJECUCION.md) | Sus entregables y resultados se incorporarán únicamente después de ejecutar sus puertas de salida |

## 3. Estado del arte y decisiones técnicas

La tesis vigente aporta antecedentes y bases conceptuales; el inventario actual conserva la procedencia y distingue la versión académica usada de una versión histórica con contenido provisional. También se fijó como regla que una decisión de ingeniería no se justifica solo por citar una técnica: debe responder a una brecha del prototipo y producir evidencia verificable.

Hasta esta versión, el estado del arte está **parcialmente consolidado**. La evidencia existente permite sostener el alcance y las restricciones recogidas en [FUENTES_Y_ALCANCE.md](FUENTES_Y_ALCANCE.md), pero este informe todavía no presenta una síntesis bibliográfica final ni resultados comparativos de implementación. Las decisiones ya registradas en [ARQUITECTURA.md](../presentacion/ARQUITECTURA.md) son:

- conservar la SPA React/Vite existente;
- introducir una API de aplicación TypeScript en el mismo proceso para el prototipo local;
- usar BM25, dense y RRF como camino crítico;
- emplear embeddings locales deterministas para que la verificación no dependa de internet;
- mantener un único generador detrás de un contrato sustituible;
- dejar PageIndex, GraphRAG, Self-RAG, multiagentes, aprendizaje por refuerzo y recomendación neuronal fuera del camino crítico.

Estas son decisiones de diseño del corte. Su calidad operativa aún debe comprobarse mediante implementación, pruebas y benchmark.

## 4. Requisitos

Los requisitos funcionales, no funcionales, reglas pedagógicas y criterios transversales están documentados en [REQUISITOS.md](REQUISITOS.md). Cubren ingesta, recuperación, fuentes, pistas N0–N5, control de solicitudes directas de solución, estado del estudiante, feedback, recomendación, eventos e interfaz.

El catálogo constituye evidencia de especificación, no de conformidad. La trazabilidad final deberá asociar cada requisito con módulos, casos de prueba y resultados. Al redactar esta versión, esa demostración está **aún no ejecutada** para las capacidades del tutor.

## 5. Arquitectura efectiva y arquitectura objetivo

La arquitectura efectiva inicial es una SPA local-first: `App.tsx` concentra coordinación y presentación; el estado reside en `localStorage`, el catálogo en IndexedDB y la sincronización utiliza la API pública de Codeforces. No existe un backend separado ni un RAG operativo en la línea base.

La arquitectura objetivo separa corpus, ingesta, embeddings, BM25, dense, RRF, filtros, modelo del estudiante, política de ayuda, generador, detector de filtración, feedback, recomendador, registro de eventos y servicio de aplicación. Los diagramas, responsabilidades y flujos están en [ARQUITECTURA.md](../presentacion/ARQUITECTURA.md).

La documentación de la arquitectura está verificada como entregable de diseño. La arquitectura objetivo está **en implementación** y no debe describirse todavía como arquitectura efectiva final.

## 6. Corpus, ingesta y embeddings

La aplicación heredada contiene un catálogo mínimo de ejercicios, pero ese catálogo no equivale a una base de conocimiento RAG con teoría, estrategias, chunks y procedencia. La fase 3 debe producir un corpus de demostración explícitamente rotulado, con esquema validado, fuentes y derechos declarados, identificadores estables, deduplicación e informe de ingesta.

Estado en esta versión: **trabajo técnico en curso; no ejecutado ni verificado como puerta de fase**.

La revisión posterior de esta sección deberá enlazar, como mínimo:

- el manifiesto o corpus realmente usado;
- el informe de elementos aceptados, rechazados y deduplicados;
- la evidencia de dos ejecuciones idempotentes;
- las pruebas de validación del esquema;
- la evidencia de generación reproducible de embeddings y actualización del índice denso.

No se informa todavía un tamaño de corpus, número de chunks, dimensión de vectores ni tasa de rechazo porque no existe evidencia ejecutada incorporada a este informe.

## 7. Recuperación híbrida

El diseño exige cuatro variantes comparables sobre el mismo corpus: BM25, dense, Hybrid RRF y Hybrid RRF con filtros. RRF fusionará posiciones y no puntuaciones crudas de escalas incompatibles. Los filtros deberán operar antes de la recuperación o sobre un universo claramente documentado y cubrir, según corresponda, tema, dificultad, tipo, idioma y problema.

Estado en esta versión: **aún no implementado ni ejecutado**. No se reportan Precision@k, Recall@k, MRR, nDCG, latencias ni ventajas de una variante. Esas cifras solo podrán incorporarse después de conservar resultados crudos y demostrar el cálculo.

## 8. Política pedagógica, seguridad, feedback y recomendación

El comportamiento previsto usa niveles de ayuda N0–N5, con progresión determinada por intención, estado del estudiante, intentos y ayuda previa. Las solicitudes directas o repetidas de solución deben activar controles antes y después de la generación. La retroalimentación debe localizar y clasificar el error sin reemplazar indebidamente la solución del estudiante; el recomendador debe exponer las reglas activadas.

La aplicación inicial ya contiene una recomendación determinista orientada al entrenamiento, pero no constituye por sí sola el recomendador pedagógico del tutor ni utiliza evidencia RAG. En consecuencia, esta área permanece **parcial en la línea base y aún no verificada en el prototipo**.

La versión final del informe deberá aportar casos de progresión, solicitudes adversariales de código, diagnósticos de tipos de error, actualizaciones del estado del estudiante y explicaciones de recomendación. En este momento no se atribuye éxito a ninguno de esos escenarios.

## 9. API e interfaz de usuario

La interfaz heredada ofrece una base visual y de navegación funcional. El recorrido específico del tutor deberá permitir seleccionar o identificar un problema, consultar, solicitar una pista, enviar un intento, recibir feedback y observar nivel de ayuda, razón, protección y fuentes.

Estado en esta versión: **la SPA base está verificada; la interfaz del tutor aún no está integrada ni probada**. La verificación futura deberá incluir el recorrido principal reproducible y evidencia visual o pasos manuales exactos.

## 10. Pruebas realizadas y pendientes

La línea base técnica fue ejecutada y registrada en [RESULTADOS_PRUEBAS.md](../presentacion/RESULTADOS_PRUEBAS.md): instalación reproducible con código 0, typecheck con código 0, 18 pruebas aprobadas en 3 archivos, build con código 0 y healthcheck HTTP 200. El proceso de preview fue detenido intencionalmente después del healthcheck y el puerto quedó libre.

Estos resultados prueban la estabilidad inicial de Momentum; **no prueban el tutor RAG**. Todavía deben ejecutarse pruebas unitarias e integradas de ingesta, embeddings, BM25, dense, RRF, filtros, persistencia, política, filtración, feedback, recomendación, API e interfaz, además de una regresión final. Los conteos futuros no se agregarán hasta que existan salidas reales de los comandos.

## 11. Benchmark preliminar

El benchmark técnico preliminar debe comparar variantes de recuperación con consultas, relevancias esperadas y parámetros fijados antes de medir. También deberá separar recuperación, calidad de respuesta, seguridad y conducta pedagógica. Cualquier revisión por modelo o métrica textual será complementaria y no sustituirá la inspección de fuentes ni la revisión humana.

Estado en esta versión: **aún no ejecutado**. No hay métricas de benchmark que informar. La versión final deberá enlazar dataset, configuración, resultados crudos, cálculo reproducible y resumen, y deberá etiquetar el ejercicio como prueba técnica preliminar, no como evaluación final con estudiantes.

## 12. Limitaciones actuales

- La línea base no contiene todavía un tutor RAG funcional.
- El prototipo se plantea para ejecución local y no demuestra escalabilidad, aislamiento multiusuario, autenticación ni despliegue institucional.
- No se ha realizado una evaluación con estudiantes; por tanto, no se hacen afirmaciones sobre utilidad percibida, satisfacción, facilidad de uso, aprendizaje o causalidad.
- La fuente académica Matriz 6 localizada está en una ruta temporal; su hash y contenido relevante se registraron, pero conviene archivar el original en una ubicación estable.
- Sin una credencial de proveedor, el smoke test de un LLM real quedará pendiente; los dobles deterministas pueden comprobar contratos y seguridad, pero no equivalen a validar un modelo externo.
- El corpus de demostración, su cobertura y sus derechos deben revisarse antes de extrapolar resultados.
- La personalización heredada para un usuario de Codeforces no representa por sí misma al estudiante ingresante definido en la tesis.

## 13. Pendientes desde septiembre S2

El XLSX sitúa las pruebas funcionales hasta septiembre S2, el informe del prototipo en septiembre S2 y el protocolo de evaluación en septiembre S3. El objetivo rector exige adelantar esos tres entregables al cierre técnico actual; por ello se consideran pendientes obligatorios del prototipo y no actividades opcionales.

Después de ese adelanto, quedan legítimamente fuera del corte actual:

- ejecutar la evaluación formal de respuestas, programada entre septiembre S4 y octubre S1;
- analizar resultados y ajustar el sistema durante octubre;
- redactar el informe evaluativo de octubre;
- diseñar instrumentos y seleccionar participantes entre octubre S4 y noviembre S1;
- ejecutar sesiones con estudiantes durante noviembre;
- analizar percepción y contrastar hipótesis entre noviembre S4 y diciembre S1;
- discutir resultados, elaborar conclusiones y completar el borrador de tesis durante diciembre.

Estas actividades no se simularán ni se presentarán como completadas. Su detalle y dependencia temporal están en [ESTADO_CRONOGRAMA.md](ESTADO_CRONOGRAMA.md).

## 14. Condición para completar este informe

Esta primera versión debe actualizarse después de cada fase verificada. Antes del cierre deberá incorporar evidencia real de corpus e ingesta, recuperación, pedagogía, seguridad, feedback, recomendación, interfaz, regresión, benchmark y protocolo; además deberá reconciliar el estado inicial y final del cronograma.

Mientras alguna capacidad central carezca de prueba suficiente, el documento seguirá siendo un **informe de avance** y no una constancia de finalización del objetivo técnico.

