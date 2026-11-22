# API REST

> **Proyecto:** ReservaYa Ayacucho · **Base:** `https://reservaya-ayacucho.vercel.app/api` · **Formato:** JSON  
> **Implementación:** Route Handlers de Next.js (`apps/web/src/app/api/**/route.ts`) · **Versión:** 2.1 (21/11/2026: servicios, usuarios y WhatsApp de ayuda)  
> **Autenticación:** sesión de Supabase Auth en cookies (la envía el navegador); la base de datos valida el rol con `auth.uid()`.

---

## 1. Endpoints implementados

| Método | Ruta | Quién | Descripción | Respuesta correcta |
|---|---|---|---|---|
| GET | `/api/canchas` | Público | Canchas publicadas (aprobadas) para el mapa y la lista | `200 { canchas, total, generado }` |
| POST | `/api/canchas` | Dueño o admin | Registra una cancha; queda en revisión | `201 { ok, id, slug, estado }` |
| PUT | `/api/canchas/{id}` | Dueño de la cancha o admin | Corrige una cancha que sigue en revisión (devuelve un id nuevo) | `200 { ok, id, slug, estado }` |
| DELETE | `/api/canchas/{id}` | Dueño de la cancha o admin | Quita una cancha que sigue en revisión | `200 { ok }` |
| GET | `/api/canchas/mias` | Con sesión | Canchas en revisión que la persona puede ver | `200 { canchas }` |
| POST | `/api/admin/locales/{id}` | Admin | `{ accion: "aprobar" \| "rechazar", motivo? }` | `200 { ok, id, nombre, estado }` |
| GET | `/api/disponibilidad?local={id}&fecha=AAAA-MM-DD` | Público | Grilla del día: libre, ocupado, pasado o cerrado, con precio | `200 { turnos, generado }` |
| GET | `/api/reservas` | Con sesión | Mis reservas (sin sesión: lista vacía) | `200 { ok, reservas }` |
| POST | `/api/reservas` | Con sesión | Aparta un horario: `{ canchaId, inicio, fin, clave }` | `201 { ok, reserva }` |
| POST | `/api/reservas/{id}/cancelar` | Dueño de la reserva | Cancela: `{ motivo? }` | `200 { ok, conDevolucion }` |
| POST | `/api/reservas/{id}/pago` | Dueño de la reserva | `multipart/form-data`: `imagen` (JPG/PNG/WEBP, máx. 3 MB) y `metodo` (`yape` \| `plin`) | `201 { ok, pago, estadoPago, resultado }` |
| POST | `/api/pagos/{id}/revisar` | Dueño del local o admin | `{ accion: "confirmar" \| "rechazar", motivo? }` | `200 { ok, estadoReserva }` |
| PUT | `/api/locales/{id}/pago` | Dueño del local o admin | Datos para cobrar: `{ yape?, plin?, titular? }` | `200 { ok, datos }` |
| GET | `/api/dueno/agenda?local={id}&fecha=AAAA-MM-DD` | Dueño del local o admin | Agenda del día: canchas, turnos con precio, reservas (nombre y celular del jugador) y bloqueos | `200 { ok, agenda }` |
| POST | `/api/dueno/reservas` | Dueño del local o admin | Anota una reserva hecha por teléfono o en persona: `{ canchaId, inicio, fin, nombre, telefono?, pagado?, nota? }` (queda confirmada) | `201 { ok, reserva }` |
| PATCH | `/api/dueno/reservas/{id}` | Dueño del local o admin | `{ accion: "cobrar" \| "jugo" \| "no_vino" \| "cancelar", monto?, motivo? }` | `200 { ok, reserva }` |
| POST | `/api/dueno/bloqueos` | Dueño del local o admin | Cierra horas de una cancha: `{ canchaId, inicio, fin, motivo? }` | `201 { ok, bloqueo }` |
| DELETE | `/api/dueno/bloqueos/{id}` | Dueño del local o admin | Vuelve a abrir las horas bloqueadas | `200 { ok }` |
| GET | `/api/dueno/locales/{id}` | Dueño del local o admin | Reglas de reserva, canchas, horario por día y precios | `200 { ok, config }` |
| PUT | `/api/dueno/locales/{id}` | Dueño del local o admin | `{ direccion, referencia?, whatsapp?, adelantoPct, minutosApartado, horasCancelacion }` | `200 { ok, local }` |
| PUT | `/api/dueno/locales/{id}/servicios` | Dueño del local o admin | Servicios del local: `{ servicios: ["vestuarios", "duchas", …] }` (`[]` = ninguno) | `200 { ok, local: { id, slug, servicios } }` |
| POST | `/api/dueno/locales/{id}/canchas` | Dueño del local o admin | Agrega una cancha: `{ nombre, deporte, precio }` (08:00 a 23:00 todos los días) | `201 { ok, cancha }` |
| PUT | `/api/dueno/canchas/{id}` | Dueño del local o admin | `{ nombre, deporte, techada, maxMinutos, horario: [{ dia, abre, cierra }], precio, precioPunta?, puntaDesde? }` | `200 { ok, cancha: { id, slug, fueraDeHorario } }` |
| DELETE | `/api/dueno/canchas/{id}` | Dueño del local o admin | Deja de ofrecer la cancha (sin reservas pendientes y no la última) | `200 { ok }` |
| GET | `/api/admin/locales` | Admin | Locales publicados y suspendidos con su dueño | `200 { ok, locales }` |
| PATCH | `/api/admin/locales/{id}` | Admin | `{ accion: "asignar_dueno", correo }` \| `{ accion: "suspender", motivo }` \| `{ accion: "reactivar" }` | `200 { ok, local }` |
| GET | `/api/admin/usuarios?buscar=&filtro=` | Admin | Hasta 100 cuentas; busca por nombre, correo o celular; filtro `todos`, `jugadores`, `duenos`, `admins`, `suspendidos` | `200 { ok, usuarios }` |
| PATCH | `/api/admin/usuarios/{id}` | Admin | `{ accion: "cambiar_rol", rol: "jugador" \| "dueno" }` \| `{ accion: "suspender", motivo }` \| `{ accion: "reactivar" }` | `200 { ok, usuario }` |
| PUT | `/api/admin/ajustes` | Admin | WhatsApp de ayuda: `{ whatsappSoporte: "966123456" }` (`""` = quitar el botón) | `200 { ok, ajustes }` |

> **Documentación interactiva:** https://reservaya-ayacucho.vercel.app/api-docs (Swagger UI). La especificación OpenAPI 3 está en `apps/web/public/openapi.yaml` y una prueba automática comprueba que describe exactamente las rutas del código.

---

## 2. Ejemplo: reservar un horario

```http
POST /api/reservas
Content-Type: application/json
Cookie: sb-...-auth-token=...

{ "canchaId": "6f1c...", "inicio": "2026-12-01T19:00:00-05:00", "fin": "2026-12-01T21:00:00-05:00", "clave": "7d0b9c1e-..." }
```

```json
// 201 Created
{ "ok": true, "reserva": { "id": "a3d2...", "codigo": "RY-4K7P", "estado": "pending_payment",
  "inicio": "...", "fin": "...", "total": 120, "adelanto": 60, "vence": "2026-12-01T18:15:00Z" } }
```

```json
// 409 Conflict
{ "ok": false, "codigo": "HORARIO_OCUPADO", "error": "Alguien acaba de reservar ese horario. Elige otra hora: la grilla ya está actualizada." }
```

La `clave` es un identificador único por intento: si el mismo pedido llega dos veces (doble clic o red lenta), se devuelve la misma reserva sin duplicarla.

---

## 3. Errores

Todas las rutas responden los errores con el mismo formato: `{ ok: false, codigo, error }` (las rutas públicas de lectura, sin `ok`). El `codigo` es estable y el `error` es un mensaje para la persona.

| Código HTTP | Cuándo | Códigos de ejemplo |
|---|---|---|
| 400 | Datos inválidos | `DATOS_INVALIDOS`, `DATOS_INVALIDOS_RESERVA`, `DATOS_INVALIDOS_AGENDA`, `DATOS_INVALIDOS_LOCAL`, `DATOS_INVALIDOS_USUARIO`, `HORARIO_PASADO`, `IMAGEN_INVALIDA`, `MONTO_INVALIDO`, `FALTA_MOTIVO`, `AJUSTES_INVALIDOS`, `HORARIO_ATENCION_INVALIDO`, `PRECIO_PUNTA_INVALIDO`, `SERVICIO_INVALIDO`, `ROL_INVALIDO`, `TELEFONO_INVALIDO` |
| 401 | Sin sesión | `SIN_SESION` |
| 403 | Sin permiso | `SOLO_DUENOS`, `SOLO_ADMIN`, `LOCAL_AJENO`, `USUARIO_ES_ADMIN` |
| 404 | No existe o no es tuyo | `RESERVA_NO_ENCONTRADA`, `PROPUESTA_NO_ENCONTRADA`, `PAGO_NO_ENCONTRADO`, `BLOQUEO_NO_ENCONTRADO`, `LOCAL_NO_ENCONTRADO`, `CANCHA_NO_ENCONTRADA`, `USUARIO_NO_ENCONTRADO`, `CUENTA_NO_ENCONTRADA` |
| 409 | Conflicto | `HORARIO_OCUPADO`, `HORARIO_CERRADO`, `PAGO_YA_ENVIADO`, `RESERVA_VENCIDA`, `LOCAL_DUPLICADO`, `ACCION_NO_PERMITIDA`, `HAY_RESERVAS`, `YA_BLOQUEADO`, `CANCHA_DUPLICADA`, `CANCHA_CON_RESERVAS`, `ULTIMA_CANCHA`, `DUENO_CON_LOCALES`, `CUENTA_SIN_CAMBIO` |
| 413 | Archivo muy grande | `IMAGEN_GRANDE` |
| 429 | Demasiados pedidos | `DEMASIADAS_PENDIENTES`, `DEMASIADAS_PROPUESTAS` |
| 500 / 502 | Falla de configuración o de Supabase | `FALTA_CONFIGURAR_SUPABASE`, `SIN_CONEXION`, `DESCONOCIDO` |

La lista completa de códigos y mensajes está en `apps/web/src/modules/compartido/dominio/error-aplicacion.ts`.

---

## 4. Integración con OpenRouter

| Aspecto | Implementación |
|---|---|
| Función | Leer el comprobante: monto, número de operación, fecha y hora, destinatario |
| Modelo | Se elige en la tabla `ai_model_configs` (`receipt_ocr`): modelo principal gratuito y hasta dos de respaldo; 25 s por modelo |
| Respuesta | JSON con esquema fijo; se valida con `validarLectura()` antes de usarla (nunca se confía a ciegas) |
| Comparación | La base compara con lo esperado: `match`, `amount_mismatch`, `recipient_mismatch`, `date_out_of_range`, `duplicate_operation`, `unreadable` |
| Regla | La IA nunca confirma un pago: quien decide es el dueño |
| Si falla | El pago queda `submitted` para revisión manual; el sistema sigue funcionando |
| Registro | Cada llamada se guarda en `ai_requests` (modelo, tokens, costo, latencia, estado) |
| Seguridad | `OPENROUTER_API_KEY` solo en el servidor |

---

## 5. Estrategia de caché y CDN

| Capa | Qué se guarda | Tiempo | Cuándo se renueva |
|---|---|---|---|
| CDN (Vercel) | `GET /api/canchas` | 60 s (y hasta 5 min viejo mientras se renueva) | Al vencer |
| Memoria del servidor | Catálogo de canchas (`CatalogoEnCache`) | 30 s | Al vencer o al aprobar una cancha |
| CDN (Vercel) | `GET /api/disponibilidad` | 5 s (y hasta 15 s viejo) | Al vencer; tras un choque la web pide sin caché |
| Caché de Next.js (`"use cache"`) | Ficha pública del local | 1 min | Al vencer o al cambiar precios, horario, servicios o el estado del local |
| Caché de Next.js (`"use cache"`, etiqueta `ajustes-publicos`) | WhatsApp de ayuda (botón "Ayuda" de todas las páginas) | horas | Al guardarlo en `/admin` (`revalidateTag`, al instante) |
| ~~Redis (Upstash)~~ | Pospuesto (ADR-013): el CDN ya es la caché compartida entre instancias | — | — |
| Sin caché (`private, no-store`) | Reservas, pagos y datos de la cuenta | — | Nunca se guardan en caché compartida |

> Aunque la grilla en caché muestre libre un horario recién tomado, **la base de datos igual impide la doble reserva**: el segundo pedido recibe `409`.
