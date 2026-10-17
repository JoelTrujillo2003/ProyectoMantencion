# Publicar Garage Premium Moderno

## Código y servidor

El repositorio debe contener `package.json`, `server.js`, `public/`, `src/` y
`supabase/migrations/` en la raíz. `render.yaml` prepara un Web Service gratuito:
Node 24, `npm ci`, `npm start`, `HOST=0.0.0.0` y health check `/api/health`.
En Render puedes usar New > Blueprint con este archivo o New > Web Service e
introducir esos valores manualmente. Selecciona la rama que contiene esta entrega.

El plan gratuito puede suspenderse cuando no hay actividad. Para una presentación,
comprueba el tiempo del primer acceso. No se ha contratado ningún plan de pago.

## Variables de entorno

En Render > Environment configura:

```dotenv
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
SUPABASE_SECRET_KEY=sb_secret_TU_CLAVE_SECRETA
```

La clave pública procede de Connect o Settings > API Keys de Supabase; la secreta
solo se utiliza en el servidor. Esta versión acepta también las variables antiguas
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` cuando las nuevas no están definidas.
Las claves nuevas se envían con `apikey`; el JWT de cada usuario mantiene su
autorización individual. No subas `.env` al repositorio ni al ZIP.

Si no defines `APP_BASE_URL`, el servidor usa el `RENDER_EXTERNAL_URL` que asigna
Render. Si añades un dominio propio, define `APP_BASE_URL=https://TU-DOMINIO`.
Conserva el puerto que asigna Render; no hace falta fijar `PORT=3000`.

Gemini y Mercado Pago requieren variables adicionales, descritas en la guía de
inicio. Los botones de pago no se habilitan hasta completar esa configuración.

## Base de datos y acceso

En una base nueva ejecuta en SQL Editor las migraciones 001, 002 y 003, en orden.
En una base existente, revisa primero su esquema y los datos antes de aplicar cambios.

En Authentication > URL Configuration:

- Site URL: la URL pública que entregue Render.
- Redirect URLs: esa misma URL seguida de `/?auth=callback`.
- Puedes mantener `http://localhost:3000/?auth=callback` para desarrollar.

Habilita Email y Confirm Email. Para enviar confirmaciones a personas ajenas al
equipo de Supabase, configura Custom SMTP con un proveedor de correo y un remitente
autorizado. El SMTP predeterminado de Supabase solo envía a correos del equipo.

Los secretos de Google, Azure/Microsoft y Apple se configuran en Supabase y en el
panel de cada proveedor. Usa como callback del proveedor el que muestra Supabase,
que es diferente del retorno de la aplicación. No desactives la verificación de
correo para solucionar fallos de envío.

## Comprobar la publicación

1. Abre `/api/health` en el dominio público: debe responder `{"ok":true}`.
2. Desde un teléfono con datos móviles, crea una cuenta y confirma el correo en el
   mismo navegador donde empezaste.
3. Guarda un vehículo, cierra sesión, vuelve a entrar y comprueba que permanece.
4. Con otra cuenta, verifica que cada persona ve solo sus propios vehículos.
5. Completa por separado los accesos sociales y las pruebas de IA y pago.

Referencias oficiales: [Render](https://render.com/docs/web-services),
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) y
[claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
