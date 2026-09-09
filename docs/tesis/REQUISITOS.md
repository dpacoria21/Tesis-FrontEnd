# Requisitos del prototipo

## Requisitos funcionales

| ID | Requisito | Evidencia de aceptación prevista |
|---|---|---|
| RF-01 | Ingerir recursos pedagógicos estructurados con procedencia, validación, deduplicación e idempotencia. | Pruebas de esquema y dos ejecuciones estables |
| RF-02 | Generar embeddings y construir un índice denso reproducible sobre el corpus de demostración. | Comando y prueba con conteos/configuración |
| RF-03 | Recuperar por BM25, dense, Hybrid RRF y Hybrid RRF con metadatos mediante un contrato común. | Rankings controlados y pruebas de integración |
| RF-04 | Filtrar por tema, dificultad, tipo de contenido, lenguaje y problema. | Unitarias de filtros aislados y combinados |
| RF-05 | Seleccionar o visualizar un problema y consultar al tutor desde la interfaz. | Recorrido E2E observable |
| RF-06 | Entregar explicaciones y pistas N0–N5 según intento, bloqueo, dominio, ayuda previa y reglas docentes. | Pruebas deterministas de transición |
| RF-07 | Impedir que una solicitud directa o repetida revele de inmediato código ejecutable completo. | Casos adversariales y LeakageRate |
| RF-08 | Registrar intentos o código y clasificar errores de comprensión, concepto, estrategia, complejidad, implementación, caso límite y sintaxis/ejecución. | Unitarias y E2E de feedback localizado |
| RF-09 | Persistir un modelo auditable del estudiante independiente del historial textual del generador. | Pruebas de actualización y recarga |
| RF-10 | Recomendar ejercicios por reglas de dominio, dificultad, etiquetas, prerrequisitos, historial, resueltos y uso de pistas. | Recomendación con explicación auditable |
| RF-11 | Mostrar las fuentes y fragmentos usados por el tutor. | Contrato de respuesta y UI |
| RF-12 | Registrar intención, nivel de ayuda, razón, fuentes, protección y latencia por respuesta. | Evento persistido e inspeccionable |
| RF-13 | Responder prudentemente cuando no exista evidencia suficiente. | Integración y E2E sin evidencia |
| RF-14 | Permitir reglas docentes configurables para limitar niveles de ayuda. | Pruebas de límites y configuración |
| RF-15 | Exportar/restaurar el estado local sin corromper la aplicación. | Validación de formato y prueba de round-trip |

## Requisitos no funcionales

| ID | Requisito | Criterio |
|---|---|---|
| RNF-01 | Auditabilidad | Cada recuperación expone rangos, contribuciones, fusión, metadatos y fuente |
| RNF-02 | Reproducibilidad | Fixtures, configuración y pruebas producen resultados estables |
| RNF-03 | Privacidad | No almacenar secretos ni datos personales innecesarios |
| RNF-04 | Operación sin credenciales | El prototipo y las pruebas funcionan con generador/embeddings deterministas |
| RNF-05 | Seguridad pedagógica | La protección se aplica antes y después de generar |
| RNF-06 | Mantenibilidad | Dominio, infraestructura, aplicación y UI permanecen desacoplados |
| RNF-07 | Compatibilidad | Conservar React/Vite/TypeScript y navegadores modernos |
| RNF-08 | Accesibilidad | Controles etiquetados, foco visible, contraste y navegación razonable |
| RNF-09 | Rendimiento medible | Registrar latencia y reportar p50/p95 del benchmark |
| RNF-10 | Idempotencia | Reingesta y reconstrucción no duplican ni corrompen recursos |
| RNF-11 | Resiliencia | Sin red o sin evidencia, degradar de forma explícita y prudente |
| RNF-12 | Trazabilidad académica | Separar datos reales, fixtures y resultados preliminares |

## Reglas del dominio pedagógico

- La primera petición de solución completa no salta la progresión de ayuda.
- El nivel 5 requiere condiciones configuradas y evidencia de intentos previos.
- La retroalimentación localiza el error, pero no reemplaza automáticamente el
  código del estudiante.
- Los problemas ya resueltos no se recomiendan salvo una regla explícita de
  repaso.
- La falta de evidencia debe ser visible y no debe rellenarse con contenido
  inventado.

## Matriz de trazabilidad prevista

La evidencia pasa de "prevista" a "verificada" únicamente después de ejecutar
la prueba o recorrido indicado. Las rutas permiten auditar el vínculo entre
requisito, implementación y aceptación sin depender de este documento.

| Requisitos | Módulo responsable | Evidencia ejecutable |
|---|---|---|
| RF-01, RF-02, RNF-02, RNF-10, RNF-12 | `src/tutor/corpus/` | Pruebas de esquema, doble ingesta e índice estable |
| RF-03, RF-04, RNF-01, RNF-09 | `src/tutor/retrieval/` | Rankings controlados, filtros e integración de cuatro variantes |
| RF-06, RF-07, RF-11--RF-14, RNF-05, RNF-11 | `src/tutor/pedagogy/` y `src/tutor/application/` | Transiciones N0--N5, casos adversariales, salida sin evidencia y eventos |
| RF-08 | `src/tutor/feedback/` | Siete categorías y actualización por intento |
| RF-09, RF-12, RF-15, RNF-03 | `src/tutor/student/` | Round-trip, deduplicación, persistencia e historial sin código crudo |
| RF-10 | `src/tutor/recommendation/` | Reglas activadas, prerrequisitos y exclusión de resueltos |
| RF-05, RF-11, RNF-07, RNF-08 | `src/tutor/ui/` y `src/App.tsx` | Recorrido observable, fuentes, controles etiquetados y build |
| RNF-04, RNF-06 | Todas las capas a través de contratos | Suite offline y sustitución de proveedores mediante dobles |

## Criterios de aceptación transversales

- Las pruebas unitarias no usan red ni credenciales.
- Los empates y timestamps inyectados producen resultados deterministas.
- Toda respuesta del tutor identifica nivel, razón, protección y fuentes.
- El estado persistido no conserva el código crudo enviado por el estudiante.
- Un resultado técnico preliminar no se rotula como validación educativa.

## Fuera del corte actual

- Estudio definitivo con estudiantes.
- Evaluación experimental completa.
- Contraste final de hipótesis.
- Conclusiones finales y afirmaciones causales.
