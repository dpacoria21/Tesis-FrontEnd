# Resultados de pruebas

## Línea base previa a la implementación del tutor

- **Fecha local:** 2026-09-02.
- **Entorno:** Windows, Node.js v24.16.0, pnpm 11.19.0.
- **Repositorio Git:** no disponible en esta carpeta.
- **Propósito:** establecer el comportamiento verificable de la aplicación
  Momentum antes de implementar el tutor RAG.

| Verificación | Comando | Código | Resultado |
|---|---|---:|---|
| Instalación reproducible | pnpm install --frozen-lockfile | 0 | Dependencias ya actualizadas; 237 ms, pnpm 11.19.0 |
| TypeScript | pnpm.cmd typecheck | 0 | Sin errores; 3.210 s |
| Pruebas unitarias | pnpm.cmd test | 0 | 3 archivos, 18 pruebas aprobadas; 3.091 s |
| Build | pnpm.cmd build | 0 | 1.586 módulos; build aprobado; 6.984 s |
| Preview | pnpm.cmd preview --host 127.0.0.1 --port 4173 --strictPort | Interrumpido tras verificar | Servidor accesible en 127.0.0.1:4173 |
| Healthcheck | Invoke-WebRequest a http://127.0.0.1:4173/ | 0 | HTTP 200, text/html, 653 bytes |
| Cierre del preview | Ctrl+C y comprobación del puerto 4173 | Cierre intencional | listener_after_stop=false |

### Detalle de la suite inicial

- src/domain/recommendations.test.ts: 5 pruebas aprobadas.
- src/services/codeforces.test.ts: 1 prueba aprobada.
- src/domain/randomSession.test.ts: 12 pruebas aprobadas.

### Artefactos del build inicial

- dist/index.html: 0,65 kB; gzip 0,38 kB.
- CSS: 34,70 kB; gzip 7,47 kB.
- JavaScript: 294,61 kB; gzip 88,94 kB.

### Observaciones

- El comando de build regeneró dist/; no se editaron fuentes durante esta
  verificación.
- El proceso de preview terminó con código no cero por la interrupción manual
  posterior al healthcheck. El puerto quedó libre, por lo que no representa un
  fallo de la aplicación.
- Un primer intento de encapsular el preview con Start-Process fue rechazado por
  la capa de ejecución antes de crear el proceso y no tuvo efecto.

## Verificación intermedia del núcleo del tutor

- **Fecha local:** 2026-09-03.
- **Comando:** `pnpm tutor:ingest`.
- **Resultado:** código 0; un archivo y una prueba aprobada; 6 documentos y 42
  chunks. Primera ingesta: 6 procesados, 0 omitidos, 0 rechazados. Segunda:
  0 procesados, 6 omitidos, 0 rechazados, `unchanged=true`. Primer índice: 42
  embeddings generados; segundo: 42 reutilizados. Digest estable del índice:
  `f441b5b1-22a146c2`.
- **Comando:** `pnpm test:tutor`.
- **Resultado:** código 0; 21 archivos y 109 pruebas aprobadas; duración Vitest
  758 ms. Cubre corpus, ingesta, embeddings, BM25, Dense, RRF, filtros, estado,
  eventos, N0--N5, guardas, generador, feedback, recomendación, servicio local,
  casos y métricas del benchmark.
- **Comando:** `pnpm typecheck` después de integrar el servicio de aplicación.
- **Resultado:** código 0, sin diagnósticos.

### Defecto corregido durante la integración

Un typecheck intermedio devolvió código 2 por TS2352 en
`src/tutor/corpus/schema.test.ts`: una conversión de fixture a
`Record<string, unknown>` no pasaba primero por `unknown`. Se corrigió el cast y
el typecheck posterior aprobó. Este resultado intermedio no se presenta como
regresión final.
