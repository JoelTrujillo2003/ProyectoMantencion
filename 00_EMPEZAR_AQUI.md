# Garage Premium Moderno — proyecto completo para Visual Studio Code

## 1. Abrir y ejecutar

Extrae el ZIP en una carpeta nueva y conserva tu proyecto anterior. En **Visual Studio Code → Archivo → Abrir carpeta**, selecciona `proyectomantencion`: dentro deben verse `package.json`, `server.js` y `public/`.

Necesitas Node.js con npm. Esta entrega se comprobó con Node.js 24. Abre una terminal PowerShell en VS Code y ejecuta:

```powershell
npm.cmd ci
```

Si ya tienes un `.env` con tus credenciales, cópialo junto a `server.js`. Si no existe, crea una copia del ejemplo:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Completa los servicios que utilizarás, siguiendo las secciones siguientes. Después ejecuta:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd start
```

Abre **http://localhost:3000**. Para detener el servidor, pulsa Ctrl+C en la terminal. Reinícialo después de cambiar el `.env`. No abras `index.html` con doble clic ni mediante Live Server: las funciones de cuenta, IA y pagos necesitan el servidor Node.

## 2. Base de datos y cuentas en Supabase

En tu proyecto de Supabase, abre SQL Editor. Para una base nueva ejecuta completos estos archivos, en este orden:

1. `supabase/migrations/001_freemium.sql`
2. `supabase/migrations/002_feedback.sql`
3. `supabase/migrations/003_catalog_chile.sql`

Si ya aplicaste los anteriores, no necesitas repetirlos para cambiar el diseño. La migración 003 corresponde a la ampliación del catálogo.

Completa en `.env`:

```dotenv
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
SUPABASE_SECRET_KEY=sb_secret_TU_CLAVE_SECRETA
```

El acceso y los vehículos usan Supabase Auth y las tablas del proyecto. La clave service role la necesita el servidor para administrar suscripciones; no debe ponerse en `public/`.

Para el registro por correo, revisa que ese método esté habilitado en Authentication y que el envío de confirmaciones funcione. En URL Configuration configura la dirección del sitio y permite el retorno exacto `http://localhost:3000/?auth=callback` durante la prueba local. Completa el registro y la confirmación desde el mismo navegador.

## 3. Google, Microsoft y Apple

La pantalla muestra primero correo, contraseña y el botón de acceso o registro. Debajo aparecen los iconos pequeños, en este orden: **Google · Microsoft · Apple**.

Lee **CONFIGURAR_ACCESO_SOCIAL.md** para preparar cada proveedor, sus credenciales y las direcciones de retorno. Los iconos se activan cuando Supabase informa que el proveedor está habilitado. El cambio visual no habilita por sí solo una cuenta de proveedor.

## 4. Gemini

Completa en `.env`:

```dotenv
GEMINI_API_KEY=TU_CLAVE_DE_GEMINI
GEMINI_MODEL=gemini-3.8-flash
```

La orientación con IA requiere iniciar sesión con una cuenta Premium. Guarda la clave solo en el servidor. Si copiaste un `.env` antiguo, revisa su línea `GEMINI_MODEL`, porque prevalece sobre el modelo predeterminado.

El reporte es orientativo, no consulta sensores ni manuales en esta versión y no se almacena. Los datos del vehículo sí pueden guardarse en Supabase.

## 5. Mercado Pago

El proyecto incluye el flujo de suscripción. La guía detallada está en **GUIA_FREEMIUM.md**. Configura la aplicación y sus credenciales para el entorno que vayas a probar; usa cuentas y medios de prueba cuando estén disponibles para tu integración.

Las variables que utiliza el código son:

```dotenv
APP_BASE_URL=https://TU-DOMINIO
MERCADOPAGO_ACCESS_TOKEN=TU_ACCESS_TOKEN
MERCADOPAGO_PLAN_ID=ID_DE_TU_PLAN
MERCADOPAGO_WEBHOOK_SECRET=TU_SECRETO_DE_WEBHOOK
PREMIUM_PRICE_CLP=4990
```

`PREMIUM_PRICE_CLP` es el importe de ejemplo usado por `scripts/create-mercadopago-plan.mjs`. Revísalo antes de crear un plan; cambiarlo no modifica un plan existente. El comando `npm.cmd run mp:create-plan` crea un plan en la cuenta y entorno asociados al token y muestra el ID para el `.env`. No se ejecutó al preparar este ZIP.

Para recibir las notificaciones necesitas una dirección pública HTTPS que apunte al servidor. El endpoint implementado es:

```text
https://TU-DOMINIO/api/webhooks/mercadopago
```

El servidor procesa `subscription_preapproval`, comprueba la firma y consulta la suscripción al proveedor. Una URL `localhost` en tu equipo no es un endpoint público para Mercado Pago. Al alojar la aplicación, ajusta también `APP_BASE_URL`, los retornos de Supabase y, si tu alojamiento lo requiere, `HOST=0.0.0.0` y el `PORT` asignado.

Referencias oficiales: [API de suscripciones](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/overview) y [creación de planes](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/create-preapproval-plan/post).

## 6. Probar el recorrido completo

Antes de presentar, comprueba con tus servicios reales: crear cuenta, confirmar correo, iniciar sesión, guardar un vehículo, recargar y volver a verlo. Prueba por separado cada proveedor social y una consulta Gemini con Premium. Después comprueba la suscripción de Mercado Pago en el entorno elegido y su actualización en Supabase.

El diseño y el código están incluidos; **las credenciales, las cuentas externas y su activación no están incluidas ni comprobadas con servicios reales**. Sin configurarlas puedes explorar la portada y el catálogo. El inicio de sesión, el guardado, la IA y los pagos necesitan esas conexiones.

## Archivos que te servirán

| Archivo o carpeta | Uso |
|---|---|
| `public/index.html`, `public/styles.css` | Diseño de la web |
| `public/app.js`, `public/auth-providers.js` | Interacciones y acceso |
| `public/catalog.json`, `public/premium-vehicles.json` | Catálogo y modelos Premium |
| `server.js`, `src/` | API, Supabase, Gemini y Mercado Pago |
| `supabase/migrations/` | Preparación de la base de datos |
| `.env.example` | Variables que debes configurar |
| `CONFIGURAR_ACCESO_SOCIAL.md` | Google, Microsoft y Apple |
| `LEEME_CHILE.md` | Catálogo, criterios de años y comprobaciones |
| `GUIA_FREEMIUM.md` | Planes y configuración de suscripciones |

El ZIP conserva las imágenes, fuentes, licencias, scripts, pruebas y el archivo de versiones `package-lock.json`. Las dependencias se instalan con `npm ci`; no se incluyen `node_modules` ni archivos `.env` privados.
