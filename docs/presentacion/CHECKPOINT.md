# Checkpoint operativo

- **Fecha y hora local:** 2026-09-03 (America/Lima).
- **Objetivo durable:** prototipo verificable de tutor RAG híbrido hasta el corte
  de septiembre S1 de 2026.
- **Fase actual:** Fase 8 — API, interfaz y recorrido de demostración.
- **Estado:** EN_CURSO.
- **Último subhito terminado:** Fases 3 a 7 verificadas mediante 109 pruebas del
  tutor y un comando de ingesta/índice reproducible.
- **Evidencia obtenida:** README.md, package.json, configuraciones TypeScript y
  Vite, inventario de 17 archivos de fuente y
  docs/presentacion/RESULTADOS_PRUEBAS.md.
- **Archivos modificados por Codex:** consultar la lista acumulada en este
  checkpoint y, al cierre, el inventario final; por ahora incluye el prompt por
  fases, plan, fuentes, requisitos, arquitectura, resultados y checkpoint.
- **Comandos ejecutados:** git status --short --branch devolvió código 1 porque
  no existe .git; rg --files confirmó la aplicación y dependencias.
- **Pruebas aprobadas:** línea base de 18 pruebas; `pnpm test:tutor` con 109
  pruebas en 21 archivos; typecheck; build base; preview base con HTTP 200.
- **Pruebas fallidas o no ejecutadas:** un typecheck intermedio detectó y se
  corrigió un cast inseguro en una prueba de esquema; falta todavía build,
  preview, recorrido visual y regresión final posteriores a la integración UI.
- **Cambios preexistentes preservados:** todos los archivos existentes; sin Git
  no es posible atribuir su autoría ni calcular un diff base.
- **Decisiones y supuestos:** no inicializar Git; conservar la aplicación
  Momentum y adaptarla de forma incremental; fuentes DOCX/XLSX buscadas sin
  modificar originales.
- **Bloqueos:** ninguno. Las fuentes DOCX y XLSX fueron localizadas y leídas en
  modo de solo lectura; la ausencia de credencial OpenAI solo deja pendiente el
  smoke test real y no bloquea el camino determinista.
- **Siguiente acción atómica:** integrar `TutorWorkspace` en la navegación de
  Momentum y verificar las nueve acciones del recorrido con datos de prueba.
- **Comando para reanudar:** leer este archivo, ejecutar git status (registrar
  el error esperado si sigue sin Git) y ejecutar pnpm typecheck.
- **Comando de validación:** `pnpm typecheck`, `pnpm test:tutor`, `pnpm test` y
  `pnpm build` después de conectar la interfaz.
- **Elementos que no deben repetirse:** lectura completa de
  PROMPT_CODEX_TESIS_POR_FASES.md y descubrimiento inicial del stack, salvo que
  cambien esos archivos.
