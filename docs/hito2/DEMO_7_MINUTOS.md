# Demostración de siete minutos · Hito 2

**Presentan:** Joel Trujillo (`JoelTrujillo2003`) y Joaquín Guajardo (`JoaquinG`).

## Antes de entrar a sala

1. Ejecutar `npm ci`, preparar `.env` a partir de `.env.example` y arrancar con `npm start`. Si se usa la web pública, abrir `https://garage-premium-moderno.onrender.com/api/health` antes de cronometrar para despertar Render.
2. Importar `Garage-Hito2.postman_collection.json`. En un entorno privado de Postman, configurar `base_url`, `supabase_url`, `supabase_publishable_key`, `email` y `password`. No exportar ese entorno ni mostrar contraseñas o tokens en el proyector.
3. Usar una cuenta de prueba con **cero vehículos o menos de dos**. La moto Bajaj Pulsar RS200 de 2020 es estándar dentro del catálogo de esta versión. Ejecutar la solicitud `00 · Iniciar sesión` y confirmar que se obtiene un token; evitar mostrar el cuerpo de esa respuesta.
4. Probar en un computador distinto las cuatro peticiones del bloque `01` en orden. La primera guarda el UUID en `vehicle_id`. La cuarta elimina ese vehículo; repetir el bloque deja la cuenta limpia.
5. Si hay tiempo, ejecutar el bloque `02` completo para demostrar el segundo recurso y el bloque `03` para un error 400 o 404. No ejecutar la opción de borrado antes de leer y actualizar.

## Guion cronometrado

| Tiempo | Quién | Acción |
|---|---|---|
| 0:00–0:20 | Joel | Nombre, problema y dos recursos. |
| 0:20–2:40 | Joaquín | Postman: POST 201 + Location, GET 200, PUT 200, DELETE 204. Confirmar el mismo UUID y el kilometraje modificado. |
| 2:40–3:20 | Joel | Explicar vehículos → mantenciones y la clave compuesta de propietario. |
| 3:20–3:50 | Joaquín | Mostrar contrato de éxito y error; ejecutar el error 400 si hay tiempo. |
| 3:50–4:45 | Joel | Abrir controlador, servicio y repositorio de mantenciones; señalar una responsabilidad concreta en cada archivo. |
| 4:45–5:25 | Joaquín | Mostrar `db/modelo-datos.png`, la migración 004 y la tabla real en Supabase. |
| 5:25–6:30 | Joel | Justificar Node/Express, PostgreSQL/Supabase y monolito modular con ventajas y costos. |
| 6:30–7:00 | Joaquín | Cambios frente al Hito 1, límites y cierre. |

## Si el profesor escoge a cualquiera

Ambos deben poder explicar: (1) cómo se valida el token; (2) por qué el controlador no consulta tablas; (3) cómo `maintenance-service.js` rechaza fecha futura o vehículo ajeno; (4) cómo `maintenance-repository.js` usa PostgREST con el JWT; (5) qué resuelve la clave foránea `(vehicle_id, user_id)` y RLS; y (6) por qué un monolito modular cuesta menos para dos personas y cuándo reconsiderarlo.

**Errores frecuentes:** 401 indica token ausente/vencido; 403 al crear el tercer vehículo Free indica límite del plan, no falla del servidor; 404 oculta un ID ajeno; 503 indica dependencia o migración no disponible. Las pruebas automatizadas usan Supabase simulado y no sustituyen esta ejecución real.
