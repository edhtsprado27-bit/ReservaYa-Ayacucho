# Despliegue

> **Proyecto:** ReservaYa Ayacucho · **Entornos:** desarrollo local y producción · **Versión:** 1.0

---

## 1. Servicios que se necesitan

| Servicio | Para qué | Cuenta que se crea |
|---|---|---|
| **GitHub** | Repositorio y despliegue automático | Repositorio del proyecto |
| **Vercel** | Frontend Next.js | Proyecto conectado a `tecnologia/frontend` |
| **Render** | Backend NestJS (API y tareas programadas) | Web Service conectado a `tecnologia/backend` |
| **Supabase** | PostgreSQL + PostGIS y almacenamiento de imágenes | Proyecto con los buckets `comprobantes` (privado) y `fotos` (público) |
| **Upstash** | Redis para bloqueos, disponibilidad y límites | Base de datos Redis |
| **OpenRouter** | Modelos de IA | Clave de API con límite de gasto |
| **Google Cloud** | Maps JavaScript API y Geocoding API | Proyecto con facturación activa y dos claves |
| **Resend** | Envío de correos | Dominio verificado |
| **Cloudflare** | Dominio, DNS, HTTPS y CDN | Dominio del sistema (ej. `reservaya.pe`) |

---

## 2. Arquitectura de despliegue

| Dirección | Apunta a | Servicio |
|---|---|---|
| `reservaya.pe` | Frontend | Vercel (a través de Cloudflare) |
| `api.reservaya.pe` | Backend | Render (a través de Cloudflare) |
| — | Base de datos y almacenamiento | Supabase (solo accesible desde el backend) |
| — | Redis | Upstash (solo accesible desde el backend) |

---

## 3. Variables de entorno

### Backend (Render)

| Variable | Ejemplo / descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Supabase (con pooler) |
| `REDIS_URL` | `rediss://...upstash.io:6379` |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Clave de servicio (solo en el backend) |
| `JWT_SECRET` | Texto largo y aleatorio |
| `OPENROUTER_API_KEY` | Clave de OpenRouter |
| `OPENROUTER_MODELO_OCR` | Modelo con visión para comprobantes |
| `OPENROUTER_MODELO_CHAT` | Modelo económico para chat y recomendaciones |
| `GOOGLE_GEOCODING_KEY` | Clave de Google restringida por IP y solo a Geocoding API |
| `RESEND_API_KEY` | Clave de Resend |
| `CORREO_REMITENTE` | `reservas@reservaya.pe` |
| `FRONTEND_URL` | `https://reservaya.pe` (para CORS) |
| `TZ` | `America/Lima` |

### Frontend (Vercel)

| Variable | Ejemplo / descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.reservaya.pe/api/v1` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Clave pública restringida al dominio `reservaya.pe` y solo a Maps JavaScript API |

> Las claves que empiezan con `NEXT_PUBLIC_` son visibles en el navegador: por eso la de Google Maps del frontend es **distinta** de la del backend y está restringida por dominio.

---

## 4. Pasos de despliegue

| Paso | Acción |
|---|---|
| 1 | Crear el proyecto en Supabase, activar PostGIS y ejecutar el SQL de `01-modelo-de-datos.md` desde DataGrip |
| 2 | Crear los buckets `comprobantes` (privado) y `fotos` (público) en Supabase Storage |
| 3 | Crear la base Redis en Upstash |
| 4 | Crear las claves de OpenRouter, Google Maps (2 claves) y Resend |
| 5 | Desplegar el backend en Render con las variables de entorno; comprobar `GET /api/v1/salud` |
| 6 | Desplegar el frontend en Vercel con sus variables |
| 7 | Comprar o configurar el dominio en Cloudflare y apuntar `reservaya.pe` a Vercel y `api.reservaya.pe` a Render |
| 8 | Activar en Cloudflare HTTPS completo y las reglas de caché de `02-api-rest.md` |
| 9 | Cargar datos de prueba (locales reales de Huamanga con sus coordenadas) y probar el flujo completo de reserva y pago |

---

## 5. Monitoreo

| Qué | Herramienta |
|---|---|
| Errores del backend y frontend | Sentry (plan gratuito) |
| Disponibilidad de la API | UptimeRobot llamando a `/api/v1/salud` cada 5 minutos |
| Costo de IA | Tabla `ia_uso` y panel de OpenRouter |
| Costo de Google Maps | Alertas de presupuesto en Google Cloud |

> **Nota:** el plan gratuito de Render apaga el servicio cuando no recibe visitas y tarda en encender. Para la demostración conviene el plan pagado más bajo o mantenerlo activo con UptimeRobot.
