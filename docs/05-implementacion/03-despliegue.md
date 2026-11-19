# Despliegue

> **Proyecto:** ReservaYa Ayacucho · **Entornos:** desarrollo local y producción · **Versión:** 2.0 (Sprint 2: despliegue real)

---

## 1. Servicios que se usan

| Servicio | Para qué | Estado |
|---|---|---|
| **GitHub** | Repositorio; cada push a `main` despliega solo | En uso |
| **Vercel** | Aplicación Next.js (web + API), CDN y funciones en São Paulo (`gru1`) | En uso: https://reservaya-ayacucho.vercel.app |
| **Supabase** | PostgreSQL, Auth y Storage (bucket privado `comprobantes`), región São Paulo | En uso |
| **OpenRouter** | Modelos de IA gratuitos para leer comprobantes | En uso |
| **OpenStreetMap** | Teselas del mapa (sin clave) | En uso |
| **GitHub Actions** | Pruebas automáticas (Jest) en cada cambio | Sprint 2 |
| **Upstash** | Redis para la caché compartida | Sprint 2 |
| **Cloudflare** | Dominio propio, DNS y CDN | Sprint 2 |

---

## 2. Variables de entorno

### Vercel (y `apps/web/.env.local` en desarrollo)

| Variable | Descripción | Visible en el navegador |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | Sí (es pública) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase (lo que protege los datos es RLS) | Sí (es pública) |
| `OPENROUTER_API_KEY` | Clave de OpenRouter, tipo **Secret**, solo Production | **No** |

> Nunca se usan en la web la clave `secret` ni `service_role` de Supabase.

---

## 3. Pasos de despliegue

| Paso | Acción |
|---|---|
| 1 | Crear el proyecto en Supabase y ejecutar en el SQL Editor el esquema inicial y las migraciones de `database/migrations/` en orden (004 → 009) |
| 2 | En Supabase Auth: Site URL `https://reservaya-ayacucho.vercel.app` y Redirect URLs `http://localhost:3000/**` y `https://reservaya-ayacucho.vercel.app/**` |
| 3 | Crear el proyecto en Vercel con **Root Directory** `apps/web` y cargar las variables de entorno |
| 4 | Hacer push a `main`: Vercel compila (`next build`) y publica |
| 5 | **Antes** de subir código que use funciones nuevas de la base, ejecutar su migración en Supabase (si no, la web muestra «Ejecuta las migraciones») |

---

## 4. Monitoreo

| Qué | Dónde |
|---|---|
| Errores y registros del servidor | Vercel → proyecto → Logs |
| Uso y costo de la IA | Tabla `ai_requests` y panel de OpenRouter |
| Base de datos | Supabase → Reports |
