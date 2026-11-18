# 003 · Conexión de la web con Supabase

> **Estado:** implementado y probado · **Fecha:** 17/11/2026

## 1. Historia de usuario

- **Jugador:** quiero ver en el mapa las canchas reales guardadas en la base de datos, desde cualquier celular o computadora.
- **Administrador:** quiero registrar canchas marcándolas en el mapa ("+ Agregar cancha") sin que cualquier visitante pueda publicar datos falsos.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | El mapa muestra solo locales **aprobados** de un **distrito activo**. |
| RF-2 | "+ Agregar cancha" guarda el local en `venues` con estado `pending_review`, con una cancha por deporte, horario por defecto 08:00–23:00 y precio por hora si se indicó. |
| RF-3 | Solo el administrador publica un local (`status = 'approved'`). Hasta el paso 7 se hace con SQL. |
| RF-6 | Mientras una cancha está en revisión, quien la registró la ve en el mapa (pin gris, etiqueta "En revisión") y puede **editarla** o **quitarla**. Una cancha aprobada ya no se cambia desde la web. |
| RF-7 | Las canchas de ejemplo se muestran solas mientras no haya canchas aprobadas; la casilla permite verlas u ocultarlas. |
| RF-4 | Se rechaza un registro fuera de Huamanga, en un distrito inactivo, duplicado (mismo nombre en el distrito o a menos de ~25 m) o si hay más de 100 registros en una hora. |
| RF-5 | Las canchas guardadas antes en el navegador se pueden subir una sola vez desde `/migrar`. |
| RNF-1 | La web solo usa la clave **pública** (publishable/anon). RLS impide escribir directo en las tablas; la única escritura permitida es `fn_proponer_local`, que valida todo. |
| RNF-2 | Caché del catálogo: 30 s en la memoria del servidor y 60 s en el CDN (`s-maxage=60, stale-while-revalidate=300`). |
| RNF-3 | Los errores se muestran en español y dicen qué hacer (falta `.env.local`, falta la migración, sin conexión, duplicado...). |

## 3. Plan técnico

```
Navegador ──fetch──▶ /api/canchas (Next.js, servidor) ──RPC──▶ Supabase ──▶ PostgreSQL (RLS)
                        │  GET:    fn_catalogo_canchas()       (caché 30 s + CDN 60 s)
                        │  POST:   fn_proponer_local(...)      (queda en revisión)
                        │  PUT:    fn_reemplazar_propuesta(id) (solo en revisión, atómico)
                        └─ DELETE: fn_retirar_propuesta(id)    (solo en revisión)
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/004_web_catalogo.sql` | Funciones `fn_catalogo_canchas` y `fn_proponer_local`, políticas RLS de lectura, usuario "plataforma" |
| `apps/web/src/lib/supabase.ts` | Cliente de Supabase con la clave pública |
| `apps/web/src/lib/canchas-db.ts` | Tipos y conversión BD ↔ web (deportes, distritos) |
| `apps/web/src/lib/catalogo-servidor.ts` | Lectura con caché, registro y traducción de errores |
| `database/migrations/005_web_propuestas.sql` | Funciones `fn_retirar_propuesta` y `fn_reemplazar_propuesta` |
| `apps/web/src/app/api/canchas/route.ts` | API `GET` y `POST /api/canchas` |
| `apps/web/src/app/api/canchas/[id]/route.ts` | API `PUT` y `DELETE /api/canchas/:id` |
| `apps/web/src/components/BuscadorCanchas.tsx` | Mapa y lista leen de Supabase; "+ Agregar cancha", "Editar" y "Quitar" escriben en Supabase |
| `apps/web/src/lib/useCanchas.ts` | Hook `useCanchas()` y función `proponerCancha()` para las pantallas |
| `apps/web/src/app/migrar/page.tsx` | Herramienta de una vez: comprobar conexión y subir canchas del navegador |

**Por qué una ruta `/api` y no Supabase directo desde el navegador:** permite cachear el catálogo en el CDN (criterio de caché), concentra la traducción de errores en un solo lugar y, en el paso 10, solo cambia este archivo para usar Redis.

## 4. Criterios de aceptación (probados en PostgreSQL 16 con roles y RLS como Supabase)

| # | Caso | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | Migración ejecutada dos veces | Sin errores | ✔ |
| 2 | Registrar un local válido como visitante | Queda `pending_review`, no aparece en el mapa | ✔ |
| 3 | Aprobar con SQL | Aparece en el catálogo con deportes, techada, precio y teléfono `+51...` | ✔ |
| 4 | Mismo nombre en el mismo distrito / a 25 m | `LOCAL_DUPLICADO` (409) | ✔ |
| 5 | Coordenadas de Lima | `FUERA_DE_HUAMANGA` (400) | ✔ |
| 6 | Distrito rural inactivo / inexistente | `DISTRITO_NO_ACTIVO` / `DISTRITO_NO_ENCONTRADO` | ✔ |
| 7 | Visitante intenta `INSERT` o `UPDATE` directo en `venues` | Bloqueado por RLS | ✔ |
| 8 | Más de 100 registros en una hora | `DEMASIADAS_PROPUESTAS` (429) | ✔ |
| 9 | `/migrar` con 5 canchas en el navegador (1 sin distrito, 1 repetida) | 4 subidas, 1 "Ya estaba", se pueden quitar del navegador | ✔ |
| 10 | Sin `.env.local` / Supabase caído | Mensaje claro, código 500 / 502 | ✔ |
| 11 | Editar una cancha en revisión con datos inválidos (fuera de Huamanga) | Error y la versión anterior **se conserva** | ✔ |
| 12 | Editar / quitar una cancha ya aprobada | `PROPUESTA_NO_ENCONTRADA`, no cambia nada | ✔ |
| 13 | En el mapa real: agregar → editar → nombre repetido → quitar → aprobar con SQL | Pin gris "En revisión", formulario abierto ante errores; tras aprobar, pin naranja y los ejemplos se ocultan | ✔ |

## 5. Tareas

- [x] Migración `004_web_catalogo.sql`
- [x] API `/api/canchas` (GET con caché, POST)
- [x] Hook `useCanchas()` y `proponerCancha()`
- [x] Página `/migrar`
- [x] Ejecutar 004 en Supabase y configurar `.env.local`
- [x] Migración `005_web_propuestas.sql` y API `PUT`/`DELETE /api/canchas/:id`
- [x] Conectar el mapa a `useCanchas()` y "+ Agregar cancha", "Editar" y "Quitar" a Supabase
- [ ] Ejecutar 005 en Supabase
- [ ] Registrar las canchas reales y aprobarlas
