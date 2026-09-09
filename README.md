# Momentum

Entrenador adaptativo y local-first para recuperar y superar el nivel **Specialist** en Codeforces. Está calibrado con el informe analítico de `Fernando_Benito`: prioriza fiabilidad de implementación, práctica constante y conversión bajo presión sobre volumen de problemas.

## Qué incluye

- Dos problemas diarios base: recuperación y consolidación.
- Sesiones random configurables por cantidad, rango y rating predominante, filtradas según el historial y las debilidades del perfil.
- Protección de contests para virtuales: reserva por fecha los más recientes, limita IDs o excluye contests completos.
- Reto 1700+ desbloqueado únicamente al sostener la fiabilidad objetivo.
- Sincronización pública con Codeforces: perfil, submissions, historial de rating y catálogo.
- Temporizador con protocolo de 10/35 minutos, checklist pre-submit y pausa tras errores repetidos.
- Registro de resultado, intentos, confianza, editorial y causa real del fallo.
- Métricas de AC al primer submit, intentos, causas de error, temas y rating.
- Plan completo de 12 semanas, del 17 de agosto al 8 de noviembre de 2026.
- Persistencia local y respaldo/restauración en JSON.

## Iniciar

```powershell
pnpm install
pnpm dev
```

Luego abre [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Validar

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## Privacidad y datos

La app consulta únicamente la API pública de Codeforces y no solicita contraseña ni API key. Las sesiones, notas y preferencias permanecen en el navegador mediante `localStorage` e IndexedDB. El cliente respeta un mínimo de 2.1 segundos entre solicitudes a Codeforces y mantiene un catálogo offline inicial para que la experiencia siga funcionando si la API no responde.
