# Limitaciones y afirmaciones responsables

**Corte:** septiembre de 2026, semana 1  
**Tipo de evidencia:** prototipo técnico local y evaluación preliminar sobre datos sintéticos.  
**Regla de lectura:** una capacidad implementada no se presenta como validada hasta que exista una prueba o recorrido ejecutado; una prueba técnica no se extrapola a aprendizaje real.

## Afirmaciones permitidas

Cuando estén respaldadas por las salidas vigentes de [RESULTADOS_PRUEBAS.md](RESULTADOS_PRUEBAS.md), es válido afirmar que:

- existe una SPA local que integra una API de aplicación TypeScript para el recorrido del tutor;
- el prototipo dispone de un corpus mínimo explícitamente sintético y de una ingesta con validación, identificadores estables, deduplicación e idempotencia comprobable;
- se implementaron variantes BM25, dense, Hybrid RRF y Hybrid RRF con filtros sobre el mismo fixture;
- la fusión RRF combina posiciones de ranking, no suma puntuaciones crudas incompatibles;
- el modo local usa un embedding determinista y reproducible, y no necesita una clave de proveedor;
- la política de ayuda representa niveles N0–N5 y limita la divulgación según intención, intentos, bloqueo, estado previo y reglas docentes;
- existen controles previos y posteriores contra solicitudes o salidas que filtren una solución copiable;
- el feedback puede clasificar y localizar evidencia suministrada del intento y deliberadamente no devuelve código sustituto;
- el modelo del estudiante y los eventos pedagógicos se conservan localmente con una envoltura versionada; el código enviado se reduce a huella y tamaño antes de persistirlo;
- el recomendador expone razones y reglas activadas, de modo que su decisión es auditable;
- las métricas de recuperación que se hayan ejecutado son resultados técnicos preliminares sobre el fixture y pueden reproducirse con la configuración documentada.

Estas formulaciones describen diseño, comportamiento comprobado y alcance del prototipo. No implican eficacia educativa.

## Afirmaciones no permitidas

Con la evidencia de este corte no es válido afirmar que:

- el tutor mejora el aprendizaje, las calificaciones, la retención, la autonomía o el desempeño competitivo;
- el sistema causó un cambio respecto de un grupo de control o respecto de la enseñanza habitual;
- estudiantes ingresantes lo usaron, comprendieron o valoraron positivamente;
- se midieron satisfacción, usabilidad, aceptación, carga cognitiva o utilidad percibida;
- el corpus representa adecuadamente Codeforces, AtCoder, CP-Algorithms, USACO Guide o el dominio completo de programación competitiva;
- los textos del fixture son problemas o editoriales oficiales de plataformas externas;
- el componente “dense” tiene la calidad semántica de un modelo neuronal entrenado o de un servicio comercial de embeddings;
- el generador produce razonamiento equivalente al de un LLM o que su lenguaje fue evaluado por expertos/estudiantes;
- Hybrid RRF es superior en general a BM25 o dense; cualquier comparación del benchmark solo aplica al conjunto de consultas, relevancias y parámetros registrados;
- el detector de filtración elimina todos los ataques, reformulaciones o maneras de obtener una solución;
- la aplicación está preparada para producción, despliegue institucional, alta disponibilidad, aislamiento multiusuario o tratamiento regulado de datos personales;
- el smoke test con un proveedor LLM real fue aprobado mientras no exista una llamada ejecutada y registrada.

## Fixture sintético y procedencia

El corpus de demostración es `momentum-tutor-demo-es@1.0.0`. Contiene seis problemas originales en español y produce 42 chunks bajo el esquema actual. El manifiesto lo rotula `demonstration_fixture`, `synthetic: true`, con licencia `uso_demostrativo_interno` y la nota de que no reproduce enunciados ni editoriales de jueces externos.

Consecuencias:

- el tamaño es suficiente para probar contratos, filtros, trazabilidad y recorridos, pero demasiado pequeño para inferir cobertura o robustez general;
- la relevancia del benchmark se define para este fixture y puede favorecer su vocabulario;
- los resultados no deben presentarse como evaluación sobre un corpus real ni como licencia para incorporar contenido externo;
- antes de ampliar el corpus se requieren revisión de derechos, procedencia, versiones, idioma, calidad pedagógica y cobertura temática.

Fuente auditable: [`src/tutor/corpus/fixture.ts`](../../src/tutor/corpus/fixture.ts).

## Embedding determinista

El proveedor local `local_deterministic/feature_hash_semantic_lexicon@1.0.0` genera vectores de 192 dimensiones mediante tokenización, feature hashing, bigramas y un léxico semántico pequeño para programación competitiva; normaliza con L2. Es reproducible y permite ejercitar construcción/reutilización del índice y similitud coseno sin red.

No es un modelo aprendido, no fue entrenado con estudiantes ni problemas reales y no constituye evidencia de comprensión semántica profunda. Por ello debe denominarse **embedding local determinista de demostración**, no “modelo de embeddings de estado del arte”. Una evaluación futura con uno o más proveedores reales debe aislar configuración, versión, costo, privacidad y comparabilidad.

Fuente auditable: [`src/tutor/retrieval/embeddings.ts`](../../src/tutor/retrieval/embeddings.ts).

## Generador determinista

El generador actual produce respuestas estructuradas a partir del nivel de ayuda y fragmentos recuperados mediante reglas y plantillas deterministas. Esta elección permite probar grounding, fuentes, fallback, progresión, validación de formato y guardas sin depender de credenciales.

No genera texto con un LLM externo, no demuestra razonamiento generativo y su naturalidad o utilidad pedagógica no ha sido evaluada con usuarios. Las pruebas con dobles inseguros verifican que la guarda puede bloquear patrones conocidos; no prueban seguridad completa frente a un modelo real.

Fuentes auditables: [`src/tutor/pedagogy/generator.ts`](../../src/tutor/pedagogy/generator.ts) y [`src/tutor/pedagogy/leakageGuard.ts`](../../src/tutor/pedagogy/leakageGuard.ts).

## Smoke test con LLM real pendiente

El entorno del corte no dispone de una credencial de proveedor configurada para realizar una llamada real. No se escribió una clave en el repositorio y la demostración no la requiere. En consecuencia:

- el contrato sustituible del generador sí puede probarse con implementaciones locales o dobles;
- la conectividad, autenticación, latencia, costos, límites, formato y conducta de un LLM externo permanecen **no verificados**;
- no se debe registrar el smoke test como aprobado ni atribuir respuestas actuales a OpenAI u otro proveedor;
- cuando exista una credencial autorizada, la prueba deberá ejecutarse desde servidor o entorno seguro, nunca exponiendo el secreto en variables `VITE_*`, código cliente, logs o documentación.

Este pendiente no invalida la demostración determinista, pero impide afirmar integración real con un LLM.

## SPA local y persistencia

La arquitectura del corte es una SPA React/Vite. `TutorApi` se ejecuta en el mismo proceso del navegador y el repositorio usa `localStorage` cuando está disponible, con fallback en memoria si el navegador lo rechaza. La clave versionada del estado es `momentum-cf:tutor-state:v1`.

Limitaciones derivadas:

- no existe un backend remoto del tutor, autenticación, autorización ni separación entre usuarios del mismo perfil de navegador;
- borrar almacenamiento, cambiar de navegador/dispositivo o usar un modo que bloquee `localStorage` puede perder o no compartir el estado;
- el identificador de estudiante de la demo no es una identidad verificada;
- no hay sincronización, respaldo, cifrado de aplicación, auditoría institucional ni política de retención desplegada;
- el rendimiento medido localmente no predice latencia, concurrencia o disponibilidad en producción;
- el prototipo no debe recibir datos personales ni código confidencial de estudiantes reales.

Fuentes auditables: [`src/tutor/application/createLocalTutorApi.ts`](../../src/tutor/application/createLocalTutorApi.ts) y [`src/tutor/student/repository.ts`](../../src/tutor/student/repository.ts).

## Evaluación y causalidad

No se han ejecutado sesiones con estudiantes, docentes ni expertos como parte de este corte. El benchmark previsto mide recuperación y controles técnicos sobre consultas predefinidas. Incluso con métricas perfectas en ese conjunto, no se demuestra aprendizaje, transferencia, retención ni ausencia de dependencia de pistas.

Una afirmación educativa futura requerirá protocolo aprobado, instrumentos, criterios de inclusión, consentimiento y privacidad cuando correspondan, muestra documentada, comparación adecuada y análisis estadístico compatible con el diseño. Hasta entonces, los resultados deben etiquetarse como **prueba técnica preliminar**.

El protocolo planificado está en [`docs/tesis/PROTOCOLO_EVALUACION.md`](../tesis/PROTOCOLO_EVALUACION.md); su existencia no equivale a haberlo ejecutado.

## Riesgos técnicos que deben mencionarse

- Sobreajuste del léxico, consultas y relevancias al fixture reducido.
- Falsos positivos o falsos negativos del detector basado en patrones.
- Una fuente recuperada puede ser relevante léxicamente y aun no ser pedagógicamente suficiente.
- La política determinista no captura toda la diversidad de conocimientos, afectos o estrategias de un estudiante.
- La huella de código reduce exposición en persistencia, pero el texto todavía existe transitoriamente en memoria durante el análisis local.
- El orden determinista facilita auditoría, pero no sustituye evaluación humana de feedback y explicaciones.
- La personalización heredada de Momentum para un usuario de Codeforces no representa la población objetivo de ingresantes.

## Pendientes desde septiembre S2

- ampliar y auditar un corpus real con derechos y procedencia claros;
- ejecutar el smoke test seguro con un generador/embedding externo autorizado;
- revisar cualitativamente respuestas, fuentes y casos adversariales con criterios predefinidos;
- ejecutar el protocolo de evaluación técnica y, posteriormente, el estudio con participantes;
- evaluar accesibilidad, usabilidad, privacidad y seguridad antes de cualquier uso real;
- diseñar backend, aislamiento multiusuario y observabilidad solo si el alcance evoluciona hacia despliegue.

Hasta que esos trabajos se ejecuten, el nombre correcto del resultado es **prototipo verificable local con evaluación técnica preliminar**, no sistema educativo validado ni producto de producción.

