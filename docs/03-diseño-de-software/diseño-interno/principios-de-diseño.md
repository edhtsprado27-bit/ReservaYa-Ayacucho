# Principios de diseño (SOLID)

## Objetivo

Documentar cómo se aplican los principios SOLID en el backend de ReservaYa Ayacucho, organizado con Clean Architecture, para que cada módulo se programe de forma uniforme y las reglas de negocio no dependan de la tecnología.

## Contexto

- **Estilo:** monolito modular (Node.js + NestJS).
- **Enfoque interno:** Clean Architecture (presentación, aplicación, dominio, infraestructura).
- **Módulo de referencia:** Reservas, porque integra base de datos, bloqueo de horarios en Redis y el módulo de Pagos.

## SOLID en el módulo Reservas

![SOLID en el módulo Reservas](/img/solid-modulo-reservas.png)

| Principio | Dónde se aplica (capa) | Cómo se cumple en ReservaYa | Archivos |
|---|---|---|---|
| **S** · Responsabilidad única | Todas las capas | Cada clase tiene una sola tarea: el controlador recibe la petición HTTP, el caso de uso coordina la reserva, la entidad aplica las reglas de la reserva y el repositorio guarda en PostgreSQL | `reserva.controller.ts`, `crear-reserva.use-case.ts`, `reserva.ts`, `postgres-reserva.repository.ts` |
| **O** · Abierto/cerrado | Infraestructura | Para bloquear horarios con otra tecnología (por ejemplo, en memoria para pruebas) se crea un nuevo adaptador; el caso de uso no se modifica | `redis-bloqueo-horario.adapter.ts`, `memoria-bloqueo-horario.adapter.ts` |
| **L** · Sustitución de Liskov | Infraestructura | Los adaptadores de Redis y de memoria devuelven el mismo resultado (`true` si obtuvieron el bloqueo); el caso de uso funciona igual con cualquiera | `redis-bloqueo-horario.adapter.ts`, `memoria-bloqueo-horario.adapter.ts` |
| **I** · Segregación de interfaces | Dominio | Cada interfaz tiene solo lo que Reservas necesita: `BloqueoHorarioPort` solo bloquea y libera, `ReservaRepository` solo guarda y busca reservas | `bloqueo-horario.port.ts`, `reserva.repository.ts` |
| **D** · Inversión de dependencias | Aplicación | El caso de uso recibe interfaces por el constructor y no conoce Redis ni PostgreSQL; las implementaciones se conectan en `reservas.module.ts` con la inyección de dependencias de NestJS | `crear-reserva.use-case.ts`, `reservas.module.ts` |

## Qué pasaría sin SOLID en ReservaYa

| Situación real | Sin SOLID | Con SOLID |
|---|---|---|
| Se cambia Upstash por otro Redis | Hay que modificar el caso de uso de reserva | Solo se cambia la configuración del adaptador |
| Se cambia el modelo de IA de OpenRouter | Se modifica el código del módulo Pagos | Solo se cambia el adaptador o la variable de entorno del modelo |
| Se quiere probar la reserva | Se necesita PostgreSQL y Redis reales | Se prueba con implementaciones en memoria |
| Cambia una regla de la reserva (duración mínima, cancelación) | Hay que buscarla en controladores y servicios | Está solo en la entidad `Reserva` |

## Relación con Clean Architecture y los patrones

| Principio | Lo cumple en el proyecto |
|---|---|
| Responsabilidad única | La separación en capas de Clean Architecture |
| Abierto/cerrado y Liskov | El patrón Adapter (Redis, Supabase Storage y OpenRouter) |
| Segregación de interfaces | Los puertos del dominio (`BloqueoHorarioPort`, `ReservaRepository`, `TarifaPort`) |
| Inversión de dependencias | El patrón Repository y la regla de dependencia: las capas externas dependen del dominio |
