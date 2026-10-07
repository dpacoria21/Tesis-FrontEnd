# Tutor de programación competitiva · Tesis

## Tutor personalizado conectado a tesis-pc

La entrada principal abre el portal de tesis, conectado al tutor real de la carpeta hermana `tesis-pc`.
El portal para alumnos incorpora códigos individuales, sesiones persistentes, historial,
perfil y recomendaciones. La vista del investigador permite crear/revocar accesos y exportar
los registros. Consulta [la guía del piloto por Internet](docs/INTEGRACION_TESIS_PC.md).

```powershell
pnpm build
& scripts/start-pilot.ps1
# Al terminar las sesiones:
& scripts/stop-pilot.ps1
```

El script muestra una URL HTTPS temporal y la ubicación del código docente. Requiere
el entorno y el modelo local ya preparados en `tesis-pc`. Mantén este equipo encendido.
La ruta de alumnos es `/` (también se mantiene `/?tutor=1`). Incluye confirmación de trabajo en
un solo problema, cronómetro persistente, finalización e historial con tiempos. El tiempo
incluye espera del tutor y tiempo fuera de la pestaña, hasta finalizar explícitamente.
Las pestañas **Enunciado / Codeforces** permiten consultar el material y abrir su fuente
oficial; los problemas propios no reciben enlaces inventados. Los problemas de Codeforces
se incorporan desde `tesis-pc/corpus/codeforces.json` con el comando de ingesta habitual.
Consulta [el flujo y las métricas](docs/SESIONES_TESIS.md).

## Entrenador personal anterior

Se conserva para desarrollo local en `/?personal=1`, fuera del recorrido de la tesis.
El portal servido por la pasarela pública siempre abre el tutor.

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
