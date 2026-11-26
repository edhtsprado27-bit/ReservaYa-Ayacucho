# 013 · Asistente de canchas con IA

> **Estado:** implementado y probado (paso 10) · **Fecha:** 22/11/2026 · **Sprint 2**  
> **Requisito que completa:** RF09 (asistente con IA para recomendaciones y soporte) · **Historia:** HU08

## 1. Historias de usuario

- **Jugador:** quiero escribir «fútbol en Carmen Alto mañana a las 7 con duchas» y ver solo los locales que tienen esa hora libre, con un botón para reservarla.
- **Jugador:** quiero seguir la conversación («¿y a las 8?», «sin duchas», «en cualquier distrito») sin volver a escribir todo.
- **Jugador o visitante:** quiero preguntar cómo reservar, pagar o cancelar y recibir una respuesta clara al instante.
- **Administrador:** quiero ver cuánto se usó la IA hoy, porque el plan gratis de OpenRouter tiene un límite diario que comparten el asistente y la lectura de comprobantes.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | Página `/asistente` con un chat. Se llega desde el enlace **Asistente** de la cabecera y desde «Pregúntale al asistente» en la página principal. |
| RF-2 | **Búsqueda:** entiende deporte, distrito (también apodos como «San Juan» o «el centro»), nombre del local, día (hoy, mañana, pasado mañana, días de la semana, fechas), hora («a las 7» = 19:00, salvo «de la mañana»), franja (mañana, tarde, noche), servicios, techada y precio máximo. |
| RF-3 | Responde con hasta **3 locales reales** y hasta **4 horas libres** de cada uno (la pedida y las más cercanas, hasta 3 horas de diferencia). Cada hora es un enlace a la ficha con ese día, esa cancha y esa hora **ya elegidos** (`/cancha/<slug>?fecha=…&cancha=…&desde=…&hasta=…`). La hora pedida se ve resaltada. |
| RF-4 | **Conversación:** cada respuesta devuelve los filtros entendidos; el siguiente mensaje los ajusta («¿y a las 8?», «una hora más tarde», «también con estacionamiento», «sin duchas», «en cualquier distrito»). Muestra «Entendí:» con chips y sugerencias que se envían con un toque. |
| RF-5 | **Dudas frecuentes:** reservar, pagar, tiempo para pagar, cancelar, confirmación, anticipación, precios, cómo llegar, contacto, cuenta, publicar un local y qué hace el asistente. |
| RF-6 | La conversación se guarda en la pestaña (`sessionStorage`, hasta 30 mensajes): al volver de la ficha sigue ahí. «Nueva conversación» la borra. |
| RF-7 | **Panel del admin:** sección «Uso de la IA hoy» con las consultas del asistente (de su límite), las fallidas y los comprobantes leídos. |
| RNF-1 | **La IA nunca inventa datos:** solo interpreta el mensaje (intención y filtros en JSON validado). Los locales, precios y horas salen siempre del catálogo publicado y de la grilla de la base de datos (ADR-015). |
| RNF-2 | **Costo cero y cupo:** primero responden las **reglas** (sin IA). La IA (modelos gratis de OpenRouter) solo se usa si las reglas no están seguras, solo con sesión iniciada y con cupo diario: **30 consultas por día en total** y **10 por cuenta** (`app_settings`). Se cuenta en la base con `ai_requests`, por día UTC como OpenRouter. |
| RNF-3 | **Siempre responde:** sin clave, sin cupo, sin sesión o si la IA falla o tarda (12 s por modelo, máximo 2 modelos), contesta con lo que entendieron las reglas y lo avisa. Si falla la base, lo dice sin romperse. |
| RNF-4 | **Seguridad:** `OPENROUTER_API_KEY` solo en el servidor. Límite de **20 mensajes por minuto por IP** (`429 DEMASIADOS_MENSAJES`). Mensaje de hasta 500 letras y solo los últimos 6 mensajes del historial. Las instrucciones piden ignorar intentos de cambiar las reglas, y la respuesta de la IA se valida (intención, distritos, deportes, servicios y fechas dentro de los 14 días). `ai_requests` sin acceso directo: se escribe con `fn_registrar_ia_asistente` (solo con sesión). |
| RNF-5 | **Caché:** usa el mismo catálogo en memoria del mapa y la ficha con `"use cache"`; la grilla es la de `fn_disponibilidad_local`. La respuesta del chat no se guarda en caché (`private, no-store`). |
| RNF-6 | **Configurable sin tocar código:** modelo, modelos de respaldo, temperatura, tokens e instrucciones en `ai_model_configs` (función `chat_assistant`); límites en `app_settings`. |

## 3. Plan técnico

```
/asistente ── ChatAsistente.tsx ── POST /api/asistente { mensaje, filtros, historial }
                                        │  (20 por minuto por IP)
                                        ▼
                      consultarAsistente()  (módulo asistente, capa aplicación)
   1. interpretarConReglas()  ── ¿seguro? ── sí ──────────────────────────┐
                                   │ no                                   │
   2. ControlIA.cupo() ── fn_cupo_asistente (sesión, 30/día, 10/cuenta)   │
      ControlIA.config() ── fn_config_ia('chat_assistant')                │
      InterpreteIA (OpenRouter, JSON Schema) ── validarInterpretacionIA()  │
      ControlIA.registrar() ── fn_registrar_ia_asistente                  │
   3. buscar() ◀──────────────────────────────────────────────────────────┘
      FuenteCanchas: catálogo en memoria · fn_local_publico ("use cache") · fn_disponibilidad_local
      evaluarLocal() → horas libres con enlace a la grilla · redactarBusqueda()
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/013_asistente_ia.sql` | Modelo `chat_assistant`, límites en `app_settings`, índice, `fn_cupo_asistente`, `fn_registrar_ia_asistente`, `fn_uso_ia_hoy` (re-ejecutable) |
| `modules/asistente/dominio/asistente.ts` | Tipos, validación del pedido y de la respuesta de la IA, textos («Entendí», fechas) |
| `modules/asistente/dominio/interprete-reglas.ts` | Intérprete por reglas: fechas, horas, distritos, deportes, servicios, seguimiento de la conversación |
| `modules/asistente/dominio/busqueda.ts` | Filtra el catálogo, elige horas libres de la grilla y redacta la respuesta |
| `modules/asistente/dominio/conocimiento.ts` | Preguntas frecuentes (respuestas de las reglas y contexto de la IA) |
| `modules/asistente/dominio/instrucciones-ia.ts` | Instrucciones y JSON Schema para la IA |
| `modules/asistente/dominio/asistente.puertos.ts` | Puertos `FuenteCanchas`, `InterpreteIA`, `ControlIA` |
| `modules/asistente/aplicacion/asistente.casos-de-uso.ts` | `consultarAsistente()`: reglas → IA (si hace falta) → búsqueda |
| `modules/asistente/infraestructura/*` | `OpenRouterInterprete` (Adapter), `SupabaseControlIA`, `leerUsoIAHoy`, composición |
| `modules/compartido/infraestructura/openrouter.ts` | Cliente de OpenRouter compartido con la lectura de comprobantes (`pedirJSON`) |
| `modules/compartido/dominio/ia.ts` | Tipos `ConfigIA`, `RegistroIA`, `aConfigIA`, `extraerJSON` (antes en pagos) |
| `modules/compartido/infraestructura/limite-por-clave.ts` | Límite de pedidos por IP en memoria |
| `app/api/asistente/route.ts`, `app/asistente/page.tsx`, `components/asistente/*` | API y pantalla del chat |
| `components/Cabecera.tsx`, `app/page.tsx`, `app/admin/page.tsx` | Enlaces al asistente y «Uso de la IA hoy» |

## 4. Criterios de aceptación (probados)

Probados con PostgreSQL 16 (esquema real + migraciones 004 a 013), Jest y el navegador (Playwright) en computadora y celular.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | «fútbol en Carmen Alto mañana a las 7» | Reglas: Fútbol, Carmen Alto, mañana, 19:00, sin gastar IA | ✔ |
| 2 | Seguimiento «¿y a las 8?», «una hora más tarde», «sin duchas», «en cualquier distrito», «vóley en San Juan» | Cambia solo lo pedido; una búsqueda distinta empieza de cero | ✔ |
| 3 | La hora pedida está ocupada | «A las 19:00 no hay … libres, pero estas horas cercanas sí:» con las más cercanas | ✔ |
| 4 | Tocar una hora | Abre la ficha con ese día, cancha y hora elegidos («20:00 – 21:00 · Total S/ 80») | ✔ |
| 5 | «el 20 de diciembre» (más de 14 días) / «a las 2 de la mañana» | Aviso «Solo se puede reservar hasta …» / «de 06:00 a 23:00» | ✔ |
| 6 | «¿Cómo pago el adelanto?», «¿puedo cancelar mi reserva?», «olvidé mi contraseña» | Respuesta de las preguntas frecuentes y sugerencias de otras dudas | ✔ |
| 7 | Mensaje libre, con sesión y cupo | Se pregunta a la IA, se valida su JSON, se busca en la base y se registra en `ai_requests` | ✔ |
| 8 | Visitante / cuenta con 10 consultas / día con 30 consultas / cuenta suspendida | Responden las reglas con el aviso SIN_SESION / CUPO_CUENTA / CUPO_DIA / SIN_SESION | ✔ |
| 9 | La IA falla, tarda o responde sin formato | Prueba el modelo de respaldo; si tampoco, responde con las reglas y lo avisa | ✔ |
| 10 | Mensaje vacío o de más de 500 letras / 21 mensajes en un minuto | `400 DATOS_INVALIDOS_ASISTENTE` / `429 DEMASIADOS_MENSAJES` | ✔ |
| 11 | Visitante registra uso de IA / jugador pide el uso del día / lectura directa de `ai_requests` | Permiso denegado / `SOLO_ADMIN` / permiso denegado | ✔ |
| 12 | Falla el catálogo o la grilla | «No pude consultar las canchas…» / «No pude revisar los horarios…» | ✔ |
| 13 | Pruebas automáticas | 379 pruebas de Jest (76 nuevas) · cobertura de líneas 99,33 % · OpenAPI con 30 operaciones · 23 pruebas E2E (2 nuevas) | ✔ |

## 5. Tareas

- [x] Migración `013_asistente_ia.sql` (probada desde cero y re-ejecutable)
- [x] Módulo `asistente`; cliente de OpenRouter compartido con `pagos`
- [x] `POST /api/asistente` documentado en `public/openapi.yaml`
- [x] Pantalla `/asistente`, enlaces en la cabecera y la página principal, «Uso de la IA hoy» en el panel del admin
- [x] ADR-015 y documentos de análisis, arquitectura y C4 actualizados
- [x] Pruebas unitarias, de integración y E2E
- [ ] Dominio propio y CDN (cuando llegue el GitHub Student Pack)
- [ ] Avisos automáticos por correo (RF10)
