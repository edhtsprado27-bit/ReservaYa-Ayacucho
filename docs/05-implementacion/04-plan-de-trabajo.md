# Plan de trabajo

> **Proyecto:** ReservaYa Ayacucho · **Metodología:** iteraciones de 1 semana · **Versión:** 1.0

---

## 1. Fases

| Fase | Herramienta | Entregable | Estado |
|---|---|---|---|
| 1. Requerimientos | Notion | Actores, historias, requisitos y atributos de calidad (`docs/01`) | Hecho |
| 2. Arquitectura y diseño | Markdown + Mermaid | Arquitectura, patrones, SOLID y modelo C4 (`docs/02` a `docs/04`) | Hecho |
| 3. Modelo de datos | dbdiagram.io → DataGrip | Diagrama E-R y SQL ejecutado en Supabase (`docs/05/01`) | Por hacer |
| 4. Desarrollo | VS Code + GitHub | Código en `tecnologia/frontend` y `tecnologia/backend` | Por hacer |
| 5. Pruebas | Jest + k6 | Pruebas unitarias, de concurrencia y de rendimiento | Por hacer |
| 6. Despliegue | Vercel, Render, Supabase, Upstash, Cloudflare | Sistema publicado con dominio propio (`docs/05/03`) | Por hacer |

---

## 2. Iteraciones de desarrollo

| Iteración | Objetivo | Historias | Tareas principales |
|---|---|---|---|
| 1 | Base del proyecto | — | Crear monorepo, NestJS y Next.js con Clean Architecture; conectar Supabase y Redis; autenticación JWT con roles |
| 2 | Locales y mapa | HU02, HU07, HU09 | Registro de locales con Google Maps (marcar punto o geocodificar), aprobación del administrador, mapa de locales y botones Google Maps / Waze |
| 3 | Búsqueda y disponibilidad | HU01 | Búsqueda por distrito, nombre y cercanía (PostGIS); horarios, tarifas pico/normal; disponibilidad con caché en Redis |
| 4 | Reservas sin cruces | HU03, HU06 | Módulo Reservas (nivel 4), bloqueo en Redis, restricción `EXCLUDE`, cancelación, tarea de expiración |
| 5 | Pagos con IA | HU04, HU05 | Subida a Supabase Storage, lectura con OpenRouter, panel del dueño para validar |
| 6 | Notificaciones y asistente | HU08, HU10 | Correos con Resend, recordatorios, chat y recomendaciones con OpenRouter |
| 7 | Calidad y despliegue | — | Pruebas EQ-01 a EQ-05, Cloudflare, monitoreo, datos reales de Huamanga, demostración |

---

## 3. Pantallas del frontend

| Pantalla | Usuario | Contenido |
|---|---|---|
| Inicio | Jugador | Buscador por distrito, botón «Cerca de mí» y mapa con los locales |
| Detalle del local | Jugador | Fotos, canchas, servicios, mapa, botones «Google Maps» y «Waze», calendario de horas libres |
| Confirmar reserva | Jugador | Resumen, total, contador de 10 minutos, número Yape/Plin y subida del comprobante |
| Mis reservas | Jugador | Estado de cada reserva, cancelar, cómo llegar |
| Asistente | Jugador | Chat con la IA |
| Mis locales | Dueño | Registro con mapa para marcar la ubicación, canchas, horarios y tarifas |
| Agenda | Dueño | Reservas del día por cancha |
| Pagos por revisar | Dueño | Comprobante, lo que leyó la IA y botones Aprobar / Rechazar |
| Panel | Administrador | Locales por aprobar, usuarios y estadísticas |

---

## 4. Definición de terminado

| # | Criterio |
|---|---|
| 1 | La funcionalidad cumple la historia de usuario y sus requisitos |
| 2 | Respeta la estructura de Clean Architecture y las reglas del monolito modular |
| 3 | Tiene pruebas unitarias del dominio y del caso de uso |
| 4 | Funciona en el celular (pantalla de 360 px) |
| 5 | Está desplegada en el entorno de producción |
