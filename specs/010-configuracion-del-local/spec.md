# 010 · Configuración del local y control del administrador

> **Estado:** implementado y probado (parte B del paso 7 "paneles") · **Fecha:** 20/11/2026 · **Sprint 2**

## 1. Historias de usuario

- **Dueño:** quiero cambiar mis precios (normal y de hora punta) y el horario de cada cancha sin pedírselo a nadie, para que la web muestre lo que cobro de verdad.
- **Dueño:** quiero decidir cuánto adelanto pido, cuánto tiempo tiene el jugador para pagarlo y hasta cuándo puede cancelar.
- **Dueño:** quiero agregar una cancha nueva o dejar de ofrecer una que ya no uso.
- **Administrador:** las canchas que registré yo quedaron a nombre de la plataforma; quiero pasarlas a la cuenta de su dueño real usando su correo.
- **Administrador:** quiero suspender un local si hay un problema (datos falsos, reclamos) y reactivarlo después.
- **Jugador:** quiero ver siempre los precios y horarios vigentes, y que un local suspendido no aparezca en el mapa.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | `/dueno/configuracion` muestra un local (por defecto el primero; selector si hay varios) con su estado: Publicado, En revisión o Suspendido (con el motivo). Botón **Configurar mi local** en `/dueno`. |
| RF-2 | **Reglas de reserva:** adelanto (0 a 100 %), tiempo para pagarlo (10 a 60 min), hasta cuántas horas antes puede cancelar el jugador (0 a 72), WhatsApp (celular peruano), dirección (5 a 200 letras) y referencia. Cada campo explica qué significa. |
| RF-3 | **Cada cancha** (en un bloque que se abre y se cierra, con resumen "S/ 70 la hora · hora punta S/ 90 desde 19:00 · Lun a Sáb 07:00–22:00 · Dom cerrado"): nombre, deporte (fútbol, futsal, vóley), techada, máximo por reserva (1 a 4 h), precio por hora (S/ 1 a 1000), hora punta opcional (precio y desde qué hora, hasta el cierre) y horario por día (abre y cierra en punto o y media, hasta 24:00; días sin marcar = cerrado). Botón "Usar el horario del lunes en todos los días". |
| RF-4 | El navegador marca en rojo un día con la apertura después del cierre y no envía; la base vuelve a validar todo. |
| RF-5 | Si el nuevo horario deja reservas fuera, se guardan igual y se avisa: "N reservas quedaron fuera del nuevo horario. Siguen en pie: revísalas en la agenda." |
| RF-6 | **Agregar cancha** (nombre, deporte, precio): queda con horario de 08:00 a 23:00 todos los días. Máximo 10 por local; no se repite el nombre en el mismo local. |
| RF-7 | **Quitar cancha:** pide confirmación; no se puede si tiene reservas pendientes ni si es la única del local. No se borra (status `inactive`): las reservas y pagos antiguos la siguen citando. |
| RF-8 | `/admin` → **Locales publicados:** nombre, distrito, estado, dueño (o "sin asignar (lo administra la plataforma)"), canchas, reservas pendientes; enlaces a su agenda y configuración. |
| RF-9 | **Asignar / cambiar dueño** por correo: la persona debe tener cuenta; si era jugador, pasa a ser dueño. Una cuenta de administrador no se puede asignar. |
| RF-10 | **Suspender** (motivo obligatorio, con atajos) y **Reactivar**. Suspendido: sale del mapa, su ficha no se encuentra y no recibe reservas nuevas; las reservas que ya tenía siguen en pie y el dueño las ve en su agenda con un aviso. |
| RNF-1 | **Seguridad:** todo pasa por funciones `SECURITY DEFINER` que verifican `fn_administra_local` (dueño o admin) o `fn_es_admin`. Las tablas siguen cerradas a la API. |
| RNF-2 | **Trazabilidad:** cada cambio queda en `audit_logs` (quién, qué local o cancha, acción y valores). |
| RNF-3 | **Historial de precios:** al cambiar precios, las reglas anteriores se desactivan (no se borran) y se crean "Normal" (00:00–24:00) y "Hora punta" (desde la hora elegida hasta 24:00). Guardar sin cambiar precios no crea reglas nuevas. |
| RNF-4 | **Concurrencia:** guardar una cancha bloquea su fila (`FOR UPDATE`); agregar una cancha bloquea el local, así dos pedidos a la vez no duplican el nombre ni pasan el límite. |
| RNF-5 | **Caché:** después de cada cambio se renueva al instante la ficha del local (`revalidateTag("local-<slug>", { expire: 0 })`) y el catálogo en memoria del mapa (patrón Decorator `LocalesConVistasFrescas`). El CDN de `/api/canchas` (60 s) vence solo. |

## 3. Plan técnico

```
Dueño (/dueno/configuracion) ── ConfigLocal.tsx
   ├─ GET    /api/dueno/locales/{id}          ──▶ fn_config_local
   ├─ PUT    /api/dueno/locales/{id}          ──▶ fn_guardar_local           ─┐
   ├─ POST   /api/dueno/locales/{id}/canchas  ──▶ fn_agregar_cancha           │ refrescarVistasPublicas(slug)
   ├─ PUT    /api/dueno/canchas/{id}          ──▶ fn_guardar_cancha           │  · ficha "use cache" local-<slug>
   └─ DELETE /api/dueno/canchas/{id}          ──▶ fn_quitar_cancha            │  · catálogo en memoria
Admin (/admin) ── LocalesAdmin.tsx                                            │
   ├─ GET    /api/admin/locales               ──▶ fn_locales_admin            │
   └─ PATCH  /api/admin/locales/{id}          ──▶ fn_asignar_dueno            │
                                                  fn_cambiar_estado_local   ─┘
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/011_configuracion_local.sql` | 8 funciones nuevas + utilidades; `fn_mis_locales_pago` incluye locales suspendidos |
| `apps/web/src/modules/locales/dominio/configuracion.ts` | Tipos, días, deportes, horas de 30 min, día válido, resumen del horario |
| `apps/web/src/modules/locales/dominio/pedidos-locales.ts` | Validación de lo que llega del navegador |
| `apps/web/src/modules/locales/dominio/locales.repositorio.ts` | Puerto (interfaz) |
| `apps/web/src/modules/locales/aplicacion/locales.casos-de-uso.ts` | Casos de uso |
| `apps/web/src/modules/locales/infraestructura/*` | Repositorio Supabase, mapeo, `LocalesConVistasFrescas` (Decorator) y renovación de cachés |
| `apps/web/src/modules/compartido/presentacion/llamar-api.ts` | Llamadas a la API desde el navegador (también lo usa la agenda) |
| `apps/web/src/app/dueno/configuracion/page.tsx`, `components/dueno/ConfigLocal.tsx` | Pantalla del dueño |
| `apps/web/src/app/admin/page.tsx`, `components/admin/LocalesAdmin.tsx` | Pantalla del administrador |

## 4. Criterios de aceptación (probados)

Probados con PostgreSQL 16 (esquema real + migraciones 004 a 011), la app compilada y el navegador (Playwright) en computadora y celular.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Guardar reglas con WhatsApp "123" | "El celular debe tener 9 dígitos y empezar con 9." | ✔ |
| 2 | Adelanto 30 %, 20 min, cancelar hasta 12 h antes | Guardado; la ficha del jugador dice "apartado 20 minutos … adelanto (30% del total)" | ✔ |
| 3 | Martes con apertura 20:00 y cierre 19:00 | Día en rojo, no se envía | ✔ |
| 4 | Cancha 1: S/ 70, hora punta S/ 90 desde 19:00, lunes a sábado 07:00–22:00, domingo cerrado | El jugador ve el lunes 15 turnos (07:00 S/ 70 … 19:00 S/ 90) y el domingo "Este día la cancha no atiende" | ✔ |
| 5 | Guardar dos veces lo mismo | No se crean reglas de precio nuevas | ✔ |
| 6 | Horario que deja reservas de hoy fuera | Se guarda y avisa cuántas quedaron fuera; la reserva sigue confirmada | ✔ |
| 7 | Agregar "Cancha 3" (futsal) y luego "cancha 3" | Agregada; la segunda: "Ya tienes una cancha con ese nombre" | ✔ |
| 8 | Dos "Agregar" simultáneos con el mismo nombre | 1 creada y 1 `CANCHA_DUPLICADA` | ✔ |
| 9 | Quitar Cancha 3 / quitar Cancha 1 con 2 reservas / quitar la única cancha | Quitada / botón deshabilitado y `409 CANCHA_CON_RESERVAS` / `409 ULTIMA_CANCHA` | ✔ |
| 10 | Admin asigna "Otro Local" a un correo sin cuenta y luego a un jugador | `404` con mensaje claro / asignado; la cuenta pasa a dueño y ve el local en su panel; el dueño anterior ya no | ✔ |
| 11 | Admin suspende sin motivo / con motivo | Botón deshabilitado / sale del mapa, ficha no encontrada, `fn_reservar` → `CANCHA_NO_DISPONIBLE`; el dueño ve el motivo en configuración y un aviso en su agenda | ✔ |
| 12 | Reactivar | Vuelve al mapa con su precio nuevo ("desde S/ 70") | ✔ |
| 13 | Otro dueño, jugador o visitante | `403 LOCAL_AJENO` / `SOLO_ADMIN` / permiso denegado | ✔ |
| 14 | `audit_logs` | update_settings, create, deactivate, assign_owner, suspend, reactivate con quién lo hizo | ✔ |
| 15 | Celular (390 px) | Sin desplazamiento horizontal, sin errores en la consola | ✔ |
| 16 | Pruebas automáticas | 254 pruebas (59 nuevas) · cobertura de líneas 99,0 % · OpenAPI con 25 operaciones | ✔ |

## 5. Tareas

- [x] Migración `011_configuracion_local.sql` (probada y re-ejecutable)
- [x] Módulo `locales` con arquitectura limpia y Decorator para renovar cachés
- [x] 7 operaciones REST documentadas en `public/openapi.yaml`
- [x] Pantallas `/dueno/configuracion` y sección "Locales publicados" en `/admin`
- [x] La agenda muestra los locales suspendidos con un aviso
- [x] Pruebas unitarias y de integración
- [ ] Precio distinto por día de la semana (fin de semana) — el esquema ya lo permite (`pricing_rules.day_of_week`)
- [ ] Avisar por correo al dueño cuando su local es suspendido (RF10)
