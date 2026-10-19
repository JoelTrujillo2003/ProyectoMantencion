# Entrega para presentación

## La web pública

https://garage-premium-moderno.onrender.com/#garage

Entra con Google y la cuenta `joel.trujillo@mayor.cl`. Tiene Premium de
presentación asignado en Supabase, sin cobro y sin vencimiento automático.
Incluye la guía con Gemini, más de dos vehículos y los modelos Premium.
Las demás cuentas empiezan gratis y pueden guardar hasta dos vehículos.
Mercado Pago no está habilitado; no hay un pago real que completar.

El alojamiento gratuito puede tardar en responder después de estar inactivo.
Abre la web con anticipación y comprueba el acceso antes de presentar.
No se garantiza disponibilidad sin interrupciones de los servicios externos.

## Abrir el ZIP en otro computador

1. Extrae el ZIP y abre la carpeta `proyectomantencion` en Visual Studio Code.
2. Instala Node.js 24 con npm si ese computador no lo tiene.
3. Abre una terminal en esa carpeta y ejecuta:

```powershell
npm.cmd ci
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath configuracion-local.publica.env -Destination .env
}
npm.cmd start
```

Abre http://localhost:3000. No abras `public/index.html` con doble clic ni
con Live Server: la aplicación necesita el servidor Node.

La configuración pública incluida conecta el servidor local con el mismo
Supabase de la presentación. La sesión y los datos son reales; un vehículo
guardado allí también aparece al entrar con esa cuenta en la web pública.
Esta clave pública no concede permisos administrativos: las reglas de acceso
de Supabase y la sesión de cada usuario siguen aplicándose.

## ¿Funcionará la IA para el profesor?

Enviar el ZIP entrega el código, pero no copia el servidor de Render ni sus
claves privadas. Para una consulta real siempre hace falta internet: tanto
Supabase como Gemini son servicios remotos.

- En el enlace público, Gemini ya está conectado al servidor. La cuenta de
  Joel tiene Premium; otra cuenta Google recibe el plan gratuito y no usa IA.
- En localhost, el profesor debe configurar una clave propia de Gemini como
  `GEMINI_API_KEY` en su `.env`. También necesita iniciar sesión con una cuenta
  que tenga Premium en el proyecto Supabase utilizado. Poner una clave de IA
  no convierte una cuenta gratuita en Premium.
- Para presentar la IA desde tu cuenta, inicia tú la sesión de Google. No
  envíes tu contraseña, códigos de acceso ni claves privadas por correo.

Con la clave local configurada se puede comprobar el generador, sin iniciar
sesión ni guardar datos, ejecutando `npm.cmd run ai:check`. Es una comprobación
administrativa con datos de ejemplo; consume cuota de la API. No cambia el
plan de ninguna cuenta ni habilita IA para usuarios gratuitos de la web.

El catálogo y la interfaz son archivos locales, pero autenticarse, cargar y
guardar vehículos, y generar una guía requieren internet. La instalación
inicial de dependencias también requiere internet.

Para pruebas automatizadas con servicios simulados: `npm.cmd test`.
Las guías completas están en `00_EMPEZAR_AQUI.md` y `PUBLICAR_EN_RENDER.md`.

## Configuración que se mantiene pendiente

Microsoft, Apple, el envío de confirmaciones por correo a usuarios externos y
los pagos de Mercado Pago requieren completar sus servicios respectivos.
El acceso público con Google está habilitado. El acceso Premium de Joel es
una asignación administrativa de presentación y está guardado en Supabase;
no es un pago de Mercado Pago ni un correo privilegiado escrito en el código.

Si cambias a una base de datos propia, aplica las migraciones y configura sus
claves. Los usuarios, datos y asignaciones Premium del proyecto actual no se
copian automáticamente al cambiar de proyecto.
