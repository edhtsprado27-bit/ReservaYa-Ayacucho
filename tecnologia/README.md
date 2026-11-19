# Tecnología

El código del sistema está en **`apps/web`** (una sola aplicación: web + API REST, ver ADR-009).

| Carpeta | Contenido | Despliegue |
|---|---|---|
| `apps/web` | Next.js 16 + TypeScript: páginas, API REST (`src/app/api`) y módulos con Clean Architecture (`src/modules`) | Vercel |
| `database` | Esquema de PostgreSQL y migraciones (funciones, RLS) | Supabase |
| `specs` | Especificaciones SDD de cada funcionalidad | — |

Servicios: Supabase (PostgreSQL, Auth y Storage), OpenRouter (IA), OpenStreetMap + Leaflet (mapa). En el Sprint 2: Redis (Upstash), GitHub Actions y Cloudflare.

Ver `docs/03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md` para la organización del código.
