# Patrones de diseño

## Objetivo

Documentar los patrones de diseño aplicados en ReservaYa Ayacucho, indicando dónde se usan, qué problema resuelven y en qué archivos están, para que el equipo programe de forma uniforme.

## Contexto

- **Estilo:** monolito modular (Next.js 16 en Vercel).
- **Enfoque interno:** Clean Architecture.
- **Base:** diagrama de componentes (C4 nivel 3). Todas las rutas son relativas a `apps/web/src/modules/`.

## Patrones aplicados

| Patrón | Dónde se usa | Problema que resuelve | Se implementa con | Archivos en el código |
|---|---|---|---|---|
| Repository | Catálogo, Reservas y Pagos → Base de datos | El negocio no debe conocer SQL ni las funciones de Supabase | Funciones `fn_*` de PostgreSQL vía `supabase.rpc()` | `*/dominio/*.repositorio.ts`, `catalogo/infraestructura/supabase-catalogo.repositorio.ts`, `reservas/infraestructura/supabase-reservas.repositorio.ts`, `pagos/infraestructura/supabase-pagos.repositorio.ts` |
| Adapter | Pagos → OpenRouter (IA) | OpenRouter tiene su propia API y el modelo puede cambiar | API REST de OpenRouter (`fetch`) | `pagos/dominio/pagos.puertos.ts` (`LectorComprobantes`), `pagos/infraestructura/openrouter-lector.ts` |
| Adapter | Pagos → Almacén de archivos | Supabase Storage tiene su propia API | SDK `@supabase/supabase-js` | `pagos/dominio/pagos.puertos.ts` (`AlmacenComprobantes`), `pagos/infraestructura/supabase-almacen-comprobantes.ts` |
| Decorator | Catálogo → Caché | Leer las canchas publicadas más rápido sin modificar el repositorio | Caché en memoria de 30 s | `catalogo/infraestructura/catalogo-en-cache.ts` (`CatalogoEnCache` envuelve a otro `CatalogoRepositorio`) |
| Composition Root | Cada módulo | Elegir en un solo lugar qué implementación recibe cada caso de uso | Funciones fábrica | `*/infraestructura/composicion.ts` (`catalogoPublico`, `reservasConSesion`, `pagosConSesion`) |
| Singleton | Clientes de Supabase y catálogo público | Reutilizar una sola conexión y una sola caché por instancia | Variable de módulo | `compartido/infraestructura/supabase/cliente-publico.ts`, `catalogo/infraestructura/composicion.ts` |

## Cómo funciona cada patrón

| Patrón | En pocas palabras |
|---|---|
| Repository | El caso de uso dice `repo.reservar(pedido)`; el repositorio llama a `fn_reservar` en PostgreSQL. |
| Adapter | El caso de uso dice `lector.leer(imagen)`; el adaptador lo convierte en el pedido propio de OpenRouter (con modelos de respaldo y límite de tiempo). |
| Decorator | `CatalogoEnCache` tiene la misma interfaz que el repositorio: busca primero en memoria y, si no está o venció, consulta la base. Al aprobar una cancha borra la caché. |
| Composition Root | Las rutas `/api` no crean repositorios a mano: piden `pagosConSesion(db)` y reciben todo listo. |

## Beneficio

- Cambiar el modelo de IA, el almacenamiento o la base de datos solo afecta al adaptador o al repositorio.
- Los casos de uso se prueban con implementaciones falsas en memoria (sin red ni base de datos).
- La caché se puede cambiar por Redis creando otro decorador, sin tocar los casos de uso.

## Patrones previstos para siguientes iteraciones

| Patrón | Dónde se aplicaría | Cuándo |
|---|---|---|
| Decorator (Redis) | Catálogo y disponibilidad → Redis (Upstash) | Sprint 2, para compartir la caché entre las instancias de Vercel |
| Observer | Reservas → Notificaciones | Al agregar avisos por correo o WhatsApp |
| Strategy | Cálculo de tarifas | Si se agregan promociones o tarifas por temporada además de hora pico y normal |
