# Migración manual a iobjetivos

## Preparación

1. Confirmar el proyecto Supabase: debe contener el catálogo en `public` y
   `public.usuarios_gtools`, con `id` y `status` como en el Hub.
2. Ejecutar `supabase/manual/01_diagnose.sql` y conservar resultados: OID, recuentos,
   permisos, opciones de vista y policies. Revisar consumidores externos y funciones
   con esquemas escritos como texto. La migración detecta FK y vistas externas,
   pero no referencias en aplicaciones ni SQL dinámico.
3. Hacer backup de datos y DDL/permisos desde Supabase antes del cambio. Si se usa
   `pg_dump`, emplear un cliente compatible y una conexión sin contraseñas en el historial.
   Incluir las seis tablas y la vista del catálogo.
4. Preparar el despliegue con las variables del README, incluida `SUPABASE_SERVICE_ROLE_KEY`.
   Verificar que Vercel puede instalar los paquetes privados.

## Aplicación (requiere aprobación y ventana coordinada)

1. Detener temporalmente el acceso a la versión anterior y otros escritores del catálogo.
2. Aplicar **solo** `supabase/migrations/20261020000000_move_catalog_to_iobjetivos.sql`
   sobre una instalación existente. La transacción bloquea tablas, mueve objetos,
   comprueba OID/recuentos y revoca el acceso directo. Ante errores, revisar el estado;
   no omitir comprobaciones para forzar la ejecución.
3. Añadir `iobjetivos` a **Data API → Exposed schemas**. Mantener los esquemas de las demás
   apps. No copiar grants genéricos de lectura pública: esta app usa acceso de servidor.
4. Usar `supabase/manual/02_app_users.sql` para localizar identidades Hub y dar de alta
   manualmente al menos un `user` y un `admin`. Sustituir los UUID conscientemente;
   no hay herencia de rol global ni alta automática.
5. Ejecutar `supabase/manual/03_validate.sql`: comparar con el diagnóstico; no deben quedar
   objetos del catálogo en `public` ni acceso directo para `anon`/`authenticated`.
6. Desplegar esta versión. Probar con usuarios reales: entrada Hub, lectura, selección,
   PDF, borradores JSON, recuperación, CRUD admin, denegación a user y logout al Hub.
7. Comprobar que una baja local o desactivación en el Hub bloquea nuevas operaciones.
   Revisar logs Vercel y `/api/session`; no registrar tokens ni cookies.

Para una instalación vacía, aplicar primero schema y seed históricos y después la nueva
migración; `usuarios_gtools` debe existir previamente. Nunca repetir el seed en la base existente.

## Reversión

1. Activar mantenimiento y detener escritores.
2. Aplicar `supabase/manual/04_rollback.sql`: devuelve tablas y vista a `public`, preservando
   cambios posteriores al despliegue. Conserva `iobjetivos.app_users` para no perder altas.
3. Restaurar los grants y opciones de vista exactos del backup/diagnóstico y desplegar
   la versión anterior antes de reabrir acceso. El script no inventa permisos anteriores
   ni habilita lectura pública. Por sí solo **no restablece el acceso de la versión antigua**.
4. Comparar datos/recuentos y probar la versión restaurada. Mantener el esquema expuesto
   no concede acceso sin grants. No borrar el esquema mediante `CASCADE`.

Para reintentar tras una reversión, revisar la tabla `app_users` conservada y preparar
una migración de reintento: el script inicial aborta si ya existe para no sobrescribir altas.

## Frontera de validación

Las pruebas locales usan PostgreSQL embebido con el schema/seed del repo y Next de producción
con Supabase simulado. No prueban el estado de la base remota, su PostgREST, credenciales
Vercel ni las políticas del proyecto remoto. El script `test:browser` comprueba la interacción
con Chromium frente al servidor simulado. La aceptación remota sigue siendo necesaria.
