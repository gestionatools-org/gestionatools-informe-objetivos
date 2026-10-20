# Decisiones y supuestos

## Decisiones acordadas — 2026-10-20

- Acceso exclusivamente mediante Hub, sustituyendo el generador público del PRD original.
- Catálogo y `public.usuarios_gtools` están en el mismo proyecto Supabase.
- Mover las seis tablas y la vista `informeobjetivos_*` a `iobjetivos`, conservando nombres y datos.
- `iobjetivos.app_users` referencia `usuarios_gtools.id` (claim `sub`) y tiene roles `user/admin`.
- Todas las altas y cambios de rol locales son manuales; no heredar `global_role`.
- `user` genera/exporta; `admin` conserva además el CRUD. Nuevas funciones admin quedan fuera de esta fase.
- Sesión local absoluta de 8 horas, independiente del token de intercambio SSO, sin renovación por actividad.
- Logout local a `HUB_BASE_URL`, manteniendo la sesión del Hub.
- Recuperación explícita de borradores en el navegador, sin persistir informes en base de datos.
- SQL remoto y despliegue por etapas, con aprobación explícita.

## Defaults de implementación

- Conservar `hub_app_session` y aceptar cookies antiguas hasta su vencimiento original.
- Consultar estado Hub y rol local en cada operación. Denegar si no hay alta o `status != activo`.
- Supabase exclusivamente en servidor con service role y autorización previa; la cookie Hub no es un JWT Supabase.
- Borradores por usuario/instancia de pestaña, TTL de 24 horas desde última edición, guardado tras 500 ms y al abandonar.
- Conservar borradores al cerrar sesión, con confirmación. Otra cuenta no accede a ellos.
- Comprobar sesión cada 30 segundos y al recuperar foco; avisar cinco minutos antes de caducar.
- Conservar JSON manual versión 1 y snapshots de ítems; no sustituir silenciosamente textos por cambios del catálogo.
- PDF completamente cliente, agrupación/orden y plazos por ítem conservados. Año fijo 2026.
- Identidad visual mediante `@gestionatools-org/ui@0.1.0`, sin modificar el paquete compartido.
