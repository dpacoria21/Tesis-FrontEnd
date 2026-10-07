# Verificación de la conexión del tutor

Fecha: 2026-09-23. Se comprobó la integración solicitada; este documento no cierra
las fases académicas anteriores ni certifica eficacia educativa.

## Comprobaciones automáticas

| Comprobación | Resultado observado |
|---|---|
| `pnpm build` | Correcto, TypeScript y compilación Vite |
| `pnpm test` | 28 archivos, 144 pruebas superadas |
| Pruebas nuevas del cliente HTTP | 4 superadas, incluidas en las 144 |
| `pytest .../server/test_study_gateway.py -q` | 10 superadas |

Las pruebas de servidor usan el servicio real y dobles de proveedor/embeddings
exclusivamente dentro del entorno temporal de prueba. Verifican autenticación,
separación entre alumnos, roles, revocación, expiración, cierre de sesión, exclusión
de datos de prueba, persistencia, errores sin respuestas simuladas, límites de tamaño,
cabeceras de navegador, control de consultas concurrentes y trabajos asíncronos idempotentes.
Dos advertencias de deprecación proceden del TestClient/Starlette del entorno existente;
no se cambiaron sus dependencias.

El conjunto anterior de pruebas del prototipo local sigue pasando. Sus resultados de
recuperación sobre seis problemas sintéticos **no evalúan** el corpus, embeddings ni LLM
de `tesis-pc` y no se utilizan como evidencia de calidad del tutor conectado.

## Comprobaciones con servicios reales

Se reutilizó la configuración de `tesis-pc`: proveedor local compatible, sin credenciales
remotas, catálogo de 12 problemas, índice disponible y ejecución de código desactivada.
Se inició el modelo local preparado por el propio tutor. No se cambiaron corpus ni políticas.

Participante de verificación: `QA-integracion-web-20260923`, marcado como prueba.
Se inició una sesión de **Balance de mediciones** desde la interfaz.

1. Consulta de comprensión: si el primer `3` del ejemplo también se suma.
   El modelo distinguió cantidad de mediciones de valores, explicó la suma y devolvió
   nivel N0 y dos fuentes. La pantalla mostró la respuesta guardada.
2. Se reinició el portal y se abrió por el enlace HTTPS público. Con el mismo acceso
   se pudo retomar la sesión y recuperar íntegra la primera interacción.
3. Consulta conceptual enviada por Internet mediante el trabajo asíncrono: significado
   de acumulador tras leer dos mediciones. El modelo explicó la suma progresiva y el
   estado `3 → 1` para `3, -2`, con nivel N2 y una fuente.
4. Se desplegó la sección de comprobación y fuentes: informó **no ejecutado**, identificó
   el material propio y conservó la indicación de revisión docente pendiente.
5. Se consultaron el perfil y las recomendaciones desde el navegador público. El perfil
   no inventó dominio a partir de dos preguntas: mostró conocimientos declarados y ausencia
   de observaciones. Para `arreglos`, se recibieron tres problemas con motivos de práctica.
   La consola del navegador no reportó errores. Al terminar se cerró la sesión de prueba.
6. La exportación docente real incluyó cero participantes del estudio, coherente con que
   el único acceso creado era de prueba. Se verificó su exclusión sin borrar sus registros.

Son respuestas reales observadas en el navegador, no pruebas con un proveedor simulado.
La inspección visual del panel de conversación se hizo en el ancho disponible del navegador
integrado (aproximadamente 644 px); no se realizó una batería completa de dispositivos.

## Publicación temporal

`scripts/start-pilot.ps1` inició el portal y el túnel en segundo plano y guardó sus IDs/rutas
y fecha de inicio. Las comprobaciones de identidad de proceso del script de parada
coinciden con los dos procesos activos. No se detuvo el enlace final para esta comprobación.

Comprobaciones HTTP de la URL pública durante esta ejecución:

- Página del portal: **200**.
- Exportación docente sin autenticación: **401**.
- Ruta original `/students`: **404**.

La URL vigente queda en `.runtime/pilot-url.txt`. No se versiona porque es temporal.
El binario de Cloudflare provino de su repositorio oficial, versión `2026.9.1`, con SHA-256
`2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712` comprobado.

## Límites de lo verificado

No se probó carga de un aula completa, disponibilidad continua ni despliegue permanente.
El modelo atiende una consulta a la vez; el portal avisa a los demás para que reintenten.
No se verificó ejecución de código, ya que está desactivada en el tutor.
Las pruebas de acceso no sustituyen una auditoría de seguridad independiente.
La revisión pedagógica y el protocolo de participación de los alumnos siguen correspondiendo
al investigador. La guía de operación detalla credenciales, respaldo, reinicio y exportación.
