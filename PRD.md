# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Project Overview
Aplicación web para la gestión y generación de informes estandarizados en formato PDF.
El sistema permite a los **Administradores** configurar un catálogo de ítems jerarquizados (Comisiones, Instrucciones, Materias, etc.) y permite a **Usuarios con sesión Hub y alta local** generar archivos PDF seleccionando estos ítems e introduciendo metadatos de gestión (Entidad, Gestor, Plazo).

## 2. User Roles

### A. Administrador (Auth Required)
- **Acceso:** SSO central del Hub GestionaTools con token Hub SSO v2 Ed25519 verificado en servidor y sesión local firmada de 8 horas.
- **Permisos:**
  - Crear, Leer, Actualizar y Borrar (CRUD) los Ítems de Configuración.
  - Gestionar la jerarquía de datos.

### B. Usuario General (rol local user)
- **Acceso:** Mediante Hub SSO y alta manual en `iobjetivos.app_users`.
- **Permisos:**
  - Visualizar (Leer) los ítems configurados.
  - Filtrar ítems por jerarquía.
  - Generar y descargar el archivo PDF final.
  - **Restricción:** No puede modificar la base de datos, solo leer para construir su archivo local.

## 3. Core Features (MVP)

### 3.1. Panel de Administración (Protected)
- **Tabla de Gestión:** Interfaz (shadcn/ui Data Table) para visualizar todos los ítems.
- **Formulario de Ítem:**
  - Campos: Comisión, Instrucción, Materia, Submateria, Línea de Trabajo, Objetivo, Estado, Año, Código heredado.
  - Validaciones: Zod (campos requeridos).

### 3.2. Generador de Informes (Hub SSO)
- **Entrada de Datos de Cabecera:**
  - Entidad (Texto).
  - Gestor (Texto).

- **Selector de Ítems:**
  - Seleccion en cascada: primero se selecciona instruction, de ahi derivan las work_line y de las work_line derivan los item_objective.
  - La tabla de items disponibles tiene boton "Añadir"; al añadir un item desaparece de la lista para evitar duplicados.
  - Debajo se muestra la tabla de items seleccionados con boton "Quitar".
  - Cada item_objective seleccionado debe tener un Plazo (Primer trimestre, Segundo trimestre, Tercer trimestre, Cuarto trimestre, Ano completo).
  - Los item_objective se van acumulando en el informe, para luego exportarse.
- **Borradores locales (client-side):**
  - Exportar el estado del informe a JSON local (sin persistencia en BBDD).
  - Importar un borrador JSON para continuar editando.
- **Motor de Exportación:**
  - Generación de PDF en el cliente (Client-side).
  - El PDF mantiene la agrupacion por instruccion e incluye observaciones y plazo.

## 4. Database Schema (Supabase)

Catálogo en esquema `iobjetivos`, conservando nombres de tablas y vista existentes.
`iobjetivos.app_users (hub_user_id PK/FK public.usuarios_gtools.id, role user|admin, created_at)`
se provisiona manualmente. La identidad SSO `sub` referencia al usuario del Hub, no a Auth.
El rol global no determina el local. Ambos roles generan informes; admin conserva el CRUD
actual. Las nuevas funciones administrativas quedan para una fase posterior.

### Tablas normalizadas

- `informeobjetivos_commissions` (id, name, created_at)
- `informeobjetivos_instructions` (id, commission_id, name, created_at, legacy_instruction_id optional)
- `informeobjetivos_matters` (id, instruction_id, name, created_at)
- `informeobjetivos_submatters` (id, matter_id, name, created_at)
- `informeobjetivos_work_lines` (id, code, display_name, sort_order, created_at)
- `informeobjetivos_items_objetivo` (id, instruction_id, submatter_id, work_line_id, title, status, year, legacy_item_code, created_at)

### View de lectura (plana)

- `informeobjetivos_v_items_export` con columnas para UI/PDF:
  - item_uuid, item_code, title, status, year
  - instruction_uuid, instruction, commission
  - matter, submatter
  - work_line_uuid, work_line_code, work_line

Relaciones:

1 instruccion tiene n lineas de trabajo
1 linea de trabajo tiene n items objetivo

Notas:
- El plazo no se almacena en la tabla; se selecciona al exportar.

**Seguridad y acceso a datos:**
1. RLS habilitado en las seis tablas y en `app_users`; vista con `security_invoker`.
2. Sin acceso directo `anon`/`authenticated`: sustituye la lectura pública inicial por decisión del usuario del 2026-10-20.
3. Supabase en servidor con service role, previa comprobación de cookie, estado Hub, alta y rol local.
4. Server Actions para lecturas y CRUD; escrituras exclusivamente admin local, con validación de año 2026.
5. Las operaciones comprueban que la cuenta coincide con la que abrió la pestaña.

## 5. Site Map & Routing

- `src/app/(protected)/page.tsx` -> **Vista protegida mediante Hub y alta local.** Formulario de entrada (Entidad/Gestor) + Selección de Ítems + Botón "Exportar PDF".
- `src/app/sso/route.ts` -> Entrada SSO desde el Hub (`GET /sso?token=...`).
- `src/app/logout/route.ts` -> Logout local de esta app, con redirección 303 a `HUB_BASE_URL`.
- `src/app/login/page.tsx` -> Compatibilidad: redirige al dashboard protegido.
- `src/app/(protected)/admin/dashboard/page.tsx` -> **Vista Privada.** CRUD de `informeobjetivos_items_objetivo`.

## 6. UI/UX Guidelines (shadcn/ui)

- **Input:** Formularios limpios usando `react-hook-form` + `zod`.
- **Feedback:** `Toaster` para confirmar guardado de ítems o generación de PDF.
- **Data Display:** `Table` component para el Admin Dashboard. `Card` o `Checkbox` list para la selección de ítems.
- **Icons:** Lucide React para acciones (Download, Edit, Trash, Plus).

## 7. Sesión y recuperación del trabajo

- Mantener el contrato SSO v2, issuer/audience/app_id y la ruta de entrada.
- Cookie local de 8 horas absolutas, independiente del TTL del token Hub, sin renovación por actividad.
- Logout visible al Hub; sin cerrar la sesión global del Hub.
- Borradores locales de informe y CRUD separados por usuario/pestaña, TTL de 24 horas,
  guardado automático tras 500 ms y recuperación explícita sin guardar en servidor.
- Mantener importación/exportación JSON versión 1 y PDF íntegramente cliente.
- Comprobar sesión cada 30 segundos y al recuperar foco; aviso cinco minutos antes de caducar,
  conservando el formulario y ofreciendo reautenticación.
- UI corporativa mediante `@gestionatools-org/ui` y stack Next 16/React 19/Tailwind 4.
