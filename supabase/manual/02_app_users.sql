-- Manual provisioning only. Find the existing Hub ID, not auth.users.id.
select id, email, nombre, rol, status from public.usuarios_gtools order by email;

-- Replace the example UUID with a reviewed ID from the previous result.
-- INSERT INTO iobjetivos.app_users (hub_user_id, role)
-- VALUES ('REPLACE_WITH_HUB_USER_UUID'::uuid, 'user');

-- UPDATE iobjetivos.app_users SET role = 'admin'
-- WHERE hub_user_id = 'REPLACE_WITH_HUB_USER_UUID'::uuid;

-- DELETE FROM iobjetivos.app_users
-- WHERE hub_user_id = 'REPLACE_WITH_HUB_USER_UUID'::uuid;
