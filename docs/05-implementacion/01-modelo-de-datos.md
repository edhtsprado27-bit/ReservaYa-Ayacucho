# Modelo de datos

> **Proyecto:** ReservaYa Ayacucho · **Base de datos:** PostgreSQL en Supabase · **Versión:** 2.0 (Sprint 2: esquema implementado)  
> **Archivos:** `database/supabase_inicial.sql` (tablas, restricciones y datos base) y `database/migrations/004` a `009` (funciones, RLS y cambios)

---

## 1. Objetivo

Describir las tablas que usa el sistema, qué módulo es dueño de cada una y las restricciones que protegen las reglas del negocio. El detalle de cada columna está en los archivos SQL del repositorio.

---

## 2. Tablas por módulo

| Módulo | Tablas | Qué guarda |
|---|---|---|
| Cuentas | `users` | Perfil de cada cuenta de Supabase Auth: nombre, teléfono, rol (`player`, `owner`, `admin`) y estado |
| Catálogo | `districts`, `venues`, `courts`, `pricing_rules`, `court_operating_hours`, `court_blackouts` | Distritos de Huamanga (activos e inactivos), locales con su ubicación y estado de revisión, canchas, tarifas normal y punta, horario de atención y cierres |
| Reservas | `bookings`, `booking_status_history` | Reservas con su rango de tiempo (`period`), estado, montos, apartado y clave de idempotencia; historial de cambios de estado |
| Pagos | `payments`, `receipt_extractions` | Comprobantes (ruta en Storage, huella SHA-256, método, estado) y lo que leyó la IA |
| IA | `ai_model_configs`, `ai_requests` | Modelo, respaldos, temperatura y prompt por función; registro de cada llamada (tokens, costo, latencia, estado) |
| Archivos | `storage.objects` (bucket `comprobantes`) | Capturas de Yape/Plin, privadas |

---

## 3. Restricciones y reglas en la base de datos

| Regla | Cómo se implementa | Por qué en la base |
|---|---|---|
| Nunca dos reservas activas cruzadas en la misma cancha | `EXCLUDE USING gist (court_id WITH =, period WITH &&)` en `bookings` (`bookings_no_overlap`) | Es la única garantía que resiste pedidos simultáneos (ADR-011) |
| Un pedido repetido no duplica la reserva | Clave de idempotencia por intento en `fn_reservar` | Doble clic o red lenta |
| Máximo 2 reservas «por pagar» por persona; hasta 30 días antes | Validación dentro de `fn_reservar` | Evita que alguien aparte todas las horas sin pagar |
| El precio no lo decide el navegador | `fn_reservar` calcula el total turno por turno con `pricing_rules` | Seguridad |
| Los apartados vencen solos | Un apartado vencido se trata como libre al instante; `pg_cron` ejecuta `fn_expire_holds()` cada minuto | Libera el horario aunque nadie use la web |
| Las tablas sensibles no se exponen | RLS activado y `REVOKE` a `anon` y `authenticated` en `bookings`, `payments`, `ai_*`; acceso solo por funciones `SECURITY DEFINER` que validan `auth.uid()` | Nadie ve quién reservó otro horario ni pagos ajenos |
| El mismo comprobante no sirve dos veces | Se compara el número de operación y la huella de la imagen (`duplicate_operation`) | Evita fraudes |

---

## 4. Funciones que usa la aplicación

| Módulo | Funciones (`fn_*`) |
|---|---|
| Catálogo | `fn_catalogo_canchas`, `fn_proponer_local`, `fn_reemplazar_propuesta`, `fn_retirar_propuesta`, `fn_mis_pendientes`, `fn_revisar_local` |
| Cuentas | `fn_mi_perfil` |
| Reservas | `fn_local_publico`, `fn_disponibilidad_local`, `fn_reservar`, `fn_mis_reservas`, `fn_cancelar_reserva` |
| Pagos | `fn_estado_pago`, `fn_config_ia`, `fn_registrar_pago`, `fn_pagos_por_revisar`, `fn_revisar_pago`, `fn_mis_locales_pago`, `fn_guardar_datos_pago` |

Cada función corresponde a un método de un repositorio en `apps/web/src/modules/*/infraestructura/` (patrón Repository).

---

## 5. Índices principales

| Índice | Para qué consulta |
|---|---|
| `bookings_no_overlap` (GiST) | Detectar cruces de horario al reservar y armar la grilla |
| `ix_bookings_jugador_estado` | «Mis reservas» y el límite de reservas por pagar |
| `ix_payments_reserva_estado` | Estado del pago de una reserva |
| `ix_receipt_extractions_pago` | Lectura de la IA de cada pago |

> El análisis del comportamiento de la base (planes de ejecución con `EXPLAIN ANALYZE` y resultados de las pruebas de carga) se documenta en el Sprint 2.
