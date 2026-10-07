# Piloto web del tutor personalizado

Implementación: 23 de septiembre de 2026. Fuente funcional: el servicio Python existente en
`C:\Users\diego\OneDrive\Desktop\tesis-pc`, sus modelos públicos y su almacenamiento SQLite.

## Uso por el investigador

1. En `cf-app`, ejecuta `pnpm build` si cambiaste la interfaz y después `& scripts/start-pilot.ps1`.
2. Abre la URL HTTPS que muestra el script. También queda en `.runtime/pilot-url.txt`.
3. Para ingresar como investigador, usa el contenido de `.runtime/teacher-access.txt`.
   Es una credencial privada: no se publica ni se comparte con los alumnos.
4. Crea un acceso con el seudónimo de cada alumno, por ejemplo `A001`. Guarda y entrega
   su código individual: el portal lo muestra una sola vez y almacena únicamente su hash.
   Conserva la correspondencia con nombres reales fuera de esta aplicación.
5. Comparte la URL del piloto y el código individual con cada participante.
6. Descarga los registros desde la vista docente. La exportación JSON incluye perfiles,
   sesiones, mensajes, código enviado, respuestas y citas. Excluye participantes de prueba
   por defecto y no incluye códigos, tokens ni trazas internas del modelo.
7. Al terminar y cuando no haya consultas pendientes, ejecuta `& scripts/stop-pilot.ps1`.
   Detiene exclusivamente el portal y el túnel registrados por el script, sin borrar datos.
   El proveedor local queda disponible para el tutor de consola.

Marca los accesos de ensayo como **Participante de prueba**. El acceso
`QA-integracion-web-20260923` se creó únicamente para verificar esta integración.
Los estudiantes preexistentes en `tesis-pc` no se publican ni se convierten en cuentas
web automáticamente. La vista docente solo administra los nuevos accesos web.

## Recorrido del alumno

Ingresar con su código → elegir problema → aceptar el compromiso de trabajo individual →
iniciar sesión con contador → consultar y adjuntar código si lo necesita → leer respuesta,
nivel y fuentes → finalizar y guardar el tiempo. El perfil y las sugerencias quedan en
**Seguimiento del aprendizaje**. Consulta [el contrato de medición](SESIONES_TESIS.md).
En un acceso posterior, **Retomar una sesión** recupera el historial del servidor.
**Salir** invalida el acceso del navegador; el código individual permite volver a entrar
mientras no esté revocado. Los accesos del navegador caducan a las ocho horas.

Los niveles y decisiones pedagógicas proceden íntegramente del tutor Python (N0–N3).
La interfaz no decide el nivel, inventa un diagnóstico ni utiliza el generador de
demostración que existía anteriormente en este front-end.

El código se envía para lectura estática. Solo se solicita ejecución cuando el alumno
marca la opción correspondiente y el backend la tiene habilitada. En la configuración
verificada, la ejecución está desactivada. La UI muestra el resultado declarado por el
alumno separado de las comprobaciones del tutor.

## Inicio local y desarrollo

La ruta predeterminada del tutor es la carpeta hermana `..\tesis-pc`. Se puede cambiar:

```powershell
& scripts/start-pilot.ps1 -TutorDirectory 'C:\ruta\tesis-pc'
```

El script usa el entorno `.venv` del tutor e inicia su proveedor GPU ya preparado mediante
`scripts/start_local_gpu.ps1`. No instala otro modelo ni altera su `.env`, corpus o política.
El ejecutable de Cloudflare se descarga desde el repositorio oficial a `.runtime/` si falta;
la versión está fijada a `2026.9.1` y se verifica SHA-256 antes de ejecutarla.

Para trabajar sin publicar por Internet:

```powershell
pnpm build
& scripts/start-study.ps1
# Portal compilado: http://127.0.0.1:8010/?tutor=1
```

En desarrollo, `pnpm dev` mantiene `/api/tutor` conectado a `127.0.0.1:8010` por proxy.
El servidor del tutor original en el puerto 8000 no necesita iniciarse para este portal.
No uses `--host 0.0.0.0` para publicar el servidor de desarrollo ni el API original.

## Conexión y separación de datos

```text
Navegador del alumno
  → HTTPS temporal de Cloudflare
  → portal autenticado en 127.0.0.1:8010
  → TutorService de tesis-pc
  → recuperación BM25 + Chroma, modelo local, memoria SQLite
```

El portal sirve la interfaz compilada y la API en el mismo origen. No expone las rutas
originales sin autenticación. El identificador del alumno deriva de su token; no puede
seleccionarse enviando un `student_id` arbitrario. El investigador tiene un rol distinto.
Las citas se muestran como texto y únicamente admiten enlaces HTTP(S).

Se limita el tamaño de las peticiones a 64 KiB y los accesos a 60 por minuto para el portal.
Los códigos tienen entropía aleatoria; sus hashes y las sesiones de acceso viven en
`.runtime/study-access.sqlite3`. El único código almacenado en texto es la credencial
docente de arranque en `.runtime/teacher-access.txt`; protege ambos archivos y sus copias.
La carpeta `.runtime` está excluida de Git, lo que no impide una sincronización de OneDrive.

Los registros pedagógicos permanecen en `tesis-pc/data/tutor.sqlite3`. El corpus y los
índices originales se reutilizan. Para respaldar, detén el portal y cualquier consola del
tutor y conserva tanto `tesis-pc/data/` como `cf-app/.runtime/` en un lugar privado.

## Consultas largas y capacidad

Las consultas de la web se aceptan como trabajos asíncronos (`202`) y la pantalla consulta
su estado periódicamente. Cada envío tiene un identificador; repetir el mismo identificador
y contenido no vuelve a ejecutar el turno. No hay reenvíos automáticos de mensajes tras
errores de red. El resultado definitivo y las interacciones se conservan en el servidor.

La capacidad actual es **una consulta al modelo a la vez**. Si otro alumno envía mientras
está ocupado, recibe un aviso y conserva el texto para reintentar. No se ha medido capacidad
de un aula completa ni se implementó una cola multiusuario. Si recargas durante una consulta,
retoma la sesión y usa **Actualizar historial** antes de volver a enviar. Un reinicio puede
interrumpir un trabajo en curso; los trabajos pendientes se marcan como fallidos al arrancar.

La primera consulta puede incluir la carga de embeddings. La respuesta puede tardar minutos;
la espera de la pantalla se limita a 20 minutos. Un error de proveedor no se sustituye con
una respuesta simulada. La disponibilidad “modelo configurado” no garantiza que esté encendido.

## Alcance de la publicación

El túnel permite un piloto temporal sin adquirir dominio ni abrir puertos entrantes.
La URL cambia al reiniciarlo y requiere mantener encendidos el equipo, el proveedor,
el portal y el túnel. Cloudflare procesa el tráfico del enlace; incorpora ese proveedor
en la información y las condiciones de tu piloto según el protocolo de investigación.

[Cloudflare documenta](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
que los túneles temporales se destinan a pruebas y no garantizan disponibilidad.
La integración está preparada para un piloto supervisado; no equivale a una plataforma
de producción ni a una validación pedagógica o ética del estudio.

## Verificación

```powershell
pnpm test
pnpm build
Set-Location '..\tesis-pc'
& .venv\Scripts\python.exe -m pytest ..\cf-app\server\test_study_gateway.py -q
```

Resultados y comprobaciones reales: [VERIFICACION_INTEGRACION_TESIS_PC.md](VERIFICACION_INTEGRACION_TESIS_PC.md).
