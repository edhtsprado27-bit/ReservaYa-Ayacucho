# 012 · Servicios del local, gestión de usuarios y WhatsApp

> **Estado:** implementado y probado (paso 9) · **Fecha:** 21/11/2026 · **Sprint 2**  
> **Requisitos que completa:** RF01 y RF03 (servicios), RF08 (gestionar usuarios) y el nuevo **RF15** (WhatsApp)

## 1. Historias de usuario

- **Jugador:** quiero saber si el local tiene vestuarios, duchas o estacionamiento antes de ir, y buscar solo los que tengan lo que necesito.
- **Jugador:** quiero escribirle al local por WhatsApp para hacer una consulta, y que el mensaje ya diga mi código de reserva.
- **Cualquier persona:** si algo no funciona, quiero un botón de ayuda que me lleve a un chat con el equipo de ReservaYa.
- **Dueño:** quiero marcar los servicios de mi local y escribirle al jugador por WhatsApp si su pago tiene un problema.
- **Administrador:** quiero buscar cualquier cuenta, pasar a alguien de jugador a dueño (o al revés) y suspender una cuenta que hace reservas o pagos falsos, diciéndole el motivo; y escribirle por WhatsApp al dueño de un local.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | **Servicios:** lista fija de 8 (vestuarios, duchas, baños, estacionamiento, cafetería o kiosko, tribuna, iluminación nocturna, balón incluido). El dueño (o el admin) los marca en "Configurar mi local" → sección **Servicios del local**. |
| RF-2 | La ficha del local muestra sus servicios; las tarjetas del mapa también. El mapa tiene el filtro **Con:** (uno o varios servicios; muestra los locales que tienen **todos** los marcados) y "Quitar filtros". En el celular, el filtro es una fila que se desliza. |
| RF-3 | **Usuarios (admin):** `/admin/usuarios` con búsqueda por nombre (sin tildes), correo o celular y filtro Todas / Jugadores / Dueños / Administradores / Suspendidas. Cada cuenta muestra rol, estado, correo, celular, fecha de registro, último ingreso, reservas y locales. |
| RF-4 | **Cambiar rol** entre jugador y dueño. Un dueño con locales no pasa a jugador (primero se reasignan sus locales). |
| RF-5 | **Suspender** con motivo obligatorio (atajos: reservas falsas, comprobantes falsos, trato ofensivo) y **reactivar**. La cuenta suspendida no puede reservar ni usar su panel; al ingresar (o con la sesión abierta) ve `/cuenta-suspendida` con el motivo y el botón de WhatsApp de ayuda. Sus reservas y locales siguen en pie (la respuesta dice cuántos tiene). |
| RF-6 | Las cuentas de **administrador** no se cambian ni se suspenden desde aquí (tampoco la propia). |
| RF-7 | **WhatsApp (RF15):** "Escribir por WhatsApp" en la ficha; "Escribir al local" en la reserva (con código, cancha, día y hora); "WhatsApp" al jugador en los pagos por revisar; "WhatsApp al dueño" en los locales del admin; "WhatsApp" a cada cuenta en usuarios. |
| RF-8 | **Ayuda por WhatsApp:** el admin escribe el número en `/admin` → **WhatsApp de ayuda** (vacío = sin botón). Aparece un botón flotante "Ayuda" en todas las páginas, también en el aviso de local suspendido y en la cuenta suspendida. |
| RNF-1 | **Costo cero:** solo enlaces `https://wa.me/51<celular>?text=<mensaje>`. No se usa la API de WhatsApp (ADR-014). |
| RNF-2 | **Seguridad:** todo pasa por funciones `SECURITY DEFINER` (`fn_es_admin`, `fn_administra_local`). `app_settings` sin acceso directo desde la API. Una cuenta suspendida queda bloqueada en la base (`fn_usuario_actual` solo acepta cuentas activas), aunque tenga la sesión abierta. |
| RNF-3 | **Trazabilidad:** `audit_logs` guarda update_amenities, change_role, suspend, reactivate y update_settings con quién lo hizo. |
| RNF-4 | **Caché:** al guardar servicios se renuevan la ficha (`local-<slug>`) y el catálogo en memoria. El número de ayuda se lee con `"use cache"` (etiqueta `ajustes-publicos`), se renueva al guardarlo y, si Supabase falla, la web sigue funcionando sin el botón. |

## 3. Plan técnico

```
Dueño  ── ConfigLocal.tsx (Servicios del local)
   └─ PUT   /api/dueno/locales/{id}/servicios ──▶ fn_guardar_servicios ──▶ refrescarVistasPublicas(slug)
Mapa y ficha ── fn_catalogo_canchas / fn_local_publico (ahora con "servicios")
Admin  ── /admin/usuarios ── UsuariosAdmin.tsx
   ├─ GET   /api/admin/usuarios?buscar=&filtro=  ──▶ fn_usuarios_admin
   └─ PATCH /api/admin/usuarios/{id}             ──▶ fn_cambiar_rol / fn_cambiar_estado_usuario
Admin  ── /admin ── AjustesSoporte.tsx
   └─ PUT   /api/admin/ajustes                   ──▶ fn_guardar_ajustes ──▶ revalidateTag("ajustes-publicos")
Todas las páginas ── layout.tsx ── <AyudaWhatsApp/> (Suspense) ──▶ "use cache" fn_ajustes_publicos
Sesión ── perfil.ts obtenerCuenta(): { perfil, suspension } ──▶ /cuenta-suspendida
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/012_servicios_usuarios_whatsapp.sql` | Servicios, `users.status_reason`, funciones de usuarios, `app_settings`, catálogo/ficha/config/perfil/locales admin con los datos nuevos (re-ejecutable) |
| `modules/catalogo/dominio/servicios.ts` | Lista de servicios, orden y filtro del mapa |
| `modules/locales/*` | `validarServicios`, `guardarServiciosLocal`, `guardarServicios` en el repositorio y en el Decorator |
| `modules/usuarios/*` (nuevo) | Dominio (búsqueda, pedidos, fechas), casos de uso, repositorio Supabase y composición |
| `modules/soporte/*` (nuevo) | WhatsApp de ayuda: validación, casos de uso, repositorio, caché `"use cache"` y composición |
| `modules/compartido/dominio/whatsapp.ts` | `enlaceWhatsApp()` y los mensajes ya escritos (antes estaba en la agenda) |
| `modules/cuentas/infraestructura/perfil.ts` | `obtenerCuenta()`: perfil activo o suspensión con motivo |
| `app/admin/usuarios/page.tsx`, `components/admin/UsuariosAdmin.tsx` | Pantalla de usuarios |
| `components/admin/AjustesSoporte.tsx`, `components/AyudaWhatsApp.tsx`, `app/cuenta-suspendida/page.tsx` | WhatsApp de ayuda y cuenta suspendida |
| `components/BuscadorCanchas.tsx`, `app/cancha/[slug]/page.tsx`, `app/reservas/[id]/page.tsx`, `components/dueno/*`, `components/admin/LocalesAdmin.tsx` | Filtro "Con:", servicios y enlaces de WhatsApp |

## 4. Criterios de aceptación (probados)

Probados con PostgreSQL 16 (esquema real + migraciones 004 a 012), Jest y el navegador (Playwright) en computadora y celular.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Dueño guarda `["Vestuarios","duchas"," estacionamiento ","duchas",""]` | Se guarda limpio y en orden: vestuarios, duchas, estacionamiento | ✔ |
| 2 | Servicio "piscina" / otro dueño / jugador / visitante | `SERVICIO_INVALIDO` / `LOCAL_AJENO` / `LOCAL_AJENO` / permiso denegado | ✔ |
| 3 | Ficha y mapa después de guardar | La ficha y el catálogo los muestran al instante; "Con: Duchas" deja solo ese local; "Duchas + Tribuna" ninguno | ✔ |
| 4 | Admin busca "rosa", "cardenas" (sin tilde), "9876" (celular) | Encuentra a Rosa Quispe, Mario Cárdenas y Luis Gamboa | ✔ |
| 5 | Jugador → dueño → jugador; dueño con 2 locales → jugador | Cambia y avisa / `DUENO_CON_LOCALES` (y la pantalla no muestra el botón) | ✔ |
| 6 | Cambiar o suspender a un admin, rol "admin", cuenta interna de la plataforma, pedido de un dueño | `USUARIO_ES_ADMIN` / `ROL_INVALIDO` / `CUENTA_NO_ENCONTRADA` / `SOLO_ADMIN` | ✔ |
| 7 | Suspender sin motivo / con motivo / otra vez | Botón deshabilitado y `FALTA_MOTIVO` / suspendida / `CUENTA_SIN_CAMBIO` | ✔ |
| 8 | La cuenta suspendida, con su sesión abierta | `/mi-cuenta` → `/cuenta-suspendida` con el motivo; reservar → `401 SIN_SESION`; al ingresar con el formulario también llega al aviso | ✔ |
| 9 | Reactivar desde el filtro "Suspendidas" | Sale del filtro, el aviso queda arriba de la lista; la persona vuelve a Mi cuenta | ✔ |
| 10 | WhatsApp de ayuda "12345" / "966 111 222" / vacío | Error de 9 dígitos / botón "Ayuda" en mapa, ficha y login con `wa.me/51966111222` / sin botón | ✔ |
| 11 | Visitante lee `app_settings` directo | Permiso denegado (solo por `fn_ajustes_publicos`) | ✔ |
| 12 | Enlaces del local, de la reserva, del pago y del admin | `wa.me/51…` con el mensaje ya escrito (código de reserva, nombre del local o del dueño) | ✔ |
| 13 | `audit_logs` | update_amenities, change_role, suspend, reactivate, update_settings | ✔ |
| 14 | Pruebas automáticas | 303 pruebas de Jest (49 nuevas) · cobertura de líneas 99,16 % · OpenAPI con 29 operaciones · 21 pruebas E2E (5 nuevas) | ✔ |

## 5. Tareas

- [x] Migración `012_servicios_usuarios_whatsapp.sql` (probada desde cero y re-ejecutable)
- [x] Módulos `usuarios` y `soporte`; servicios en `catalogo` y `locales`; `enlaceWhatsApp` en `compartido`
- [x] 4 operaciones REST nuevas documentadas en `public/openapi.yaml`
- [x] Pantallas: servicios del local, filtro "Con:", `/admin/usuarios`, WhatsApp de ayuda, `/cuenta-suspendida`
- [x] RF15 en `docs/01-analisis-de-sistema/03-requisitos-funcionales.md` y ADR-014
- [x] Pruebas unitarias, de integración y E2E
- [ ] Avisos automáticos por correo (RF10): confirmación, rechazo, cancelación, suspensión
- [ ] Asistente con IA (RF09)
