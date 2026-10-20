# Contrato REST · Hito 2

Base: `http://localhost:3000` en desarrollo. En producción se reemplaza por la URL pública de Render. Todas las rutas de los dos recursos requieren `Authorization: Bearer <access_token>` de Supabase Auth. `POST` y `PUT` requieren `Content-Type: application/json`. El servidor toma `user_id` del token; ignora cualquier `user_id` enviado por el cliente.

## Vehículos

| Ruta | Verbo | Parámetros y cuerpo | Éxito | Errores principales |
|---|---|---|---|---|
| `/api/vehicles` | GET | Ninguno | `200 {"vehicles":[...]}` | `401` sin sesión; `503` si la base no responde |
| `/api/vehicles/:id` | GET | `id`: UUID en URL | `200 {"vehicle":{...}}` | `400` id inválido; `401`; `404` inexistente o ajeno |
| `/api/vehicles` | POST | Objeto completo de vehículo | `201 {"vehicle":{...}}`, `Location: /api/vehicles/:id` | `400` datos inválidos; `401`; `403` límite Free o modelo Premium |
| `/api/vehicles/:id` | PUT | `id` y objeto completo; reemplaza los cinco campos editables | `200 {"vehicle":{...}}` | `400`; `401`; `403` plan; `404` inexistente o ajeno |
| `/api/vehicles/:id` | DELETE | `id` | `204` sin cuerpo | `400`; `401`; `404` inexistente o ajeno |

Ejemplo de cuerpo para `POST` y `PUT`:

```json
{"type":"Moto","brand":"Bajaj","model":"Pulsar RS200","year":2020,"mileage":10000}
```

`type` es `Auto` o `Moto`; marca, modelo y año deben corresponder al catálogo. `mileage` acepta entero de 0 a 999999 o una cadena chilena como `"10.000"`. Borrar un vehículo borra por cascada sus registros de mantención.

## Registros de mantención

| Ruta | Verbo | Parámetros y cuerpo | Éxito | Errores principales |
|---|---|---|---|---|
| `/api/maintenance-records` | GET | Opcional `?vehicle_id=<uuid>` | `200 {"records":[...]}` | `400` filtro inválido; `401`; `503` migración pendiente |
| `/api/maintenance-records/:id` | GET | `id` en URL | `200 {"record":{...}}` | `400`; `401`; `404` inexistente o ajeno |
| `/api/maintenance-records` | POST | Objeto completo de registro | `201 {"record":{...}}`, `Location: /api/maintenance-records/:id` | `400` datos inválidos; `401`; `404` vehículo inexistente o ajeno |
| `/api/maintenance-records/:id` | PUT | `id` y objeto completo | `200 {"record":{...}}` | `400`; `401`; `404` registro o vehículo ajeno |
| `/api/maintenance-records/:id` | DELETE | `id` | `204` sin cuerpo | `400`; `401`; `404` inexistente o ajeno |

Ejemplo de cuerpo para `POST` y `PUT`:

```json
{"vehicle_id":"11111111-1111-4111-8111-111111111111","category":"service","performed_on":"2026-08-10","mileage":10000,"notes":"Cambio de aceite y revisión general."}
```

`category` admite `inspection`, `service` o `repair`; `performed_on` es fecha `AAAA-MM-DD` válida y no futura en Chile. `mileage` admite 0–999999. `notes` tiene de 5 a 1000 caracteres. `vehicle_id` debe pertenecer al usuario autenticado. La clave foránea `(vehicle_id, user_id)` vuelve a comprobarlo en PostgreSQL.

## Contratos comunes

Los errores tienen forma `{"error":"Mensaje legible","code":"codigo_estable"}`. Por ejemplo:

```json
{"error":"No se encontró el registro de mantención.","code":"maintenance_not_found"}
```

`400` indica contrato o identificador inválido; `401` indica sesión ausente o vencida; `403` deniega una función según plan; `404` oculta recursos inexistentes o ajenos; `429` limita envíos de Hablemos; `503` indica dependencia o migración no disponible. Un fallo nunca se devuelve como `200`.

Rutas complementarias ya existentes: `GET /api/health`, `GET /api/public-config`, `GET /api/account`, `POST /api/feedback`, `POST /api/analizar-vehiculo`, `POST /api/subscription/checkout`, `POST /api/subscription/sync` y `POST /api/webhooks/mercadopago`. El pago sigue sin configuración en la web pública; esas rutas no forman parte de las cuatro solicitudes demostrativas del hito.
