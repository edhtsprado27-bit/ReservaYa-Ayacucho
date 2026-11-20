# 009 · Agenda del dueño: reservas del día, reservas por teléfono, cobros y bloqueos

> **Estado:** implementado y probado (parte A del paso 7 "paneles") · **Fecha:** 20/11/2026 · **Sprint 2**

## 1. Historias de usuario

- **Dueño:** quiero ver en el celular quién juega cada hora de hoy (nombre, celular, cuánto pagó y cuánto falta), para atender sin cuaderno.
- **Dueño:** quiero anotar las reservas que me piden por teléfono o en persona, para que la web no deje reservar esa misma hora a otro jugador.
- **Dueño:** quiero registrar lo que me pagan en efectivo y marcar si el equipo jugó o no vino, para saber cuánto cobré en el día.
- **Dueño:** quiero cerrar horas por mantenimiento, torneo o evento, para que nadie las reserve.
- **Dueño:** quiero cancelar una reserva con un motivo (por ejemplo, lluvia), para que el jugador sepa qué pasó.
- **Jugador:** si el local cancela mi reserva, quiero ver el motivo en mi reserva.
- **Administrador:** quiero poder ver y atender la agenda de cualquier local publicado.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | `/dueno/agenda` muestra un día (por defecto hoy, hora de Lima): elegir local (si hay más de uno), día anterior / hoy / siguiente / calendario, y una cancha a la vez. Se actualiza sola cada 60 s. |
| RF-2 | Resumen del día: reservas, total, cobrado y por cobrar (cuentan las reservas en pie y las jugadas; no las canceladas, vencidas ni las de quien no vino). Aviso con enlace si hay pagos por revisar. |
| RF-3 | Cada turno libre muestra su precio y los botones **+ Reservar** (o **Anotar** si ya empezó) y **Bloquear**. Una reserva o un bloqueo de varias horas se muestra en una sola fila. |
| RF-4 | **Reserva manual:** nombre (2 a 120 letras), celular opcional (9 dígitos, empieza con 9), "hasta" (solo horas seguidas libres, máx. 4 h, con duración y precio), efectivo recibido (0 a total) y nota. Queda **Confirmada**, con origen `owner_manual`; el total se calcula con los precios de la cancha. Se puede anotar desde 1 día atrás hasta 60 días adelante. |
| RF-5 | Cada reserva muestra estado, jugador, celular con enlace a WhatsApp (mensaje con el nombre del local y el código), código, origen, total, pagado, lo que falta y la nota. |
| RF-6 | **Cobrar** registra un pago en efectivo aprobado (de S/ 0.01 hasta lo que falta). Si estaba por pagar o en revisión, pasa a **Confirmada**. |
| RF-7 | **Jugó / No vino** solo cuando la hora ya empezó. **Cancelar** solo antes de que termine y con motivo (mínimo 3 letras, con atajos: Lluvia, Mantenimiento, El jugador avisó que no viene); si ya pagó, se recuerda acordar la devolución. |
| RF-8 | **Bloquear** cierra horas (máx. 24 h desde el formulario, 31 días en la base) con motivo (atajos: Mantenimiento, Torneo, Evento privado). No se puede bloquear encima de reservas activas ni de otro bloqueo. **Abrir de nuevo** lo quita. Los jugadores ven esas horas como "Cerrada" y no pueden reservarlas. |
| RF-9 | En `/reservas/{id}`, si canceló el local, el jugador ve: *El local canceló esta reserva: "motivo". Si ya pagaste, coordina la devolución con el local.* |
| RNF-1 | **Sin doble reserva:** la reserva manual pasa por la misma restricción `EXCLUDE` de `bookings` que las reservas web (ADR-011). Dos pedidos a la vez sobre la misma hora → uno entra y el otro recibe `409 HORARIO_OCUPADO`. |
| RNF-2 | **Seguridad:** todo pasa por funciones `SECURITY DEFINER` que verifican `fn_administra_local` (dueño del local o admin); `court_blackouts` y `bookings` siguen cerradas a la API. Otro dueño recibe `403 LOCAL_AJENO` o `404 RESERVA_NO_ENCONTRADA`. Un jugador que abre `/dueno/agenda` vuelve a `/mi-cuenta`. |
| RNF-3 | **Trazabilidad:** cada cambio de estado queda en `booking_status_history` con quién lo hizo; cada cobro en `payments` (método `efectivo`, aprobado). |
| RNF-4 | **Caché:** la agenda tiene datos personales: `Cache-Control: private, no-store` y la página se arma en cada visita (`connection()`). |
| RNF-5 | **UX en celular:** botones principales de 46 px y los de cada fila de 38 px, sin desplazamiento horizontal a 390 px, avisos con `role="status"` / `role="alert"`. |

## 3. Plan técnico

```
Dueño (/dueno/agenda) ── AgendaDueno.tsx (cliente)
   ├─ GET    /api/dueno/agenda          ──▶ fn_agenda_local(local, fecha)          jsonb: local, ahora, canchas+turnos, reservas, bloqueos
   ├─ POST   /api/dueno/reservas        ──▶ fn_reserva_manual(...)                 bookings (owner_manual, confirmed) + payments (efectivo)
   ├─ PATCH  /api/dueno/reservas/{id}   ──▶ fn_gestionar_reserva(id, accion, ...)  cobrar / jugo / no_vino / cancelar
   ├─ POST   /api/dueno/bloqueos        ──▶ fn_bloquear_horario(...)               court_blackouts
   └─ DELETE /api/dueno/bloqueos/{id}   ──▶ fn_quitar_bloqueo(id)
Jugador (/reservas/{id}) ──▶ fn_mis_reservas (+ cancelada_por_local, motivo_cancelacion)
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/010_agenda_dueno.sql` | Las 5 funciones, índice de reservas activas por cancha, `fn_mis_reservas` con el motivo del local, permisos |
| `apps/web/src/modules/agenda/dominio/agenda.ts` | Entidades y reglas puras: saldo, acciones posibles, filas de la agenda, turnos seguidos libres, precio, resumen del día, enlace de WhatsApp |
| `apps/web/src/modules/agenda/dominio/pedidos-agenda.ts` | Validación de lo que llega del navegador |
| `apps/web/src/modules/agenda/dominio/agenda.repositorio.ts` | Puerto (interfaz) del repositorio |
| `apps/web/src/modules/agenda/aplicacion/agenda.casos-de-uso.ts` | Casos de uso |
| `apps/web/src/modules/agenda/infraestructura/*` | Repositorio con Supabase, mapeo y composición |
| `apps/web/src/app/api/dueno/**/route.ts` | 5 rutas REST (documentadas en `public/openapi.yaml`) |
| `apps/web/src/app/dueno/agenda/page.tsx`, `src/components/dueno/AgendaDueno.tsx` | Pantalla |

Decisiones:

- La base devuelve `ahora` con la agenda: la pantalla no usa `Date.now()` al dibujar (regla `react-hooks/purity`) y el reloj del navegador se actualiza cada 30 s con `useSyncExternalStore`.
- Las reglas de qué botón mostrar (`accionesPosibles`) son las mismas que valida `fn_gestionar_reserva`: la pantalla no ofrece lo que la base va a rechazar, pero la base es la que decide.
- Una reserva manual puede ser de una hora que ya empezó (el trigger `fn_validate_booking` deja pasar `owner_manual`), para anotar lo que pasó en el día.

## 4. Criterios de aceptación (probados)

Probados con PostgreSQL 16 (esquema real + migraciones 004 a 010), la app compilada y el navegador (Playwright) en computadora y celular.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Dueño abre la agenda de hoy | Turnos de 08:00 a 23:00 con precio (S/ 60 y S/ 80 desde las 18:00), reservas y resumen | ✔ |
| 2 | Anotar 10:00–12:00, pagó S/ 50 | Confirmada, total S/ 120, falta S/ 70, enlace de WhatsApp con el código | ✔ |
| 3 | Dos pedidos a la vez sobre una hora ya reservada | `409 HORARIO_OCUPADO` en ambos | ✔ |
| 4 | Bloquear 14:00–16:00 por mantenimiento | Fila "Cerrada · Mantenimiento"; el jugador ve 14:00 y 15:00 "Cerrada" | ✔ |
| 5 | Bloquear encima de una reserva | `409 HAY_RESERVAS` | ✔ |
| 6 | Cobrar el saldo (S/ 50) | Pagado S/ 80, ya no aparece "Cobrar"; pago en efectivo aprobado | ✔ |
| 7 | Cancelar la reserva web de un jugador por "Lluvia" | Botón deshabilitado sin motivo; el jugador ve el motivo en su reserva; la hora queda libre | ✔ |
| 8 | Anotar un turno de ayer y marcar Jugó / No vino | Jugada / No vino; el resumen no cuenta la de quien no vino | ✔ |
| 9 | Otro dueño pide la agenda o una acción de un local ajeno | `403 LOCAL_AJENO` / `404 RESERVA_NO_ENCONTRADA`; su página muestra su propio local | ✔ |
| 10 | Jugador abre `/dueno/agenda` o llama a la API | Vuelve a `/mi-cuenta` / `403 LOCAL_AJENO` | ✔ |
| 11 | Celular (390 px) | Sin desplazamiento horizontal, sin errores en la consola | ✔ |
| 12 | Historial | Cada cambio guardado con el id de quien lo hizo | ✔ |
| 13 | Pruebas automáticas | 195 pruebas (57 nuevas) · cobertura de líneas 98,8 % · OpenAPI con 18 operaciones | ✔ |

## 5. Tareas

- [x] Migración `010_agenda_dueno.sql` (probada y re-ejecutable)
- [x] Módulo `agenda` con arquitectura limpia (dominio, aplicación, infraestructura)
- [x] 5 rutas REST y su documentación OpenAPI
- [x] Pantalla `/dueno/agenda` (computadora y celular) y botón en `/dueno`
- [x] Motivo de cancelación del local visible para el jugador
- [x] Pruebas unitarias y de integración
- [ ] Parte B: precios normal/hora punta, horario de atención, % de adelanto, minutos de apartado y horas para cancelar; el admin asigna el dueño real por correo y suspende/reactiva locales
- [ ] Avisar por correo al jugador cuando el local cancela (RF10)
