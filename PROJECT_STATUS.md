# PROJECT_STATUS

## Estado — 2026-10-20

Implementados localmente el traslado a `iobjetivos`, los roles propios vinculados al Hub,
la UI corporativa y la protección del trabajo. **Traslado remoto validado mediante los
resultados SQL aportados por el usuario. La versión base `8670cdb` está desplegada;
el ajuste posterior de integración visual está pendiente de publicación.**

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
- Despliegue de `8670cdb` completado por Vercel. Comprobación HTTP pública: `/` devuelve
  307 hacia el SSO, `/api/session` devuelve 401 sin sesión y POST `/logout` devuelve 303
  al inicio del Hub, borrando la cookie local.
- El primer acceso autenticado detectó ausencia de `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
  El usuario identificó la variable pendiente; no se ha certificado desde aquí el acceso
  autenticado a datos tras su configuración.

## Ajuste de integración visual

- Variables de fuentes en `html` y sans en `body`, alineadas con Hub y Migraciones.
- Eliminados los fondos, alturas, márgenes y límites de ancho duplicados de ambas pantallas.
- Tipografía y radios heredados del paquete corporativo; títulos y espaciados unificados.
- Desplazamiento de columnas contenido dentro de los listados en pantallas pequeñas.
- Prueba Chromium ampliada con fuente realmente renderizada, alineación y ausencia de
  desbordamiento, con capturas de generador/admin en escritorio/móvil y claro/oscuro.

## Pendiente para completar el rollout

Publicar y desplegar el ajuste visual después de su revisión local, según el proceso
acordado. Completar la revisión autenticada de la configuración PostgREST, entrada SSO,
lecturas, CRUD, PDF, borradores y logout con usuarios reales. Los checks HTTP anónimos
ya están verificados; no acreditan por sí solos el acceso a datos mediante sesión real.

## Decisiones

El acceso Hub sustituye la vista pública original por decisión expresa. Los roles locales
no heredan el rol global y no se crean automáticamente. La app no usa Supabase Auth para
login ni emite JWT Supabase. Nuevas funciones admin se desarrollarán más adelante.
