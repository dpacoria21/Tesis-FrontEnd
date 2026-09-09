# Estado del arte dirigido y decisiones de ingeniería

## Alcance de la revisión

Esta es una **revisión dirigida de apoyo al prototipo**, no una revisión
sistemática exhaustiva ni un metaanálisis. Se ejecutó entre el 2 y el 3 de
septiembre de 2026 para contrastar las bases académicas del proyecto con las
decisiones necesarias para el corte de septiembre S1. Las afirmaciones de los
artículos se mantienen separadas de las decisiones locales de ingeniería.

### Protocolo reproducible

| Elemento | Definición previa |
|---|---|
| Pregunta | ¿Qué evidencia orienta recuperación híbrida, evaluación RAG, tutoría de programación y protección contra entrega prematura de soluciones? |
| Fuentes consultadas | ACM Digital Library, ACL Anthology, ICLR Proceedings, NeurIPS Proceedings, IJCAI Proceedings, PubMed Central, arXiv y páginas institucionales de autores/editoriales |
| Periodo priorizado | 2009--2026; prioridad 2021--2026 salvo el trabajo fundacional de RRF |
| Fecha de última verificación | 2026-09-03, America/Lima |
| Inclusión | Artículo primario o registro oficial; método o evaluación pertinente; metadatos y URL/DOI verificables; texto suficiente para identificar aporte y límites |
| Exclusión | Blogs sin trabajo primario, agregadores como única fuente, afirmaciones comerciales, resultados sin método accesible, duplicados y estudios sin relación con recuperación o aprendizaje de programación |
| Unidad de extracción | problema, método, datos/contexto, evaluación declarada, limitación transferible y decisión local |
| Control de sesgo | Registrar también métodos no adoptados; no declarar ganador local antes del benchmark; no trasladar efectos educativos entre poblaciones sin validación |

Cadenas orientativas, adaptadas a la sintaxis de cada índice:

1. `("retrieval augmented generation" OR RAG) AND (evaluation OR benchmark OR faithfulness)`
2. `(BM25 AND dense retrieval) AND (fusion OR "reciprocal rank fusion")`
3. `("competitive programming" AND retrieval) OR (programming tutor AND LLM)`
4. `("computer science education" OR programming education) AND (guardrail OR solution leakage)`
5. `(adaptive RAG OR self-RAG OR hierarchical retrieval) AND evaluation`

La selección se detuvo por suficiencia conceptual para el diseño del MVP, no
por saturación bibliográfica. Por ello el inventario es verificable, pero no
permite afirmar cobertura total de la literatura.

## Inventario de fuentes primarias verificadas

| Fuente | Aporte observado | Limitación para esta tesis | Decisión de ingeniería |
|---|---|---|---|
| Cormack, Clarke y Büttcher (2009), *Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods*. [DOI 10.1145/1571941.1572114](https://doi.org/10.1145/1571941.1572114); [manuscrito](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf) | Define RRF como fusión de rangos y usa `k=60`, evitando depender de escalas de puntuación comparables. | Evaluación en colecciones TREC/LETOR, no en material pedagógico ni en español. | Fusionar rangos BM25 y Dense con RRF `kappa=60`; no sumar BM25 y coseno crudos. |
| Thakur et al. (2021), *BEIR*. [NeurIPS](https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/hash/65b9eea6e1cc6bb9f0cd2a47751a186f-Abstract-round2.html); [arXiv 2104.08663](https://arxiv.org/abs/2104.08663) | Compara recuperación léxica, sparse, dense, interacción tardía y reranking en 18 conjuntos heterogéneos; sostiene a BM25 como baseline robusto. | Resultados agregados y fuera del dominio no garantizan rendimiento en el corpus local pequeño. | Conservar BM25 como baseline obligatorio y medir cada variante sobre el mismo corpus, consultas y juicios. |
| Saad-Falcon et al. (2024), *ARES*. [ACL Anthology](https://aclanthology.org/2024.naacl-long.20/); [DOI 10.18653/v1/2024.naacl-long.20](https://doi.org/10.18653/v1/2024.naacl-long.20) | Separa relevancia de contexto, fidelidad de respuesta y relevancia de respuesta; combina jueces automatizados con una muestra humana. | Requiere entrenamiento/datos sintéticos y anotaciones humanas; un juez automático puede equivocarse o cambiar de dominio. | Separar retrieval y respuesta; fijar juicios humanos antes de medir. Un LLM-as-a-Judge solo podrá ser complementario. |
| Jeong et al. (2024), *Adaptive-RAG*. [ACL Anthology](https://aclanthology.org/2024.naacl-long.389/); [DOI 10.18653/v1/2024.naacl-long.389](https://doi.org/10.18653/v1/2024.naacl-long.389) | Selecciona estrategias de recuperación según complejidad estimada de la consulta. | Requiere clasificador y fue validado en QA abierta; aumenta complejidad y no hay datos locales para calibrarlo. | Dejar Adaptive-RAG como trabajo futuro; el MVP usa un flujo único auditable. |
| Asai et al. (2024), *Self-RAG*. [ICLR](https://proceedings.iclr.cc/paper_files/paper/2024/hash/25f7be9694d7b32d5cc670927b8091e1-Abstract-Conference.html); [arXiv 2310.11511](https://arxiv.org/abs/2310.11511) | Integra recuperación y autocrítica mediante tokens de reflexión entrenados. | Depende de entrenamiento/modelos especializados; no equivale a una validación pedagógica. | No incluir en el camino crítico ni simular que un prompt local implementa Self-RAG. |
| Sarthi et al. (2024), *RAPTOR*. [ICLR](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8a2acd174940dbca361a6398a4f9df91-Abstract-Conference.html); [arXiv 2401.18059](https://arxiv.org/abs/2401.18059) | Organiza resúmenes recursivos para recuperar contexto en distintos niveles de abstracción. | Orientado a documentos extensos; exige resumen, clustering y mayor infraestructura. El fixture local no justifica ese coste. | Mantener chunks planos y trazables; evaluar jerarquías solo si el corpus real crece y una ablación lo justifica. |
| Deng et al. (2025), *CPRet*. [NeurIPS](https://proceedings.nips.cc/paper_files/paper/2025/hash/f3c812da38d1bc796cb2e8235eee96bf-Abstract-Datasets_and_Benchmarks_Track.html); [DOI 10.52202/085713-5564](https://doi.org/10.52202/085713-5564) | Propone tareas de recuperación específicas de programación competitiva y advierte el efecto de problemas similares/duplicados en evaluación. | Su corpus y modelos especializados no son el corpus educativo de la tesis; incorporar material rastreado exige revisar derechos. | Modelar ID de problema, duplicados y procedencia; mantener CPRet como referencia futura, no descargarlo automáticamente. |
| Zhan et al. (2025), *CoderAgent*. [IJCAI](https://www.ijcai.org/proceedings/2025/34); [DOI 10.24963/ijcai.2025/34](https://doi.org/10.24963/ijcai.2025/34) | Simula procesos iterativos de estudiantes con estado cognitivo para estudiar personalización. | Es simulación con agentes/LLM y no sustituye datos observados de estudiantes ni valida aprendizaje causal local. | Implementar un estado determinista y auditable; no usar perfiles simulados como evidencia de estudiantes reales. |
| Wang et al. (2025), *GenMentor*. [Microsoft Research](https://www.microsoft.com/en-us/research/publication/llm-powered-multi-agent-framework-for-goal-oriented-learning-in-intelligent-tutoring-system/); [DOI 10.1145/3701716.3715244](https://doi.org/10.1145/3701716.3715244) | Combina metas, brechas de habilidad, estado del alumno y planificación de rutas en un ITS multiagente. | La orquestación multiagente y modelos ajustados exceden el corte; sus evaluaciones no prueban desempeño en ingresantes locales. | Recomendar inicialmente mediante reglas explícitas y conservar multiagentes como posible evolución. |
| Kazemitabaar et al. (2024), *CodeAid*. [ACM](https://doi.org/10.1145/3613904.3642773); [arXiv 2401.11314](https://arxiv.org/abs/2401.11314) | Despliegue en aula de un asistente de programación que favorece explicación, pseudocódigo y anotación localizada sin revelar soluciones directas. | Curso, lenguaje, nivel y contexto institucional distintos; reporta calidad imperfecta y conductas de evasión. | Progresión N0--N5, feedback localizado, transparencia de fuentes y protección explícita ante código completo. |
| Raihan et al. (2026), *CodeGuard*. [ACL Anthology](https://aclanthology.org/2026.findings-eacl.48/); [DOI 10.18653/v1/2026.findings-eacl.48](https://doi.org/10.18653/v1/2026.findings-eacl.48) | Propone taxonomía y detección de prompts inseguros/irrelevantes para educación en computación. | Resultados de un detector entrenado no transfieren automáticamente a consultas en español ni a la política de esta institución. | Aplicar guardas deterministas pre y postgeneración y medir LeakageRate en casos adversariales locales. |
| Bastani et al. (2025), *Generative AI without guardrails can harm learning*. [PNAS/PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/); [DOI 10.1073/pnas.2422633122](https://doi.org/10.1073/pnas.2422633122) | Un experimento de matemáticas distingue mejora durante práctica asistida de desempeño posterior sin ayuda y estudia el papel de guardrails. | Población y dominio distintos; efectos educativos no pueden extrapolarse a programación competitiva o a esta universidad. | Separar métricas técnicas de aprendizaje; no afirmar eficacia educativa ni causalidad antes del estudio planificado. |

## Síntesis comparativa

### Recuperación

RRF ofrece una fusión simple basada en posiciones; BEIR justifica mantener un
baseline léxico incluso cuando existen modelos densos. CPRet confirma que el
dominio de programación competitiva requiere atender similitud, duplicados y
contaminación. En conjunto, esto sustenta comparar BM25, Dense, Hybrid RRF y
Hybrid RRF con filtros, con resultados auditables por documento. No prueba que
la variante híbrida ganará en este corpus: eso debe observarse en el benchmark.

### Generación y evaluación

ARES ayuda a separar recuperación, fundamentación y utilidad de respuesta.
Adaptive-RAG, Self-RAG y RAPTOR demuestran líneas técnicamente relevantes, pero
dependen de clasificadores, entrenamiento o estructuras que no se justifican
para un corpus demostrativo pequeño. Se registran para evitar presentar el MVP
como estado del arte universal, no como componentes implícitamente construidos.

### Tutoría y seguridad pedagógica

CodeAid y CodeGuard respaldan la necesidad de controles específicos del dominio
educativo y de feedback que preserve el trabajo cognitivo. CoderAgent y
GenMentor resaltan el valor del estado del alumno y la personalización, pero sus
agentes o simulaciones no sustituyen evidencia real. Bastani et al. obliga a
distinguir asistencia durante la práctica de aprendizaje sin ayuda.

## Brecha que aborda el prototipo

La evidencia disponible no entrega, lista para este contexto, una solución que
combine simultáneamente: recuperación híbrida auditable en español sobre
conceptos y problemas de programación competitiva; progresión explícita de
ayuda; protección contra solución prematura; feedback localizado; estado del
estudiante y recomendación explicables. El prototipo cubre esa integración
técnica para estudiantes ingresantes, pero todavía no demuestra impacto de
aprendizaje, validez institucional ni superioridad frente a tutores humanos.

## Decisiones consolidadas del corte

| ID | Decisión | Evidencia/razón | Consecuencia verificable |
|---|---|---|---|
| D-01 | Mantener React, TypeScript, Vite y Vitest. | Es la arquitectura efectiva que ya instala y pasa su línea base. | Extensión vertical `src/tutor/`; no reescritura Python. |
| D-02 | API de aplicación local en proceso, con contratos sustituibles. | El corte es monousuario/local y no necesita secretos para demostrar conducta. | La UI usa `TutorService`; un backend remoto queda fuera del MVP. |
| D-03 | Fixture demostrativo pequeño, con procedencia/licencia explícitas. | No existe autorización para copiar un corpus editorial amplio. | Ningún contenido sintético se presenta como dato observado o editorial oficial. |
| D-04 | Embedding local determinista y reemplazable. | Reproducibilidad y ausencia legítima de credencial. | Pruebas y demo funcionan offline; smoke real queda marcado como pendiente. |
| D-05 | BM25 + Dense fusionados por RRF con `kappa=60`. | RRF fusiona rangos heterogéneos; BEIR exige baselines. | Cuatro variantes bajo el mismo contrato; puntuaciones crudas no se suman. |
| D-06 | Estado estudiantil estructurado, separado de `TrainingState v1`. | Evita inferir dominio desde texto del generador o arriesgar datos heredados. | Clave versionada propia y transiciones deterministas. |
| D-07 | Ayuda N0--N5 y guardas antes/después de generar. | Riesgo documentado de respuestas directas y dependencia. | Una petición de código completo avanza solo al nivel permitido y queda registrada. |
| D-08 | Un único generador en el camino principal. | Facilita atribución de fallos, pruebas y control. | Generador determinista por defecto; proveedor real tras interfaz opcional. |
| D-09 | Recomendación por reglas explicables. | No hay datos suficientes para recomendar mediante aprendizaje automático. | Cada recomendación expone reglas activadas y descarta resueltos. |
| D-10 | Evaluar retrieval, respuesta, seguridad y aprendizaje por separado. | Sus unidades y amenazas de validez difieren. | Recall/MRR/nDCG/latencia/LeakageRate son preliminares técnicas, no efecto causal. |

## Trabajo futuro, no implementado como dependencia

- Evaluar Adaptive-RAG solo cuando existan consultas y etiquetas de complejidad
  suficientes.
- Comparar RAPTOR/PageIndex u otra jerarquía si el corpus real crece y el
  retrieval plano deja una brecha medida.
- Estudiar Self-RAG o reranking/MMR como ablaciones aisladas.
- Considerar agentes o recomendación aprendida únicamente con datos legítimos,
  consentimiento y un protocolo separado.
- Ejecutar el estudio con estudiantes previsto después del corte; hasta
  entonces, no afirmar mejora de aprendizaje, retención ni causalidad.

