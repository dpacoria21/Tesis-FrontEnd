# Arquitectura efectiva y objetivo

## Estado inicial

La aplicación encontrada es una SPA React/Vite local-first. App.tsx concentra
navegación, sincronización con Codeforces, coordinación, estado y UI. El catálogo
vive en IndexedDB y el estado de entrenamiento en localStorage. No existe
backend, corpus pedagógico, recuperación RAG ni generador.

~~~mermaid
flowchart LR
  U[Usuario Momentum] --> A[App.tsx]
  A --> S[localStorage]
  A --> I[IndexedDB catálogo]
  A --> C[API pública Codeforces]
  A --> D[Recomendadores deterministas]
~~~

## Arquitectura objetivo del prototipo

~~~mermaid
flowchart LR
  UI[Vista Tutor] --> API[API de aplicación TutorService]
  API --> R[HybridRetriever]
  API --> P[HelpPolicy]
  API --> F[FeedbackAnalyzer]
  API --> G[TutorGenerator único]
  API --> L[LeakageGuard]
  API --> M[StudentModel]
  API --> E[EventLog]
  API --> Q[ExerciseRecommender]

  R --> B[BM25]
  R --> V[Dense]
  B --> X[RRF]
  V --> X
  X --> Z[Filtros y resultados auditables]

  K[Corpus validado] --> B
  K --> V
  I[Ingesta idempotente] --> K
  I --> H[Embeddings locales reproducibles]
  H --> V

  M --> S[Persistencia local]
  E --> S
  Q --> M
  P --> M
  Z --> G
  G --> L
  L --> UI
~~~

## Responsabilidades

| Componente | Responsabilidad |
|---|---|
| Corpus schema | Validar campos, procedencia, licencia y naturaleza demo/real |
| Ingestion | Normalizar, identificar, deduplicar y reportar conteos |
| Embedding provider | Generar vectores reproducibles mediante un contrato sustituible |
| BM25 retriever | Ranking léxico independiente |
| Dense retriever | Ranking por similitud coseno sobre vectores densos |
| RRF | Fusionar rangos sin sumar escalas incompatibles |
| Metadata filters | Restringir tema, dificultad, tipo, idioma y problema |
| Student model | Actualizar dominio, intentos, errores, ayudas y recomendaciones |
| Help policy | Elegir N0–N5 de forma determinista y explicable |
| Feedback analyzer | Clasificar y localizar errores sin reescribir la solución |
| Leakage guard | Detectar solicitud y salida prohibidas; reducir o regenerar |
| Tutor generator | Producir una respuesta estructurada a partir de evidencia y política |
| Recommender | Seleccionar el siguiente ejercicio y explicar reglas activadas |
| Event log | Persistir intención, nivel, razón, fuentes, protección y latencia |
| TutorService | Orquestar el flujo y ofrecer una API estable a la UI |

## Flujo de consulta

1. La UI envía problema, consulta, intento y estudiante a TutorService.
2. El guard previo detecta intención y petición de solución directa.
3. HybridRetriever aplica filtros y obtiene BM25, dense y RRF.
4. HelpPolicy decide el nivel permitido usando el estado persistido.
5. TutorGenerator produce una salida estructurada con las fuentes recuperadas.
6. El guard posterior valida la salida; si es necesario la reduce.
7. StudentModel y EventLog se actualizan de forma determinista.
8. La UI muestra ayuda, razón, protección y fuentes.

## Flujo de intento y recomendación

1. FeedbackAnalyzer clasifica el error observable.
2. StudentModel actualiza dominio, intentos, tiempo y ayuda máxima.
3. ExerciseRecommender excluye resueltos, comprueba prerrequisitos y ajusta
   dificultad.
4. La recomendación incluye una explicación auditable.

## Decisiones del corte

- Se conserva la SPA y se añade una API de aplicación TypeScript en el mismo
  proceso del navegador. El contrato permitirá sustituirla por FastAPI u otro
  backend sin cambiar la UI; un servidor separado no es necesario para demostrar
  el corte.
- El índice dense usa por defecto embeddings locales deterministas para que las
  pruebas no dependan de internet. Un proveedor externo queda detrás del mismo
  contrato.
- El generador principal es único. Sin OPENAI_API_KEY, la demo usa un generador
  determinista claramente rotulado; el smoke test de un LLM real queda pendiente.
- La persistencia del prototipo continúa en localStorage/IndexedDB, con datos de
  tutor versionados y separados del estado heredado.
- PageIndex, GraphRAG, Self-RAG, multiagentes, RL y recomendación neuronal no
  forman parte del camino crítico.
- Reranking y MMR permanecen desactivados como posibles ablaciones.

## Límites y evolución

Esta arquitectura demuestra contratos y conducta pedagógica, no escalabilidad
institucional. La migración futura a backend deberá añadir autenticación,
aislamiento multiusuario, almacenamiento servidor, observabilidad y gestión
segura de proveedores.

