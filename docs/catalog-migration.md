# Migración del catálogo antiguo

El catálogo inicial procede de `old/seed.js` (seed version 7) y se carga mediante
la migración `20260729000001_seed_catalog.sql`.

Los IDs antiguos (`c1`, `i1`, `m1`, `s1`, `w1`, etc.) se conservan en `legacy_id`.
Las relaciones internas usan UUID para mantener el modelo relacional de Supabase.
Las traducciones se conservan en columnas JSONB y la interfaz actual continúa
mostrando español.

El traslado posterior a `iobjetivos` mantiene tablas, UUID y datos. La migración
`20261020000000_move_catalog_to_iobjetivos.sql` mantiene RLS y restringe acceso a servidor.
Las altas locales son manuales en `iobjetivos.app_users`. Seguir `docs/schema-rollout.md`;
no repetir el seed sobre una instalación existente.
