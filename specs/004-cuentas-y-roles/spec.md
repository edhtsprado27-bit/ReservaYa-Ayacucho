# 004 · Cuentas, login 3D y roles

> **Estado:** implementado y probado · **Fecha:** 18/11/2026

## 1. Historias de usuario

- **Jugador:** quiero crear mi cuenta e iniciar sesión para reservar canchas (las reservas llegan en el paso 5).
- **Dueño:** quiero crear una cuenta de dueño y registrar mis canchas, que quedan a mi nombre.
- **Administrador:** quiero aprobar o rechazar las canchas antes de que aparezcan en el mapa, sin usar SQL.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | Login con el diseño 3D aprobado (estadio nocturno + futbolista), en `/login`. |
| RF-2 | Crear cuenta con nombre, correo, celular opcional y contraseña (mín. 8); elegir **jugador** o **dueño**. |
| RF-3 | Recuperar contraseña por correo y crear una nueva en `/nueva-clave`. |
| RF-4 | Nadie puede registrarse como admin: el rol admin solo se asigna con SQL. |
| RF-5 | Cabecera con "Ingresar" o el nombre y rol de la cuenta; `/mi-cuenta` con datos y "Cerrar sesión". |
| RF-6 | `/mi-cuenta`, `/dueno`, `/admin` y `/nueva-clave` exigen sesión; `/dueno` exige dueño o admin; `/admin` exige admin. |
| RF-7 | "+ Agregar cancha" solo para dueño o admin. La cancha de un dueño queda a su nombre; la del admin, "sin dueño asignado". |
| RF-8 | El admin aprueba o rechaza (con motivo) en `/admin`. |
| RNF-1 | Sesión en cookies con `@supabase/ssr`; `src/proxy.ts` (Next.js 16) la renueva en cada visita. |
| RNF-2 | La base de datos valida el rol en cada operación (`auth.uid()`), no solo la pantalla. |
| RNF-3 | El estadio 3D se carga aparte (import dinámico de three.js) y no afecta al resto de la web. |
| RNF-4 | Funciona con `cacheComponents` activado o no: lo que depende de la sesión va dentro de `<Suspense>`. |

## 3. Plan técnico

```
Navegador ──(cookies de sesión)──▶ src/proxy.ts ──▶ renueva la sesión / protege rutas privadas
   │
   ├─ /login (LoginEstadio + estadio3d)  ──▶ Supabase Auth (signIn, signUp, resetPassword)
   ├─ /auth/callback                      ──▶ canjea el código del correo por una sesión
   └─ páginas y /api con sesión           ──▶ RPC en PostgreSQL con auth.uid()
                                               fn_mi_perfil · fn_proponer_local · fn_mis_pendientes
                                               fn_retirar_propuesta · fn_revisar_local
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/006_auth_roles.sql` | Perfil automático al registrarse, RLS del perfil, permisos por rol, aprobar/rechazar |
| `apps/web/src/proxy.ts`, `src/lib/auth/*` | Clientes Supabase (navegador/servidor), sesión, perfil, roles |
| `apps/web/src/components/login/*` | Login 3D (three.js) y formularios |
| `apps/web/src/app/{login,auth/callback,nueva-clave,mi-cuenta,dueno,admin}` | Páginas de cuenta |
| `apps/web/src/app/api/canchas/mias`, `api/admin/locales/[id]` | Canchas en revisión y revisión del admin |

## 4. Criterios de aceptación (probados)

| # | Caso | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | Registro como jugador / dueño | Perfil con rol `player` / `owner` | ✔ |
| 2 | Registro pidiendo `rol: admin` | Queda como `player` | ✔ |
| 3 | Celular o correo ya usados por otro perfil | Se crea sin ese dato, nunca se une a otra cuenta | ✔ |
| 4 | Visitante llama a registrar/aprobar | 401 "Inicia sesión para continuar" | ✔ |
| 5 | Jugador registra cancha | `SOLO_DUENOS` (403) | ✔ |
| 6 | Dueño registra; otro dueño intenta quitarla | Queda a nombre del dueño; el otro no la ve ni la quita | ✔ |
| 7 | Admin ve todas en revisión, aprueba una y rechaza otra con motivo | Aprobada aparece en el mapa; rechazada guarda el motivo | ✔ |
| 8 | Perfil que no se creó al registrarse | Se crea al entrar (`fn_mi_perfil`) | ✔ |
| 9 | Abrir `/mi-cuenta`, `/dueno`, `/admin` sin sesión | Redirige a `/login?next=...` | ✔ |
| 10 | Formulario: correo vacío, clave incorrecta, celular inválido, registro con confirmación, recuperar, enlace vencido | Mensajes claros en español | ✔ |
| 11 | Login 3D en PC (1366×768) y celular (390×844) | Mismo diseño que el aprobado; el registro entra sin desplazarse en PC | ✔ |
| 12 | Compilar con `cacheComponents` activado y desactivado | Compila en ambos | ✔ |

## 5. Tareas

- [x] Migración `006_auth_roles.sql`
- [x] Login 3D en Next.js con Supabase Auth
- [x] Sesión con `proxy.ts`, cabecera, `/mi-cuenta`, `/dueno`, `/admin`
- [x] "+ Agregar cancha" solo para dueño/admin; aprobación desde `/admin`
- [ ] Configurar Supabase Auth (URL Configuration y Confirm email) y crear la cuenta admin
- [ ] Antes de producción: SMTP propio y volver a activar "Confirm email"
