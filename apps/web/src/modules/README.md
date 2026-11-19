# Módulos (monolito modular + Clean Architecture)

| Módulo | Qué hace |
|---|---|
| `compartido` | Error de la aplicación, validaciones y clientes de Supabase |
| `cuentas` | Roles y perfil de quien navega |
| `catalogo` | Canchas publicadas (con caché), registro y aprobación |
| `reservas` | Grilla de horarios, reservar, mis reservas y cancelar |
| `pagos` | Comprobante de Yape/Plin, lectura con IA y revisión del dueño |

Cada módulo tiene las mismas capas:

- `dominio/` — entidades, reglas puras y **puertos** (interfaces). No importa Next.js ni Supabase.
- `aplicacion/` — **casos de uso**. Reciben los puertos por parámetro.
- `infraestructura/` — repositorios y adaptadores (Supabase, OpenRouter, caché) y `composicion.ts`, que une cada puerto con su implementación.
- `presentacion/` — ayudas para la interfaz (hooks del navegador, respuestas HTTP).

Las páginas y la API REST (`src/app/`) son la capa de presentación: llaman a los casos de uso y nunca escriben SQL.

Más detalle: `docs/03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md`.
