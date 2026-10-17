# Acceso con Google, Microsoft y Apple

La interfaz y el flujo OAuth ya están implementados para los tres proveedores. El formulario de correo aparece primero; los tres iconos compactos quedan centrados debajo. Los botones aparecen tanto en **Iniciar sesión** como en **Crear cuenta**. Supabase autentica al usuario y entrega la sesión que utilizan las funciones existentes del garage. La aplicación conserva la opción de correo y contraseña.

**Falta la configuración de tus cuentas de proveedor.** Esta entrega no incluye credenciales ni ha iniciado sesión con cuentas reales. Los botones solo se activan cuando Supabase informa que el proveedor está habilitado. Si la comprobación falla, el acceso con correo sigue disponible.

## 1. Configuración común de Supabase

Completa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en el `.env` del servidor. Los secretos OAuth se configuran en el panel de Supabase y en el proveedor; no se añaden al HTML ni al JavaScript público.

En **Authentication → URL Configuration** configura:

| Campo | Para la prueba local |
|---|---|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/?auth=callback` |

Si cambias de puerto, ajusta ambas direcciones. Para la presentación en un dominio HTTPS, agrega su retorno exacto, por ejemplo `https://TU-DOMINIO/?auth=callback`. Evita depender de comodines para producción.

Hay dos retornos distintos:

1. **Del proveedor a Supabase:** copia el callback de la pantalla del proveedor en Supabase. Normalmente tiene la forma `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
2. **De Supabase a Garage Premium:** `http://localhost:3000/?auth=callback` para esta prueba local.

El código usa PKCE y canjea el código de retorno por una sesión. Limpia de la dirección los parámetros de autenticación y vuelve a `#garage`. El acceso debe completarse en el navegador donde se inició; también confirma los enlaces nuevos de registro por correo desde ese navegador. Los errores o cancelaciones no se presentan como un acceso exitoso.

## 2. Google

En Google Cloud configura el proyecto y su pantalla de consentimiento. Autoriza las cuentas que utilizarás en la demostración. Crea un cliente OAuth de tipo **Aplicación web**.

- Origen JavaScript local: `http://localhost:3000`.
- URI de redirección autorizada: el callback **de Supabase** indicado arriba.
- Copia el Client ID y Client Secret en **Supabase → Authentication → Sign In / Providers → Google** y habilítalo.

Los permisos de identidad habituales son OpenID, correo y perfil básico. Esta integración no solicita correo de Gmail, contactos ni archivos. La app pide seleccionar cuenta al comenzar el acceso con Google.

Fuente oficial: [Sign in with Google — Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 3. Microsoft

En **Microsoft Entra ID → App registrations**, registra una aplicación. Para admitir cuentas personales y de organizaciones, selecciona el tipo de cuentas correspondiente; el tenant configurado debe coincidir con esa elección.

- Plataforma: Web.
- Redirect URI: callback **de Supabase**.
- Crea un Client Secret y copia su **Value**, junto al Application (client) ID, en el proveedor **Azure (Microsoft)** de Supabase.
- Habilita el proveedor. Si admites varios tipos de cuenta, revisa el tenant `common`; no limites el acceso a una organización por accidente.

El identificador que utiliza el código es `azure`, aunque el botón dice Microsoft. Se solicita el alcance `email`, necesario para Supabase. Revisa también la configuración recomendada de verificación de correo `xms_edov` y la fecha de vencimiento del secreto en la documentación oficial.

Fuente oficial: [Sign in with Azure — Supabase](https://supabase.com/docs/guides/auth/social-login/auth-azure).

## 4. Apple

Configura Sign in with Apple en tu cuenta Apple Developer:

- Un App ID con esa capacidad y un **Services ID** para la web.
- Website domain: el dominio de tu proyecto Supabase, normalmente `TU-PROYECTO.supabase.co`.
- Return URL: callback **de Supabase**.
- Una clave de firma y el secreto generado para el flujo web, usando los identificadores de tu cuenta.

Agrega el Services ID y el secreto al proveedor **Apple** de Supabase y habilítalo. Si también tienes identificadores de una app nativa, el Services ID web debe ir primero en la lista correspondiente.

El secreto del flujo OAuth web de Apple debe renovarse cada seis meses; si vence, el acceso deja de funcionar. No se necesita guardar el nombre completo para usar el garage; Apple puede proporcionar un correo privado de retransmisión cuando el usuario elige ocultar su dirección.

Fuente oficial: [Sign in with Apple — Supabase](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## 5. Ensayo antes de presentar

Reinicia el servidor si cambiaste el `.env`, recarga la página y comprueba cada proveedor por separado:

1. Pulsa su botón y completa el acceso en su página.
2. Comprueba que vuelves al garage, sin parámetros de autenticación visibles en la dirección.
3. Guarda un vehículo, cierra sesión y entra con el mismo método para comprobar que reaparece.
4. Cancela un acceso para revisar su mensaje de error y que puedas intentar nuevamente.
5. Comprueba que la cuenta Premium sigue mostrando su plan y que la cuenta Free conserva sus límites.

Que Supabase marque un proveedor como habilitado no demuestra que sus secretos o permisos sean correctos: hay que completar este ensayo real.

Los datos pertenecen al usuario autenticado en Supabase. No se implementó una fusión de cuentas. Si usas otro correo o el correo privado de Apple, podrías entrar a una cuenta diferente; confirma las identidades en Supabase antes de la presentación.

El borrador de Hablemos se conserva temporalmente en la misma pestaña al salir hacia un proveedor, si el navegador permite almacenamiento de sesión. No se envía al proveedor ni se envía como feedback automáticamente.

## Verificación incluida

Esta versión pasó 28 pruebas automáticas, incluida la generación de OAuth PKCE con el SDK Supabase que trae el ZIP, el canje de código con sesión simulada, la cancelación, el retorno vencido, la disponibilidad de proveedores y el rechazo de retornos alterados. Se revisó la pantalla real en ambos modos de acceso. No se han comprobado credenciales reales de Google, Microsoft o Apple.

Esta mejora no necesita una migración nueva de base de datos. Conserva las migraciones anteriores de catálogo y permisos.
