# Hito 2 · guía de cumplimiento

## 1. Qué se pide

El servidor debe exponer una API REST funcional, con **dos recursos del dominio** y operaciones de crear, leer, actualizar y borrar; persistencia en un motor real; estados HTTP correctos; credenciales fuera del repositorio; y capas con responsabilidades efectivamente separadas. También se debe defender la elección de lenguaje, framework y arquitectura con ventajas, costos y alternativa. En este proyecto los recursos son `vehicles` y `maintenance-records`, persistidos en PostgreSQL/Supabase.

## 2. Paso a paso

1. Contrato: `docs/hito2/API.md` define rutas, verbos, cuerpos y estados.
2. Datos: `db/modelo-datos.png` y `db/crear_desde_cero.sql` documentan entidades y creación; la migración incremental es `supabase/migrations/004_maintenance_records.sql`.
3. Capas: `src/controllers/`, `src/services/` y `src/repositories/` contienen las responsabilidades descritas en el informe.
4. Primer recurso: `vehicles` tiene POST, GET lista, GET por ID, PUT y DELETE.
5. Credenciales: `.env.example` contiene ejemplos; `.env` y `node_modules` están excluidos de Git.
6. Segundo recurso: `maintenance-records` tiene el mismo CRUD, valida propietario y responde 400/401/404/503 cuando corresponde.
7. Decisión: sección 8 del informe defiende el monolito modular frente a microservicios con un escenario de revisión.
8. Cambios: sección 2 del informe relaciona explícitamente Hito 1 y Hito 2.
9. Demostración: `Garage-Hito2.postman_collection.json` conserva peticiones y variables para ejecutarlas en orden.
10. Ensayo: `DEMO_7_MINUTOS.md` asigna tiempos y partes a Joel y Joaquín.

## 3. Entregables

| Entregable | Ubicación |
|---|---|
| Código del servicio | Rama `main`, `server.js` y `src/` |
| Documento técnico de 12 páginas | `docs/hito2/Informe-Tecnico-Hito2.pdf` |
| Tabla de la interfaz | Informe, secciones 3 y 4; `docs/hito2/API.md` |
| Modelo y script de creación | `db/modelo-datos.png`, `db/modelo-datos.mmd`, `db/crear_desde_cero.sql` |
| Colección del cliente de pruebas | `docs/hito2/Garage-Hito2.postman_collection.json` |
| Configuración de ejemplo | `.env.example` en la raíz |
| Presentación | Ocho láminas PPTX y PDF entregadas junto al ZIP de trabajo |

## 4. Cómo se evalúa

La pauta da **50 puntos a la presentación** y **50 al documento técnico**. Su peso indicado para el Hito 2 es 35 % de la nota parcial N2.

| Criterio | Puntos | Evidencia o acción |
|---|---:|---|
| A1 · API en vivo | 15 | Ejecutar POST, GET, PUT y DELETE guardados en Postman con cuenta real. **Pendiente de ejecutar en sala.** |
| A2 · Tecnologías | 12 | Informe, sección 8; lámina 7. |
| A3 · Monolito o distribuido | 8 | Informe, sección 8; lámina 7. |
| A4 · Claridad y tiempo | 5 | Guion cronometrado de siete minutos. |
| A5 · Respuesta de integrante elegido | 10 | Ambos estudian la lista de seis preguntas del guion. |
| B1 · Trazabilidad Hito 1 | 8 | Informe, sección 2. |
| B2 · API REST | 14 | Informe, secciones 3 y 4; contrato `API.md`. |
| B3 · Capas | 12 | Informe, sección 5; tres carpetas con funciones distintas. |
| B4 · Datos y credenciales | 10 | Informe, secciones 6 y 7; SQL, RLS, `.env.example`. |
| B5 · Referencias | 6 | Informe, sección 11, con fuentes técnicas oficiales. |

## 5. Errores que cuestan puntos

- **Programar antes del contrato:** la tabla de rutas se conserva en `API.md` y en el informe; revisar ambos antes de cambios.
- **Devolver 200 para todo:** las pruebas comprueban 201/200/204 y 400/401/404/503.
- **Capas cosméticas:** mostrar una regla real del servicio y una consulta real del repositorio.
- **Credenciales en Git:** no subir `.env`, contraseñas, tokens de Postman ni claves del servidor. Rotar cualquier clave que se filtre.
- **Video en vez de ejecución:** el profesor debe ver solicitudes reales al servicio en funcionamiento; las capturas son solo apoyo.
- **Tecnologías por moda:** explicar por qué el stack reduce trabajo para dos personas, qué costo acepta y cuándo reconsiderar el monolito.

**Estado honesto:** el código y la base fueron comprobados; 38 pruebas automáticas pasan y Render está activo. La colección con una cuenta autenticada debe ensayarse y ejecutarse delante del profesor. Las pruebas automatizadas usan Supabase simulado.
