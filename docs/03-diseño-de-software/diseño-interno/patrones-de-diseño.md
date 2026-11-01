# Patrones de diseño

## Objetivo

Documentar los patrones de diseño aplicados en el backend de ReservaYa Ayacucho, indicando dónde se usan, qué problema resuelven y con qué tecnología se implementan, para que el equipo programe de forma uniforme.

## Contexto

- **Estilo:** monolito modular (Node.js + NestJS).
- **Enfoque interno:** Clean Architecture.
- **Base:** diagrama de componentes (C4 nivel 3).

## Patrones aplicados

| Patrón | Dónde se usa | Problema que resuelve | Se implementa con | Archivos en el código |
|---|---|---|---|---|
| Adapter | Asistente IA → OpenRouter | OpenRouter tiene su propia API y el modelo puede cambiar | API REST de OpenRouter (fetch) | `ia-port.ts`, `openrouter-ia.adapter.ts` |
| Adapter | Reservas → Redis | El negocio no debe conocer los comandos de Redis para bloquear horarios | Redis (Upstash, `ioredis`) | `bloqueo-horario.port.ts`, `redis-bloqueo-horario.adapter.ts` |
| Adapter | Pagos → Almacenamiento de archivos | Supabase Storage tiene su propia API | SDK `@supabase/supabase-js` | `comprobante-storage.port.ts`, `supabase-storage.adapter.ts` |
| Adapter | Canchas → Google Maps | La API de geocodificación tiene su propio formato de respuesta | Geocoding API de Google Maps (fetch) | `geocodificador.port.ts`, `google-maps-geocodificador.adapter.ts` |
| Adapter | Notificaciones → Servicio de correo | El proveedor de correo tiene su propia API | SDK de Resend | `notificador.port.ts`, `resend-correo.adapter.ts` |
| Repository | Todos los módulos → Base de datos | El negocio no debe conocer SQL | PostgreSQL (Prisma o TypeORM) | `reserva.repository.ts`, `postgres-reserva.repository.ts` |
| Decorator | Horarios → Caché | Consultar la disponibilidad más rápido sin modificar el repositorio | Redis | `cached-disponibilidad.repository.ts` |

## Cómo funciona cada patrón

| Patrón | En pocas palabras |
|---|---|
| Adapter | Traduce: el sistema dice `leerComprobante(imagen)` o `bloquear(horario)` y el adaptador lo convierte en la llamada propia de OpenRouter, Redis o Supabase. |
| Repository | El negocio dice `guardar(reserva)`; el repositorio escribe el SQL. |
| Decorator | Busca primero la disponibilidad en Redis; si no está, consulta PostgreSQL y la guarda en Redis para la próxima vez. Al crear o cancelar una reserva, se borra esa entrada. |

## Beneficio

- Cambiar el modelo de IA, el almacenamiento, el proveedor de mapas (por ejemplo, a OpenStreetMap) o la base de datos solo afecta al adaptador o al repositorio.
- La caché con Redis se puede activar o retirar sin tocar las reglas de negocio.

## Patrones previstos para siguientes iteraciones

| Patrón | Dónde se aplicaría | Cuándo |
|---|---|---|
| Observer | Reservas → Notificaciones | Al agregar más canales de aviso (WhatsApp) además del correo |
| Strategy | Horarios → cálculo de tarifas | Si se agregan promociones o tarifas por temporada además de hora pico y normal |
| Facade | Comunicación entre módulos | Cuando los módulos crezcan y necesiten una única puerta de entrada |
