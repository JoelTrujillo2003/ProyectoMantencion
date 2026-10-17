> Para abrir el proyecto y conectar sus servicios, empieza por **00_EMPEZAR_AQUI.md**.

# Garage Premium Chile — actualización del 17 de octubre de 2026

## Acceso social añadido

También puedes crear cuenta o iniciar sesión con Google, Microsoft y Apple mediante Supabase. Lee **CONFIGURAR_ACCESO_SOCIAL.md** para habilitar cada proveedor. Los botones muestran su disponibilidad real; las credenciales de proveedores no están incluidas.

## Qué incluye esta entrega

- 284 modelos de autos de 32 marcas y 235 modelos de motos de 21 marcas: 519 entradas en total. Algunas entradas distinguen versiones comerciales.
- 69 modelos requieren Premium para guardar; los demás siguen disponibles en Free (hasta 2 vehículos). Los modelos Premium también pueden explorarse sin cuenta.
- Un explorador público en **Catálogo Chile**, sin iniciar sesión y sin simular un diagnóstico de IA.
- Validación compartida de tipo, marca, modelo, año y kilometraje en navegador y servidor.
- Kilometraje entero de 0 a 999.999, con punto automático: 10000 → 10.000. Los valores mayores o formatos inválidos se rechazan, no se recortan silenciosamente.
- Años futuros bloqueados y lista de años específica por modelo. Pulsar RS200 rechaza 2000.
- Gemini 3.8 Flash como modelo predeterminado, SDK actualizado a 2.30.0, salida JSON validada y errores comprensibles por cuota, acceso, modelo no disponible o demora.
- Una migración nueva para que Supabase compruebe el catálogo, los años y el kilometraje, incluso ante peticiones directas a su API.

## Preparar una copia local en Windows

1. Extrae este ZIP en una carpeta nueva. Conserva el proyecto anterior y su `.env`.
2. Abre la carpeta que contiene `server.js` y `package.json`.
3. Necesitas Node.js con npm. Esta entrega se comprobó con Node.js 24.
4. Ejecuta:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd start
```

Abre **http://localhost:3000/#catalogo**. Sin `.env` funcionan la portada y el explorador público. Registro, guardado e IA requieren configurar los servicios.

## Conectar tus servicios reales

Copia tu `.env` anterior junto a `server.js`, o completa una copia de `.env.example`. No lo pongas dentro de `public/`.

Para cuentas y vehículos:

```dotenv
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

En Supabase prepara las tablas mediante el SQL Editor. En una base nueva ejecuta, en orden:

1. `supabase/migrations/001_freemium.sql`
2. `supabase/migrations/002_feedback.sql`
3. `supabase/migrations/003_catalog_chile.sql`

Si 001 y 002 ya estaban aplicadas, aplica solo **003**. Esta nueva migración no elimina vehículos ni usuarios existentes; valida nuevas altas y cambios. Las filas existentes que no coincidan con el catálogo deberán ajustarse al editarse.

Para IA:

```dotenv
GEMINI_API_KEY=TU_CLAVE_DE_GOOGLE
GEMINI_MODEL=gemini-3.8-flash
```

**Si copias un `.env` antiguo que indica `gemini-3.6-flash`, debes cambiar esa línea.** La configuración del archivo prevalece sobre el modelo predeterminado del código. Reinicia Node después de editarlo.

La cuenta utilizada para mostrar IA debe tener una suscripción Premium activa en tu base de pruebas. El catálogo no concede Premium: lo verifica el servidor con Supabase. No se incluye una cuenta ficticia que salte la autenticación.

Mercado Pago conserva el flujo anterior. Para demostrar solo catálogo, guardado e IA no necesitas realizar un cobro durante la presentación; prepara previamente una cuenta Premium de prueba en tu base de pruebas. Las claves de Mercado Pago, su plan, el webhook y la clave service role siguen siendo necesarios para probar el checkout real. Déjalos vacíos si no lo usarás.

El servidor escucha en 127.0.0.1 por defecto para la prueba local. Si tu proveedor de alojamiento necesita escuchar en todas las interfaces, configura `HOST=0.0.0.0` y el `PORT` que te asigne.

## Alcance real de los años y del catálogo

Esta entrega amplía el catálogo con fuentes de fabricantes y distribuidores chilenos. **No representa todos los vehículos de Chile ni certifica el año exacto de llegada de cada uno.**

Cada ficha distingue:

- `legacy_reference`: rango heredado del ZIP original; no se ha certificado su historial chileno.
- `reference`: rango de referencia con evidencia complementaria; tampoco equivale a fecha oficial de llegada.
- `local_launch`: evidencia de un lanzamiento local. Jaecoo J5, por ejemplo, tiene publicación local de 2025.
- `documented_year`: años que la fuente local identifica explícitamente. Puede haber huecos y no se rellenan de forma automática.
- `catalog_snapshot`: modelo presente en el catálogo chileno consultado en 2026, sin historial anterior comprobado. Solo se habilita 2026; **esto no afirma que llegó en 2026**. También queda pendiente contrastar años de fabricación y versiones con el distribuidor/padrón.

Para Pulsar RS200 se conserva 2015–2026 como rango referencial: el fabricante documenta su lanzamiento mundial en 2015 y hay un testimonio chileno de preventa de ese año. No se presenta ese testimonio como certificación oficial de llegada. El año 2000 se rechaza en todas las capas.

En `public/catalog-sources.json` están las fuentes consultadas y su fecha. Cada incorporación enlaza su fuente desde la ficha del explorador. Un vehículo usado puede tener un año diferente a su año de venta o matriculación; confirma con su documentación.

## Qué cambió en Premium

“Requiere Premium” es una regla de acceso de esta aplicación para guardar determinados modelos. No es una reserva de compra ni una categoría legal o técnica del fabricante. Se mantuvieron los 35 modelos anteriores y se añadieron 34, para un total de 69. La lista se encuentra en `public/premium-vehicles.json`.

## Actualizar datos sin desincronizar las capas

1. Edita `public/catalog.json`. Agrega fuente, criterio de años y rango (`minYear`/`maxYear`) o una lista explícita `years`.
2. Para un modelo que requiera Premium, añádelo además a `public/premium-vehicles.json` usando exactamente el mismo tipo, marca y modelo.
3. Ejecuta `npm.cmd run catalog:build` y `npm.cmd test`.
4. El generador actualiza `public/vehicles.js` y `003_catalog_chile.sql`. Ejecuta nuevamente 003 en Supabase para sincronizar nuevas entradas y cambios de años.

La migración agrega restricciones Premium; no retira restricciones anteriores por sí sola. Si decides pasar un modelo Premium a Free, debes actualizar también la tabla `premium_vehicle_models` de tu base con una migración específica. El generador no elimina filas automáticamente.

## IA: mejoras y límites

El modelo predeterminado es `gemini-3.8-flash`, identificado en la documentación oficial:
https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash

Se usa razonamiento LOW y una respuesta breve para favorecer la latencia. No se garantiza un tiempo exacto: depende de Google, la cuota y la conexión. Hay límite de espera y no se cambian modelos silenciosamente ante un error.

La IA recibe los datos del vehículo y los síntomas, sin adjuntar correo ni contraseña. No consulta internet, manuales ni sensores en esta versión. Un modelo más reciente no equivale a información en tiempo real. El reporte es orientativo, no confirma averías y no se almacena.

## Verificación de esta entrega

- Instalación reproducible mediante `npm ci` y archivo `package-lock.json` actualizado.
- Revisión de sintaxis de los archivos JavaScript.
- 28 pruebas automáticas: validación de catálogo/años/kilometraje, API, acceso Premium, feedback y comportamiento de IA con transporte simulado.
- El SDK real serializa y procesa el formato del reporte en una prueba con transporte simulado; no se usó una clave Gemini real.
- Migraciones 001, 002 y 003 ejecutadas en PostgreSQL aislado (PGlite) con roles y autenticación de prueba. Se comprobó que 003 puede repetirse, además de RLS, permisos, límites de Free, modelos Premium, años y kilometraje.
- Interfaz revisada en navegador: selección Bajaj/RS200, rango de años, formato 10.000 y límite 999.999.
- `npm audit` sin vulnerabilidades conocidas en el momento de la revisión. Se actualizó `proxy-addr` a 2.0.8.

Todavía debes probar tu proyecto Supabase real, la respuesta Gemini con tu clave y tu cuenta Premium, y Mercado Pago si lo presentarás. Las pruebas aisladas no verifican esas credenciales ni garantizan disponibilidad de los proveedores el día de la presentación.

## Ensayo recomendado

Prueba antes en el mismo equipo y conexión de la presentación: iniciar sesión, guardar un vehículo, recargar para verlo persistido, consultar IA, probar un año inválido y comprobar el kilometraje. Ten preparada una cuenta Free y una Premium y una captura de respaldo claramente identificada. El explorador público sigue funcionando sin las credenciales de esos servicios.
