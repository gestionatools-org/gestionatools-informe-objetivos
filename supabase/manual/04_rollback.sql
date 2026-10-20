-- Manual rollback during maintenance, together with the previous app release.
-- Moves preserve writes made since cutover. app_users is deliberately retained.
-- Restore previous grants and view options from the saved diagnosis/backup separately.
begin;
alter view iobjetivos.informeobjetivos_v_items_export set schema public;
alter table iobjetivos.informeobjetivos_items_objetivo set schema public;
alter table iobjetivos.informeobjetivos_work_lines set schema public;
alter table iobjetivos.informeobjetivos_submatters set schema public;
alter table iobjetivos.informeobjetivos_matters set schema public;
alter table iobjetivos.informeobjetivos_instructions set schema public;
alter table iobjetivos.informeobjetivos_commissions set schema public;
notify pgrst, 'reload schema';
commit;
