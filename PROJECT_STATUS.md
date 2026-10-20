# PROJECT_STATUS

## Estado — 2026-10-20

Implementados localmente el traslado a `iobjetivos`, los roles propios vinculados al Hub,
la UI corporativa y la protección del trabajo. **Traslado remoto validado mediante los
resultados SQL aportados por el usuario; despliegue de la nueva aplicación pendiente.**

## Implementado

- Migración transaccional por `SET SCHEMA`, sin copiar datos ni repetir el seed.
- `iobjetivos.app_users`, FK a `public.usuarios_gtools.id`, roles `user/admin`, altas manuales.
- Server Actions con control de sesión, cuenta, estado Hub y rol local; Supabase exclusivo del servidor.
- RLS habilitado, grants anon/authenticated revocados; CRUD restringido a admin local.
- Next 16.4.1, React 19, Tailwind 4 y shell/estilos de `@gestionatools-org/ui`.
- Hub SSO v2 conservado, cookie local de 8 horas y logout a `HUB_BASE_URL`.
- Borradores locales recuperables de informe y CRUD; PDF exclusivamente cliente.
- Pruebas de sesión, permisos, validación, borradores y migración/reversión en PostgreSQL embebido.
- Smoke de rutas de producción con Supabase simulado y pruebas Chromium de recuperación,
  descarga PDF/JSON, caducidad, pestañas independientes y almacenamiento bloqueado.
- Overrides para dos dependencias transitivas corregidas; audit de producción sin avisos conocidos.

## Rollout remoto

- Backup JSON local revisado: seis tablas, UUID únicos y relaciones válidas; incluye
  definición de vista, opciones y permisos. Archivo excluido de Git.
- SQL remoto aportado por el usuario confirma los siete objetos en `iobjetivos` con
  los OID originales: 5 comisiones, 7 instrucciones, 11 materias, 43 submaterias,
  7 líneas, 185 objetivos y 185 filas en la vista.
- `app_users` tiene la estructura prevista; vista con `security_invoker=true`.
- Sin USAGE/SELECT/INSERT/UPDATE/DELETE efectivos para anon/authenticated en el catálogo.
- Alta manual de un administrador local, vinculado a un usuario activo del Hub, validada por SQL.
- El usuario confirma exposición de `iobjetivos` en Data API y variables de producción configuradas.
- Comprobación HTTP anónima de `https://gestionatools-informe-objetivos.vercel.app/`:
  tanto `/` como `/api/session` responden 307 hacia el Hub, comportamiento de la versión anterior.

## Pendiente para completar el rollout

Publicar los cambios y desplegar la nueva aplicación según `docs/schema-rollout.md`.
Verificar `/api/session` sin sesión (401), configuración real de PostgREST y entrada
SSO, lecturas, CRUD, PDF, borradores y logout con usuarios reales. La configuración
de variables y exposición está confirmada por el usuario, todavía sin validación
del runtime de la nueva versión en producción.

## Decisiones

El acceso Hub sustituye la vista pública original por decisión expresa. Los roles locales
no heredan el rol global y no se crean automáticamente. La app no usa Supabase Auth para
login ni emite JWT Supabase. Nuevas funciones admin se desarrollarán más adelante.
