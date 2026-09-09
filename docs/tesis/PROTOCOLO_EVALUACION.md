# Protocolo de evaluación técnica preliminar

## Registro previo

- **Versión:** 1.0-prebenchmark.
- **Fijado inicialmente:** 2026-09-03T00:31:29-05:00.
- **Corte:** prototipo de septiembre S1 de 2026.
- **Naturaleza:** evaluación técnica sobre fixtures; no es el estudio con
  estudiantes ni mide aprendizaje causal.
- **Regla de integridad:** las consultas y los juicios de relevancia se fijan en
  `src/tutor/benchmark/cases.ts` antes de ejecutar las cuatro variantes. Las
  correcciones posteriores deberán crear otra versión y nunca sobrescribir los
  resultados crudos originales.

## Preguntas de evaluación

1. ¿Qué proporción de los documentos juzgados relevantes recupera cada método
   dentro de los primeros 5 y 10 resultados?
2. ¿A qué rango aparece el primer documento relevante y cómo se ordena el
   conjunto relevante hasta el rango 10?
3. ¿Los filtros de metadatos reducen resultados incompatibles sin perder la
   evidencia relevante esperada?
4. ¿Las respuestas deterministas están fundamentadas en los chunks recuperados,
   muestran sus fuentes y respetan el nivel de ayuda?
5. ¿Las solicitudes adversariales de solución completa son contenidas antes y
   después de generar?
6. ¿Cuál es la latencia técnica p50/p95 de cada recuperador en este entorno?

## Unidad de análisis y población técnica

- **Retrieval:** par consulta--variante, con un ranking de chunks del corpus
  demostrativo versionado.
- **Respuesta:** una ejecución del pipeline de tutor para un caso pedagógico.
- **Seguridad:** una respuesta producida ante una consulta marcada como
  restringida.
- **Universo de inferencia permitido:** únicamente el fixture, la configuración
  y el entorno identificados en el resultado del benchmark.

No se usan participantes, notas, percepciones, datos personales ni código real
de estudiantes. Un ID de estudiante del fixture es ficticio y solo sirve para
probar persistencia y transiciones.

## Conjunto previo

El conjunto quedó fijado antes de medir en
`src/tutor/benchmark/cases.ts`: **25 casos** (6 conceptuales, 4 de búsqueda de
problemas, 5 de estrategia, 5 de depuración y 5 adversariales).

| Categoría | Mínimo | Propósito |
|---|---:|---|
| Recuperación conceptual | 5 | Definiciones, prerrequisitos y complejidad |
| Búsqueda de problemas | 4 | Tema, dificultad, lenguaje y problema específico |
| Estrategia | 4 | Observación/algoritmo sin exigir código completo |
| Depuración | 4 | Comprensión, complejidad, implementación y casos límite |
| Adversarial | 5 | Código completo, evasión, prompt injection y contexto sin evidencia |

Cada caso debe declarar: ID estable, categoría, consulta, documentos/chunks
relevantes esperados, filtros, conducta pedagógica esperada, procedencia del
juicio y necesidad de revisión humana. Los documentos relevantes se deciden por
su esquema y contenido, sin consultar el ranking que produzca el sistema.

## Sistemas comparados

Las cuatro variantes reciben exactamente el mismo corpus, consulta, `topK`,
tokenización y filtros declarados:

1. **BM25:** recuperación léxica, `k1=1.2`, `b=0.75` salvo que el resultado
   registre otra configuración.
2. **Dense:** embedding local determinista, con nombre, versión y dimensiones
   registrados. Es un doble técnico reproducible, no un modelo aprendido.
3. **Hybrid RRF:** rankings BM25 y Dense fusionados por
   `sum(1 / (kappa + rank))`; `kappa=60` por defecto.
4. **Hybrid RRF + metadatos:** mismos recuperadores y RRF, con filtros aplicados
   antes del ranking para lenguaje, tema/tag, dificultad, tipo y problema cuando
   el caso lo exige.

No se activa reranking ni MMR. No se ajusta una variante después de observar los
resultados de esta versión.

## Métricas de recuperación

Sea `Rel(q)` el conjunto de chunks relevantes prefijado y `R_q@k` los primeros
`k` resultados:

- `Recall@k = |Rel(q) ∩ R_q@k| / |Rel(q)|`, reportado para k=5 y k=10. Un caso
  sin relevantes se excluye de Recall y se evalúa como contrato vacío.
- `RR@10 = 1/r` si el primer relevante aparece en rango `r <= 10`; en otro caso
  0. `MRR@10` es su media por consulta evaluable.
- `DCG@10 = sum((2^rel_i - 1) / log2(i + 1))`; los juicios son binarios en esta
  versión. `nDCG@10 = DCG@10 / IDCG@10`; un caso sin relevante se excluye.
- **Precisión de filtros:** fracción de resultados que cumplen todos los filtros
  declarados. Debe ser 1 para considerar correcto el contrato.
- **Contrato sin evidencia:** para consultas fuera del corpus, el pipeline no
  debe inventar documentos y debe devolver una respuesta prudente.

Se reportan media macro, número de casos evaluables y valores por caso. Un
promedio nunca oculta un error de filtro o de seguridad.

## Métricas de respuesta y rúbrica humana futura

La evaluación automatizada comprueba únicamente propiedades observables:
formato válido, al menos una fuente cuando hay evidencia, fuente perteneciente
al ranking permitido, nivel no superior al decidido, ausencia de código
ejecutable prohibido y respuesta prudente sin evidencia.

Una revisión humana posterior, independiente del benchmark automático, usará
una escala ordinal 1--5 con anclas definidas:

| Dimensión | 1 | 3 | 5 |
|---|---|---|---|
| Relevancia | No responde a la necesidad | Responde parcialmente | Responde de forma directa y suficiente |
| Precisión técnica | Contiene error material | Correcta con omisión menor | Correcta y sin contradicciones observables |
| Fundamentación | Sin respaldo o contradice fuente | Vínculo parcial | Cada afirmación sustantiva se apoya en evidencia mostrada |
| Coherencia | Inconsistente o ininteligible | Secuencia entendible con saltos | Secuencia clara y consistente |
| Utilidad pedagógica | Entrega respuesta o no orienta | Da una orientación general | Promueve el siguiente paso acorde al nivel permitido |

La rúbrica exige dos revisores cuando el estudio posterior lo permita. Antes de
revisar se acordarán ejemplos ancla; los desacuerdos se conservan y un tercer
revisor decide solo después de registrar ambos juicios. Se informará acuerdo
interevaluador y no se convertirá la escala ordinal en precisión objetiva.

ROUGE-L, BERTScore y LLM-as-a-Judge pueden añadirse como análisis
complementarios versionados; nunca sustituyen juicios humanos ni serán la única
evidencia de utilidad pedagógica.

## Seguridad, alucinación, latencia y costo

- `LeakageRate = respuestas que revelan una solución prohibida / consultas
  restringidas`. El numerador se obtiene del detector postgeneración y de una
  aserción estructural del caso; se reportan también los casos individualmente.
- **Alucinación de fuente:** referencia que no existe en el corpus o no fue
  proporcionada al generador. Objetivo técnico: cero.
- **Latencia:** tiempo monotónico por consulta. Se reportan p50 y p95 con el
  método nearest-rank, número de repeticiones, calentamiento y entorno.
- **Costo externo:** cero para el camino determinista local. Si en el futuro se
  ejecuta un proveedor real, tokens y costo se registrarán por separado sin
  exponer credenciales.

Las mediciones locales de milisegundos son descriptivas; no implican capacidad
de producción ni escalabilidad multiusuario.

## Procedimiento reproducible

1. Verificar hash/versión del fixture y que todos los casos referencien IDs
   existentes o declaren explícitamente ausencia de evidencia.
2. Registrar Node, sistema operativo, timestamp, semilla, configuración BM25,
   configuración de embedding, `kappa`, `topK` y repeticiones.
3. Ejecutar la ingesta dos veces y comprobar IDs, conteos e índice idénticos.
4. Ejecutar, sin red, cada consulta en las cuatro variantes.
5. Guardar rankings crudos, rangos, puntuaciones/contribuciones, filtros,
   latencias y errores antes de calcular agregados.
6. Calcular métricas desde esos rankings mediante funciones probadas.
7. Ejecutar los casos pedagógicos/restringidos con el generador determinista y
   conservar nivel, razón, fuentes y protección.
8. Generar un resumen únicamente a partir del resultado crudo; no editar cifras
   manualmente.
9. Revisar fallos. Una corrección de código requiere una nueva corrida y versión;
   el resultado anterior permanece como evidencia del defecto.

La estructura previa y sus recuentos se validan sin ejecutar recuperadores con:

~~~text
pnpm exec vitest run src/tutor/benchmark/cases.test.ts \
  src/tutor/benchmark/metrics.test.ts
~~~

Primera validación previa: código 0, dos archivos y siete pruebas aprobadas el
2026-09-03. Los comandos definitivos del benchmark y las rutas del resultado se
añadirán cuando el runner quede implementado, antes de la primera medición.

## Separación de resultados

| Capa | Qué permite afirmar | Qué no permite afirmar |
|---|---|---|
| Unitarias | Algoritmos cumplen casos controlados | Calidad en corpus real |
| Integración/E2E | Flujo y política son reproducibles | Aprendizaje del estudiante |
| Benchmark de fixture | Desempeño técnico en el conjunto fijado | Generalización o superioridad universal |
| Revisión humana futura | Calidad percibida bajo su muestra | Causalidad educativa por sí sola |
| Estudio con estudiantes futuro | Asociación o efecto según diseño | Nada antes de consentimiento, ejecución y análisis |

Se separan además comprensión, estrategia, complejidad, implementación y
aceptación por pruebas. Código aceptado es una señal funcional, no prueba que el
estudiante comprendió o podrá resolver sin ayuda.

## Amenazas a la validez

- **Constructo:** relevancia binaria y detectores deterministas simplifican la
  calidad pedagógica; se mitiga mostrando resultados por caso y reservando
  revisión humana.
- **Interna:** fixtures y reglas fueron construidos por el mismo proyecto; se
  prefijan juicios antes del ranking y se evita ajustar sobre esta corrida.
- **Externa:** corpus pequeño, sintético, español y monousuario; no representa
  toda programación competitiva ni todos los ingresantes.
- **Conclusión:** pocos casos hacen inestables diferencias pequeñas; no se harán
  pruebas de significancia ni declaraciones de ganador definitivo.
- **Reproducibilidad:** reloj, hardware y procesos cambian latencia; se fija
  entorno/configuración y se conserva el dato crudo.
- **Ética/privacidad:** la evaluación técnica no autoriza recolectar datos de
  estudiantes. El estudio posterior requiere consentimiento, minimización,
  control de acceso y aprobación institucional aplicable.

## Regla para afirmaciones

El benchmark puede describir que una variante obtuvo una métrica en este
fixture y configuración. No puede afirmar que el tutor mejora aprendizaje,
calificaciones, retención, autonomía o equidad, ni que es mejor para la
población objetivo. Esas afirmaciones requieren el estudio posterior al corte,
un diseño apropiado y datos reales legítimamente obtenidos.
