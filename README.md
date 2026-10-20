# Garage Premium Moderno

Aplicación de mantenciones para autos y motos en Chile. Servidor Node/Express,
cuentas y vehículos en Supabase, orientación Premium con Gemini y suscripciones
mediante Mercado Pago.

Para instalarla y preparar la base, lee [00_EMPEZAR_AQUI.md](00_EMPEZAR_AQUI.md).
Para publicarla, lee [PUBLICAR_EN_RENDER.md](PUBLICAR_EN_RENDER.md).
El acceso social está explicado en [CONFIGURAR_ACCESO_SOCIAL.md](CONFIGURAR_ACCESO_SOCIAL.md).

Las credenciales se configuran por separado. No se incluyen en este repositorio.
Las pruebas automáticas simulan los servicios externos; su resultado no acredita
un inicio de sesión, pago o reporte real con tus cuentas.

## Hito 2 · API y persistencia

El backend ofrece CRUD REST de dos recursos: `vehicles` y `maintenance-records`.
El contrato completo, los cuerpos de ejemplo y los códigos HTTP están en
[docs/hito2/API.md](docs/hito2/API.md). Controladores, servicios y repositorios
viven en `src/controllers`, `src/services` y `src/repositories`, respectivamente.

Para iniciar en otro equipo:

1. Instalar Node.js y ejecutar `npm ci` desde esta carpeta.
2. Crear un proyecto Supabase y ejecutar [db/crear_desde_cero.sql](db/crear_desde_cero.sql)
   en su SQL Editor. Si el proyecto ya tenía las migraciones 001–003, ejecutar
   únicamente `supabase/migrations/004_maintenance_records.sql`.
3. Copiar `.env.example` a `.env` y reemplazar los valores de ejemplo por las
   claves del proyecto. `.env` está excluido de Git. No activar Mercado Pago
   para demostrar el CRUD.
4. Ejecutar `npm start`; comprobar `GET http://localhost:3000/api/health`.
5. Importar [docs/hito2/Garage-Hito2.postman_collection.json](docs/hito2/Garage-Hito2.postman_collection.json)
   en Postman. Completar sus variables privadas y ejecutar la autenticación y
   las solicitudes CRUD en orden.

El cliente de pruebas no contiene contraseñas ni tokens reales. Para repetir
las pruebas automáticas, ejecutar `npm test`; estas usan respuestas simuladas
de Supabase y no sustituyen la demostración en vivo contra la base real.
