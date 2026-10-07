# Sesiones individuales de resolución

La interfaz principal es el portal de la tesis. Conserva su estilo visual y concentra el
recorrido en acceso individual, problema, tutor e historial. El seguimiento y las
sugerencias se encuentran en un apartado secundario; durante una sesión no se puede
seleccionar otro problema. El entrenador personal anterior sigue disponible únicamente
como opción explícita en desarrollo (`/?personal=1`).

## Recorrido

1. Ingresar con el código asignado y seleccionar un problema.
2. Pulsar **Iniciar sesión de resolución** y aceptar el compromiso de trabajar únicamente
   en ese problema. Cancelar no crea una sesión ni inicia el contador.
3. Consultar el enunciado y el tutor. En problemas con procedencia Codeforces aparece un
   enlace al original y una pestaña de fuente. Codeforces restringe la inserción en otros
   sitios: se abre una pestaña del navegador, sin simular una vista integrada.
4. Pulsar **Finalizar sesión**, declarar si se terminó la solución o se detuvo el trabajo,
   y guardar. El historial permanece accesible; volver a trabajar requiere otra sesión.

La confirmación es un compromiso del participante, no vigilancia del navegador. La
pasarela impide sesiones activas simultáneas del mismo participante, incluso en varias
pestañas. Ante una recarga o un nuevo acceso se recupera la sesión activa. Las sesiones
anteriores a este cambio no reciben tiempos retrospectivos: al continuarlas se confirma
el compromiso y se empieza a medir desde ese momento.

## Definición de la métrica

**Tiempo transcurrido de la sesión**, en segundos: diferencia entre la confirmación de
inicio y la finalización explícita, según el reloj del servidor. Incluye lectura, trabajo,
espera del tutor y permanencia fuera de la pestaña, incluso cierre del navegador o reinicio
del servidor. No mide tiempo de atención, tiempo de CPU ni tiempo de resolución aceptada.
Se indica este alcance antes de comenzar y junto al contador. No hay pausa automática.

La marca `completed` significa que el participante declara haber terminado su solución;
`stopped`, que se detuvo. Ninguna certifica un AC del juez. La exportación docente conserva
ambas por separado del resultado de las comprobaciones del tutor.

## Persistencia y contrato

La tabla `session_measurements` se crea de forma aditiva en
`.runtime/study-access.sqlite3`; no altera sesiones, mensajes o código existentes en
`tesis-pc`. Un índice único limita a una sesión activa por participante. Conservar ambas
bases de datos en los respaldos del piloto.

- `POST /api/tutor/sessions`: exige `problem_id` y `focus_confirmed: true` booleano.
- `POST /api/tutor/sessions/{id}/resume`: exige la misma confirmación para sesiones antiguas.
- `POST /api/tutor/sessions/{id}/finish`: recibe `outcome: completed | stopped`.
- Lecturas y exportación: `measurement` incluye inicio, fin, duración en segundos,
  confirmación, estado, resultado declarado y hora del servidor; es `null` sin medición.

Un inicio repetido del mismo problema activo recupera su sesión sin reiniciar el reloj.
Finalizar otra vez conserva el primer cierre. No se puede finalizar mientras haya una
respuesta del tutor en curso, ni enviar consultas a una sesión finalizada o sin medición.
La exportación usa `schema_version: 2` y documenta estas convenciones en
`measurement_semantics`; los participantes de prueba siguen excluidos por defecto.

## Verificación

En `cf-app`: `pnpm build` y `pnpm test`.

Desde `tesis-pc`: `uv run pytest ../cf-app/server/test_study_gateway.py tests/test_codeforces_corpus.py -q`.
Las pruebas de la pasarela utilizan dobles del modelo y datos temporales; no certifican
la calidad pedagógica del LLM real. Las referencias C++ propias se verifican si hay g++.
