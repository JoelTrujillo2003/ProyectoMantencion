# Modelo y creación desde cero

`crear_desde_cero.sql` reconstruye el esquema de la aplicación en un **proyecto Supabase nuevo**. Parte del esquema `auth` que Supabase instala automáticamente; por eso no crea `auth.users` ni las funciones `auth.uid()`.

1. Crear un proyecto Supabase nuevo.
2. Abrir SQL Editor y ejecutar completo `crear_desde_cero.sql` una sola vez. Incluye las migraciones 001–004 en orden, los modelos del catálogo y las políticas RLS.
3. Configurar las variables de `.env.example` con los valores del proyecto, sin subir `.env`.
4. Crear una cuenta mediante la web o el cliente de pruebas y comprobar el CRUD.

En el proyecto **existente**, que ya tiene las migraciones 001–003, ejecutar únicamente `supabase/migrations/004_maintenance_records.sql`. No volver a instalar el esquema completo sobre una base en uso.

`modelo-datos.png` muestra las entidades principales, claves y relaciones. El archivo combinado se regenera con `node scripts/build-hito2-schema.mjs` si cambia una migración.
