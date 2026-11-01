# Tecnología

Aquí irá el código del proyecto, organizado con Clean Architecture.

| Carpeta | Tecnología | Despliegue |
|---|---|---|
| `frontend/` | Next.js (React) + TypeScript | Vercel |
| `backend/` | Node.js + NestJS + TypeScript (monolito modular) | Render |

Servicios: PostgreSQL + PostGIS (Supabase), Redis (Upstash), Supabase Storage, OpenRouter, Google Maps (mapa y geocodificación), Resend (correo) y Cloudflare (dominio y CDN). Waze se usa solo con enlaces.

Ver `docs/05-implementacion/` para el modelo de datos, la API, el despliegue y el plan de trabajo.

> Pendiente: boilerplate de Clean Architecture con el módulo Reservas como referencia (ver `docs/03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md`).
