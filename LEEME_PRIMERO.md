> Actualización Chile: lee primero **LEEME_CHILE.md**. Incluye el catálogo ampliado, la migración 003 y los límites de verificación histórica.

# Garage Premium — nueva interfaz

Esta entrega amplía la web del proyecto freemium de la conversación. Incluye el código completo y las imágenes. No contiene tus contraseñas, tu archivo .env ni node_modules. Si hiciste cambios adicionales en tu PC, conserva una copia de esa carpeta antes de actualizar.

## 1. Actualizar tu proyecto actual (Windows y VS Code)

1. Detén el servidor con Ctrl + C en la terminal.
2. Haz una copia de tu carpeta actual. No borres el proyecto anterior.
3. Descomprime este ZIP en otra carpeta. Abre la carpeta **proyectomantencion** en VS Code; es la que contiene package.json y server.js.
4. Copia **tu archivo .env actual** dentro de esta nueva carpeta, junto a server.js. No lo pongas dentro de public. Conserva las mismas credenciales de Supabase para seguir utilizando tus cuentas y vehículos.
5. En Supabase, abre el proyecto que corresponde a SUPABASE_URL → SQL Editor → nueva consulta. Copia TODO el contenido de **supabase/migrations/002_feedback.sql** y pulsa Run. “Success. No rows returned” significa que se ejecutó correctamente.
6. Si ya aplicaste 001_freemium.sql, no necesitas repetirla. Si partes con una base vacía, ejecuta primero 001_freemium.sql y después 002_feedback.sql.
7. En la terminal de VS Code, ubicada en la nueva carpeta, ejecuta:

```powershell
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd start
```

8. Abre **http://localhost:3000**. Si usas otro PORT, reemplaza 3000 por ese número. No abras index.html con doble clic ni mediante Live Server.
9. Si aparece el diseño anterior, recarga con Ctrl + F5.

No hace falta pegar fragmentos HTML. Los archivos index.html, styles.css y app.js ya están conectados entre sí y deben usarse juntos. Guardar vehículo aparece debajo del reporte de IA. También permite guardar sin IA a las cuentas gratuitas.

## 2. Si todavía no tienes .env

Duplica .env.example y llama a la copia **.env** (no .env.txt). Para el acceso y los vehículos, completa SUPABASE_URL y SUPABASE_ANON_KEY del mismo proyecto donde ejecutaste el SQL. Usa la clave pública anon compatible con tu configuración existente.

Para IA necesitas GEMINI_API_KEY, disponible para el servidor. GEMINI_MODEL es opcional y por defecto usa gemini-3.8-flash; puedes indicar otro modelo disponible en tu proyecto Google. La clave no se envía al navegador.

Las variables de Mercado Pago y SUPABASE_SERVICE_ROLE_KEY son necesarias para el flujo de cobro existente. Si no lo configuraste, **deja vacíos** MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PLAN_ID y MERCADOPAGO_WEBHOOK_SECRET. No dejes textos de ejemplo como si fueran credenciales. La interfaz mostrará que los pagos todavía no están habilitados. Puedes conservar una cuenta Premium de prueba ya activada en tu base de datos.

El precio y la periodicidad reales pertenecen al plan configurado en Mercado Pago; la página no inventa un precio. PREMIUM_PRICE_CLP se utiliza al crear un plan mediante el script existente, no modifica automáticamente planes ya creados.

## 3. Qué incluye el rediseño

- Portada con fotografía de automóvil, títulos grandes y llamadas a crear el garage.
- Gris claro, acero, zonas oscuras de contraste y fibra de carbono sutil.
- Beneficios de la aplicación, comparación Free/Premium, explicación de Gemini y preguntas frecuentes.
- Registro e inicio de sesión en un panel, contraseña visible/oculta, mensajes y estados de carga.
- Catálogo original de autos y motos; modelos Premium identificados.
- Garage con editor y reporte; el botón de guardar queda debajo del resultado.
- Ejemplo interactivo de las tres partes del reporte (claramente identificado como ejemplo).
- Menú móvil, formularios adaptables, navegación por teclado y opción de reducir movimiento.
- Feedback y solicitudes almacenados en Supabase, con consentimiento y referencia de envío.

La IA utiliza marca, modelo, tipo, año, kilometraje y síntomas. No accede a sensores ni confirma averías. El reporte se muestra durante la sesión; esta versión guarda los datos del vehículo, no el texto de la IA. Al modificar el vehículo se descarta el reporte anterior para no mezclar información.

## 4. Dónde llegan las solicitudes

El formulario solicita iniciar sesión y conserva el borrador mientras el usuario entra. Los mensajes quedan en **Supabase → Table Editor → feedback**. No se envían correos automáticamente ni existe un panel de administración adicional.

Columnas principales:

| Columna | Contenido |
| --- | --- |
| id | Referencia que ve el usuario al enviar |
| contact_email | Correo de la cuenta autenticada |
| category | suggestion, bug, vehicle_request u other |
| subject / message | Asunto y mensaje |
| status | new, reviewed o closed; lo cambia el administrador |
| created_at | Fecha de recepción |

Puedes consultarlos en SQL Editor:

```sql
select id, created_at, contact_email, category, subject, message, status
from public.feedback
order by created_at desc;
```

La tabla no es legible por usuarios comunes. La función submit_feedback toma la identidad de Supabase Auth y permite hasta cinco envíos por usuario en diez minutos. El límite se guarda en la base y sigue funcionando al reiniciar Node. Al eliminar una cuenta en Supabase Auth también se elimina su feedback, por la relación ON DELETE CASCADE.

## 5. Archivos que cambian

| Archivo | Para qué sirve |
| --- | --- |
| public/index.html | Todas las secciones y formularios |
| public/styles.css | Colores, composición, texturas y adaptación móvil |
| public/app.js | Acceso, garage, IA, navegación, pagos y feedback |
| public/vehicles.js | Catálogo separado del código de interfaz |
| public/assets/ | Fotografías, favicon y cliente Supabase local |
| server.js | Añade feedback y anuncia si el cobro está configurado |
| src/feedback.js | Valida solicitudes y traduce errores del formulario |
| supabase/migrations/002_feedback.sql | Tabla privada, función de envío y límite de solicitudes |
| tests/api.test.js | Pruebas del servidor con servicios simulados |

Los permisos Free/Premium se siguen comprobando en el servidor y la base de datos. Cambiar el texto de una etiqueta o un botón en el navegador no concede Premium.

## 6. Personalizar el diseño

- Textos y secciones: public/index.html.
- Paleta: variables al principio de public/styles.css.
- Fotografías: reemplaza road.jpg e interior.jpg en public/assets manteniendo los nombres, o cambia src en HTML. Incluye los créditos de tus nuevas imágenes si corresponde.
- Modelos especiales: conserva sincronizados public/premium-vehicles.json y la tabla premium_vehicle_catalog de Supabase, como en el proyecto anterior.
- Logo: cambia la marca de texto en encabezado y pie, y assets/favicon.svg.

## 7. Verificación realizada y límites

Se comprobaron la sintaxis de JavaScript, ocho pruebas de servidor con servicios externos simulados y la migración de feedback en PostgreSQL embebido, incluyendo permisos, identidad y límite de envíos. Se realizaron pruebas de interfaz en Chromium a tamaños de escritorio y móvil.

Las pruebas no usan tu proyecto Supabase, no generan cobros ni consumen tu clave Gemini. Después de instalar, verifica con tu cuenta real: iniciar sesión, guardar un vehículo, consultar IA con Premium y enviar una solicitud que aparezca en feedback. El checkout real requiere las credenciales y el webhook de Mercado Pago de tu despliegue.

La guía GUIA_FREEMIUM.md se conserva como referencia del backend original. Para instalar esta interfaz, sigue primero este archivo.
