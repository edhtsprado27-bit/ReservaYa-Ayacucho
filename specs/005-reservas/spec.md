# 005 · Reservas con grilla de horarios

> **Estado:** implementado y probado · **Fecha:** 18/11/2026

## 1. Historias de usuario

- **Jugador:** quiero ver qué horas están libres en una cancha, elegir una o varias horas seguidas y apartarlas mientras pago el adelanto.
- **Jugador:** quiero ver mis reservas, su código y cuánto tiempo me queda para pagar, y poder cancelar si ya no voy.
- **Dueño:** quiero que nunca se reserve dos veces la misma hora de mi cancha, aunque dos personas reserven al mismo tiempo.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | Cada cancha publicada tiene su página `/cancha/{slug}` con dirección, "Cómo llegar", Waze, teléfono y la grilla de horarios. |
| RF-2 | Botón **Reservar** en la lista y en el pin del mapa (solo canchas publicadas). |
| RF-3 | La grilla muestra 14 días (hoy, mañana, …) y por cada turno: hora, precio y estado (libre, ocupada, cerrada, tuya). Las horas que ya pasaron no se muestran. |
| RF-4 | Se eligen horas seguidas tocándolas (mínimo y máximo según la cancha, 1 a 3 h por defecto). Se ve el total y el adelanto antes de confirmar. |
| RF-5 | El precio se calcula en la base de datos turno por turno (hora normal y hora punta se suman por separado); el navegador no puede cambiarlo. |
| RF-6 | Al reservar, el horario queda **apartado** `hold_minutes` (15 min) con estado "Por pagar". Si no se paga, vence solo y se libera. |
| RF-7 | Sin sesión se puede ver la grilla; al reservar se pide ingresar y se vuelve con la misma selección. |
| RF-8 | `/reservas/{id}` muestra código, horario, total, adelanto, saldo y la cuenta regresiva para pagar. `/mi-cuenta` lista las reservas (primero las vigentes). |
| RF-9 | Se puede cancelar una reserva propia que no haya empezado. Si faltan menos de `cancellation_hours` y ya hubo pago, se avisa que el adelanto no se devuelve. |
| RF-10 | Máximo 2 reservas "por pagar" a la vez por persona (evita apartar todas las horas sin pagar). Se puede reservar hasta 30 días antes. |
| RNF-1 | **Anti doble reserva:** lo garantiza PostgreSQL con `EXCLUDE USING gist (court_id WITH =, period WITH &&)`, incluso con pedidos simultáneos. |
| RNF-2 | **Idempotencia:** cada intento lleva una clave única; si llega dos veces (doble clic, red lenta) se devuelve la misma reserva. |
| RNF-3 | La tabla `bookings` no se expone a la API: todo pasa por funciones `SECURITY DEFINER` que validan a quien llama. Nadie ve quién reservó otro horario. |
| RNF-4 | **Caché:** la ficha del local se guarda 1 min (`"use cache"`); la grilla es pública y el CDN la guarda 5 s. Tras un choque se salta el caché. |
| RNF-5 | Apartados vencidos se tratan como libres al instante y se liberan al reservar; además `pg_cron` los marca cada minuto (si está activado). |
| RNF-6 | Todas las horas se muestran en hora de Ayacucho (UTC-5). |

## 3. Plan técnico

```
/cancha/{slug} ──▶ leerLocal (use cache 1 min) ──▶ fn_local_publico(slug)
   │
   ├─ GET  /api/disponibilidad?local&fecha  (público, CDN 5 s) ──▶ fn_disponibilidad_local
   ├─ POST /api/reservas {canchaId, inicio, fin, clave}        ──▶ fn_reservar
   │        └─ precio por turno · límite de apartados · libera vencidos · INSERT
   │           └─ trigger fn_validate_booking + EXCLUDE bookings_no_overlap
   │              (choque → 23P01 → HORARIO_OCUPADO → la grilla se recarga)
   └─ /reservas/{id} y /mi-cuenta  ──▶ fn_mis_reservas · POST /api/reservas/{id}/cancelar ──▶ fn_cancelar_reserva
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/007_reservas.sql` | Funciones de ficha, grilla, reservar, mis reservas, cancelar y la tarea de `pg_cron` |
| `apps/web/src/lib/reservas.ts` | Tipos, conversión de filas y fechas en hora de Ayacucho (sirve en navegador y servidor) |
| `apps/web/src/lib/reservas-servidor.ts` | Llamadas a Supabase, validación del pedido y traducción de errores |
| `apps/web/src/app/api/disponibilidad`, `api/reservas`, `api/reservas/[id]/cancelar` | API |
| `apps/web/src/app/cancha/[slug]`, `app/reservas/[id]` | Páginas |
| `apps/web/src/components/reservas/*` | Grilla, cuenta regresiva, cancelar y lista de reservas |

## 4. Criterios de aceptación (probados)

Probados en PostgreSQL 16 con el mismo esquema de Supabase y en el navegador (PC 1280×900 y celular 390×844).

| # | Caso | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | Visitante abre la grilla | Ve horas y precios; el local en revisión no aparece | ✔ |
| 2 | Visitante intenta reservar o leer `bookings` | Permiso denegado | ✔ |
| 3 | Reserva 19:00–21:00 con hora punta desde las 18:00 (S/ 80) | Total S/ 160, adelanto S/ 80, 15 min para pagar, código `RY-XXXXX` | ✔ |
| 4 | Misma clave enviada 5 veces a la vez (doble clic) | Una sola reserva, el mismo código las 5 veces | ✔ |
| 5 | **20 jugadores reservan la misma hora a la vez** | 1 lo logra, 19 reciben "Alguien acaba de reservar ese horario" | ✔ |
| 6 | Hora contigua (21:00 después de 19–21) | Se acepta | ✔ |
| 7 | Cancha sin precio · 30 min · media hora desalineada · fuera de horario · hora pasada · 4 h · a 31 días · local en revisión · cruzar la medianoche | Mensaje claro para cada caso, no se crea nada | ✔ |
| 8 | Tercera reserva por pagar | "Ya tienes 2 reservas por pagar" | ✔ |
| 9 | Apartado vencido | Se ve libre, otra persona puede tomarlo y el anterior queda "Vencida" | ✔ |
| 10 | Cancelar la reserva de otra persona | "No encontramos esa reserva" | ✔ |
| 11 | Cancelar la propia; cancelar otra vez | Se libera el horario; la segunda vez "ya no se puede cancelar" | ✔ |
| 12 | Cancelar con menos de 6 h de anticipación | `con_devolucion = false` | ✔ |
| 13 | Historial de estados | Cada cambio queda en `booking_status_history` con quién lo hizo | ✔ |
| 14 | Navegador: elegir horas sin sesión → ingresar → volver | La selección se conserva y se reserva | ✔ |
| 15 | Navegador: otra persona toma la hora mientras eliges | Aviso y la grilla se actualiza con la hora ocupada | ✔ |
| 16 | Navegador: la cuenta regresiva llega a 0 | La página pasa sola a "Vencida" | ✔ |
| 17 | Compilar (`next build`) y `eslint` | Sin errores | ✔ |

## 5. Tareas

- [x] Migración `007_reservas.sql` y pruebas de reglas, carrera e idempotencia
- [x] Página de la cancha con grilla, selector de días y canchas
- [x] Reservar, detalle con cuenta regresiva, mis reservas y cancelar
- [x] Botón "Reservar" en la lista y el mapa
- [ ] Ejecutar `007_reservas.sql` en Supabase y activar `pg_cron`
- [ ] Paso 6: pagar el adelanto con Yape/Plin y lectura del comprobante con IA
- [ ] Paso 7: agenda del dueño (ver y registrar reservas de sus canchas)
