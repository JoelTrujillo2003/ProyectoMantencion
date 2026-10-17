> Actualización Chile: lee primero **LEEME_CHILE.md**. Incluye el catálogo ampliado, la migración 003 y los límites de verificación histórica.

# Implementación del modelo freemium

Esta versión mantiene el login de Supabase y agrega autorización real en tres capas:

1. **Interfaz:** muestra el plan, los cupos utilizados y los modelos exclusivos.
2. **Servidor Express:** verifica el token de Supabase antes de guardar vehículos o usar Gemini.
3. **Base de datos:** las políticas RLS y un trigger impiden superar el límite o guardar modelos Premium aunque alguien manipule el navegador.

## Resultado de cada plan

| Función | Gratuito | Premium |
| --- | --- | --- |
| Vehículos guardados | Máximo 2 | Sin límite |
| Modelos normales | Sí | Sí |
| Modelos especiales | No | Sí |
| Diagnóstico con Gemini | No | Sí |

El estado Premium no se guarda en el navegador. La fuente de verdad es `public.subscriptions` en Supabase y solo el servidor, mediante la clave secreta del servidor, puede modificarla.

## 1. Preparar Supabase

1. Entra a tu proyecto de Supabase.
2. Abre **SQL Editor**.
3. Copia y ejecuta todo el archivo `supabase/migrations/001_freemium.sql`.
4. Ve a **Settings > API Keys** y copia:
   - Project URL → `SUPABASE_URL`.
   - Clave `publishable` → `SUPABASE_PUBLISHABLE_KEY`.
   - Clave `secret` → `SUPABASE_SECRET_KEY`.

La clave secreta del servidor es secreta: debe existir únicamente en `.env` del servidor. Nunca la pongas en `public/app.js`, HTML, GitHub ni una captura de pantalla.

La migración elimina las políticas RLS antiguas de `vehicles` y crea políticas que solo permiten a cada usuario operar sobre sus propias filas. Si ya guardaste vehículos antes, las filas antiguas conservarán `type = null`; puedes corregir manualmente cuáles son `Auto` o `Moto` desde el editor de tablas.

## 2. Configurar las variables

1. Conserva tu `.env` actual, que contiene `GEMINI_API_KEY`.
2. Usa `.env.example` como referencia.
3. Completa como mínimo:

```env
APP_BASE_URL=http://localhost:3000
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
SUPABASE_SECRET_KEY=sb_secret_TU_CLAVE_SECRETA
GEMINI_API_KEY=tu_clave_gemini
```

En producción, `APP_BASE_URL` debe ser el dominio público con HTTPS, sin una barra final.

## 3. Crear la suscripción en Mercado Pago

1. Crea una aplicación en **Mercado Pago Developers > Tus integraciones**.
2. Copia el Access Token de prueba mientras desarrollas y colócalo en:

```env
MERCADOPAGO_ACCESS_TOKEN=TEST-...
PREMIUM_PRICE_CLP=4990
```

3. Con el servidor aún detenido, crea el plan mensual:

```bash
npm run mp:create-plan
```

4. El comando mostrará el identificador del plan. Agrégalo al `.env`:

```env
MERCADOPAGO_PLAN_ID=identificador_entregado
```

5. En la configuración de Webhooks de la integración, registra esta URL pública:

```text
https://tu-dominio.cl/api/webhooks/mercadopago
```

Activa el evento de creación/actualización de suscripciones (`subscription_preapproval`). Copia la clave secreta del Webhook a:

```env
MERCADOPAGO_WEBHOOK_SECRET=tu_clave_secreta
```

Mercado Pago no puede llamar a `localhost`. Para probar Webhooks necesitas publicar temporalmente el servidor o exponerlo mediante un túnel HTTPS. Antes de cobrar dinero real, cambia a credenciales de producción, crea un plan de producción y reemplaza el ID de prueba.

## 4. Instalar y ejecutar

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

## 5. Cómo probar las reglas

### Usuario gratuito

1. Crea una cuenta e inicia sesión.
2. Guarda dos vehículos normales.
3. El tercer intento debe responder que alcanzaste el límite.
4. Los modelos marcados con `Premium` aparecen bloqueados.
5. El botón de IA informa que la función requiere Premium.

### Premium sin realizar un cobro real

Para probar la interfaz durante el desarrollo, busca el UUID del usuario en **Authentication > Users** y ejecuta en SQL Editor:

```sql
insert into public.subscriptions (user_id, plan, status, provider)
values ('UUID_DEL_USUARIO', 'premium', 'active', 'manual')
on conflict (user_id) do update
set plan = 'premium', status = 'active', provider = 'manual', updated_at = now();
```

Cierra la sesión y vuelve a entrar. Para devolver la cuenta al plan gratuito:

```sql
delete from public.subscriptions where user_id = 'UUID_DEL_USUARIO';
```

### Pago de prueba

1. Usa usuarios y tarjetas de prueba de Mercado Pago.
2. Pulsa **Activar Premium**.
3. Completa el checkout.
4. Al regresar, `/api/subscription/sync` consulta el estado real.
5. El Webhook mantiene el estado actualizado después de pausas o cancelaciones.

## 6. Dónde modificar las reglas

- Límite gratuito: `FREE_VEHICLE_LIMIT` en `src/entitlements.js` y el valor `2` del trigger SQL.
- Modelos exclusivos: `public/premium-vehicles.json` y las filas de `premium_vehicle_models` en la migración SQL.
- Beneficios visibles: bloque `Tu cuenta` en `public/index.html`.
- Validación de IA: ruta `POST /api/analizar-vehiculo` en `server.js`.
- Cobro y Webhook: `src/mercadopago.js` y las rutas `/api/subscription/*` de `server.js`.

Si cambias la lista de modelos después de ejecutar la primera migración, actualiza el JSON y crea una segunda migración SQL con los `insert`/`delete` correspondientes. No edites una migración que ya fue aplicada en producción.

## 7. Qué protege cada parte

- El navegador envía el `access_token` actual en cada solicitud.
- Express consulta a Supabase Auth para comprobar que el token pertenece a un usuario real.
- Gemini solo se invoca después de confirmar `plan = premium` y `status = authorized/active`.
- El trigger de PostgreSQL usa un bloqueo transaccional, por lo que dos solicitudes simultáneas no permiten guardar un tercer vehículo gratuito.
- El Webhook valida la firma HMAC y luego consulta la suscripción directamente en Mercado Pago; no confía solo en el contenido recibido.
- RLS impide que un usuario vea o modifique vehículos de otra cuenta.

## 8. Antes de producción

- Configura HTTPS y las credenciales de producción.
- No subas `.env`; el proyecto lo excluye mediante `.gitignore`.
- Define términos de suscripción, precio, periodicidad, cancelación y política de privacidad.
- Añade límites de uso de IA por mes si necesitas controlar costos; ser Premium no debería equivaler necesariamente a llamadas ilimitadas.
- Revisa los diagnósticos con un mecánico: la IA debe presentarse como orientación, no como confirmación de una falla ni sustituto de una inspección.

Documentación oficial útil:

- Mercado Pago, Suscripciones: https://www.mercadopago.cl/developers/es/docs/subscriptions/landing
- Mercado Pago, Webhooks: https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks
- Supabase, Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
