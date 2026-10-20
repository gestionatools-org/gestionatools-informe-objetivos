# Informe de objetivos — GestionaTools

Aplicación Next.js para generar informes de objetivos 2026 en el navegador.
Acceso mediante Hub SSO v2 y alta manual en `iobjetivos.app_users`.
No se guardan informes en Supabase. El PDF y los borradores JSON se generan en cliente.

## Instalación y comandos

Node.js 22 LTS o superior y pnpm 10.18.3 (declarado en `packageManager`).
Los paquetes `@gestionatools-org/ui` y `@gestionatools-org/hub-sso-core` requieren
un `GITHUB_TOKEN` con `read:packages` exportado en la terminal/CI/Vercel.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:smoke
corepack pnpm exec playwright install chromium
corepack pnpm test:browser
corepack pnpm start
```

`test` comprueba sesión, permisos, validación, borradores y migración/reversión en
PostgreSQL embebido (PGlite). `test:smoke` requiere un build previo: levanta Next y un
servidor Supabase simulado en puertos locales temporales. Ninguna prueba usa Supabase remoto.
`test:browser` amplía el smoke con Chromium: recuperación tras recarga, plazos/observaciones,
PDF/JSON, caducidad sin perder el formulario, pestañas independientes, edición CRUD y
almacenamiento bloqueado. Requiere las bibliotecas de Chromium en el host (Playwright
ofrece `corepack pnpm exec playwright install-deps chromium`) y el navegador instalado.
`IOBJETIVOS_TEST_CHROMIUM` permite indicar un ejecutable Chromium existente.

La prueba de navegador verifica que Chromium dibuja el título con la fuente Geist
descargada, que los controles heredan la misma familia, que el contenido se alinea con
el shell y que la página no se desborda horizontalmente en escritorio/móvil y claro/oscuro.
Para guardar las ocho capturas de revisión en un directorio local:

```bash
IOBJETIVOS_SCREENSHOT_DIR=/tmp/iobjetivos-ui-review corepack pnpm test:browser
```

El shell aporta el fondo y los márgenes generales; ambas pantallas usan los tokens del
paquete corporativo sin sobrescribir sus radios o familias. Next Font sirve Geist y
Geist Mono desde la aplicación y declara sus variables en `html`. El ajuste no cambia
las fuentes del PDF.

## Variables de entorno

Crea `.env.local` con estos nombres (valores de ejemplo, nunca credenciales versionadas):

```dotenv
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_SERVER_KEY
HUB_BASE_URL=https://gestionatools.espublico.com
HUB_APP_ID=REPLACE_WITH_HUB_APP_ID
HUB_SSO_PUBLIC_KEY=REPLACE_WITH_PEM_PUBLIC_KEY
HUB_SSO_ISSUER=https://gestionatools.espublico.com
APP_BASE_URL=http://localhost:3000
APP_SESSION_SECRET=REPLACE_WITH_RANDOM_SECRET
```

`HUB_SSO_PUBLIC_KEY` admite PEM con saltos de línea escapados como `\n`.
`SUPABASE_URL` admite `NEXT_PUBLIC_SUPABASE_URL` como alternativa por compatibilidad.
La antigua clave pública ya no se utiliza. No usar `NEXT_PUBLIC_` para claves de servicio,
sesión ni configuración Hub. `GITHUB_TOKEN` debe estar en el entorno de instalación;
pnpm no lee `.env.local` para instalar. La app nunca necesita la clave privada del Hub.

## Datos y autorización

Las seis tablas y la vista `informeobjetivos_*` residen en `iobjetivos`, manteniendo nombres.
El navegador consume Server Actions autorizadas; cada acción consulta el estado del
usuario Hub y su rol local y comprueba que la cuenta coincide con la que abrió la pestaña.
Las mutaciones exigen rol local `admin`. RLS sigue habilitado y las claves
`anon`/`authenticated` no tienen acceso directo. La service role solo se usa en servidor.

`iobjetivos.app_users.hub_user_id` referencia **`public.usuarios_gtools.id`**, que coincide
con `sub` del token Hub; no referencia `auth.users.id`. El alta es manual. `user` genera
informes; `admin` además conserva el CRUD actual. El rol global no concede permisos locales.

## SSO y protección del trabajo

Se mantiene `/sso?token=...`, verificación Ed25519 del token v2, issuer, audience y `app_id`.
La cookie local firmada `hub_app_session` dura 8 horas absolutas desde la entrada;
no se renueva por actividad. Las cookies anteriores mantienen su vencimiento original.
`/logout` borra solo esta sesión y devuelve a `HUB_BASE_URL`, sin iniciar otro intercambio SSO.

El generador y el formulario CRUD guardan borradores locales a los 500 ms y al salir.
Se separan por usuario y por instancia de pestaña, caducan a las 24 horas y requieren
recuperación explícita. Recuperar una edición no la guarda en servidor. El logout conserva
los borradores con confirmación; los de otra cuenta no se muestran. El navegador puede
borrar su almacenamiento: mantener la copia JSON descargada si se necesita conservarla.
Los errores de almacenamiento se muestran en pantalla y bloquean logout/reautenticación desde la app hasta conservar o descartar los cambios. La sesión se comprueba cada
30 segundos y al recuperar foco; se avisa cinco minutos antes de caducar y se ofrece
reautenticación sin abandonar automáticamente el formulario.

## Migración y despliegue

Seguir [la guía por etapas](docs/schema-rollout.md). Coordinar cambio de esquema y despliegue:
esta versión necesita `iobjetivos` y la anterior consulta `public`.
No ejecutar de nuevo el seed ni aplicar SQL remoto automáticamente.

Las versiones transitivas de `nanoid` y `source-map-js` usadas por PostCSS se fijan mediante
`pnpm.overrides` a sus versiones corregidas. Mantener estos overrides hasta que el árbol
resuelto de Next incorpore las correcciones sin ellos.
