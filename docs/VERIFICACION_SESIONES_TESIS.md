# Verificación de sesiones de tesis — 7 de octubre de 2026

- `pnpm build`: compilación TypeScript y Vite correctas.
- Suite web completa: 165 pruebas aprobadas antes de añadir la comprobación adicional del
  contrato de inicio/cierre. Suite final focalizada `pnpm exec vitest run src/tutor/remote --silent`:
  26 pruebas aprobadas, incluyendo esa comprobación, validación de enlaces y cálculo visual del tiempo.
- `uv run pytest tests ../cf-app/server/test_study_gateway.py -q`, desde `tesis-pc`:
  139 aprobadas, 6 no seleccionadas por la configuración de integración real.
  Dos avisos de obsolescencia de Starlette/httpx/anyio; ningún fallo.
- Se compilaron las referencias C++17 propias de 4A y 71A y se verificaron ejemplos y fronteras.
- Ingesta real `uv run tutor ingest --file corpus/codeforces.json`: 14 problemas, 10 conceptos,
  94 fragmentos, embeddings de dimensión 384. Conserva el catálogo previo.

## Navegador

Se utilizó el portal compilado, una pasarela en el puerto 8011 y bases de datos temporales.
El participante se identificó como **QA interfaz · datos aislados** y estaba marcado como prueba.
El modelo y los embeddings de este servidor fueron dobles de prueba; el aviso de modelo sin
configurar en las capturas corresponde a ese entorno. No se realizaron turnos con el LLM real
ni se modificaron participantes de investigación durante la comprobación visual.

Verificado mediante interacción real:

- Entrada directa al portal y acceso con código.
- Fuente Codeforces desactivada para un problema propio y enlace correcto en Watermelon.
- Cancelación del compromiso sin crear sesión.
- Botón de inicio desactivado hasta marcar el compromiso.
- Inicio con contador visible y selección de otros problemas bloqueada.
- Recarga con restauración de sesión y duración acumulada.
- Pestaña Codeforces con acceso al original.
- Finalización como detenida: tiempo fijo en 00:00:30, historial conservado y selectores habilitados.
- Formulario de confirmación en escritorio (1280 × 850) y móvil (390 × 844).

Capturas: `output/tesis-sesiones/confirmacion.jpg`, `confirmacion-movil.jpg` y
`sesion-finalizada.jpg`. El servidor temporal fue detenido. El portal real se dejó abierto
en `http://127.0.0.1:8010/?tutor=1`; el índice real quedó actualizado, sin publicar un túnel.
