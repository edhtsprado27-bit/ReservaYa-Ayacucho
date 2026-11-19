# Plan de trabajo

> **Proyecto:** ReservaYa Ayacucho · **Metodología:** iteraciones cortas con Spec-Driven Development · **Versión:** 2.0

---

## 1. Fases

| Fase | Herramienta | Entregable | Estado |
|---|---|---|---|
| 1. Requerimientos | Markdown | Actores, historias, requisitos y atributos de calidad (`docs/01`) | Hecho (Sprint 1) |
| 2. Arquitectura y diseño | Markdown + Mermaid | Arquitectura, patrones, SOLID y modelo C4 (`docs/02` a `docs/04`) | Hecho; actualizado en el Sprint 2 para reflejar el código |
| 3. Modelo de datos | SQL en Supabase | Esquema inicial y migraciones (`database/`) | Hecho |
| 4. Desarrollo | VS Code + GitHub, Spec-Driven Development (`specs/`) | Código en `apps/web` organizado por módulos y capas | Primera versión funcional publicada (Sprint 2) |
| 5. Pruebas | Jest, GitHub Actions, k6 | Pruebas unitarias e integración con cobertura y CI (`docs/06`); pruebas de carga | Jest y CI hechos; k6 en curso |
| 6. Despliegue | Vercel, Supabase, Upstash, Cloudflare | Sistema publicado (`docs/05/03`) | Publicado en Vercel; dominio propio y Redis en el Sprint 2 |

---

## 2. Iteraciones de desarrollo

| Iteración | Objetivo | Historias | Resultado | Estado |
|---|---|---|---|---|
| 1 | Base del proyecto | — | Next.js 16 + Supabase; despliegue automático en Vercel | Hecho |
| 2 | Locales y mapa | HU02, HU07, HU09 | Mapa con OpenStreetMap, registro de canchas marcando el punto, aprobación del admin, «Cómo llegar» con Google Maps y Waze (spec 003) | Hecho |
| 3 | Cuentas y roles | — | Login con Supabase Auth, roles jugador, dueño y admin, paneles (spec 004) | Hecho |
| 4 | Reservas sin cruces | HU01, HU03, HU06 | Grilla de 14 días, apartado de 15 min, `EXCLUDE`, idempotencia, cancelación (spec 005) | Hecho |
| 5 | Pagos con IA | HU04, HU05 | Captura en Storage privado, lectura con OpenRouter, revisión del dueño (spec 006) | Hecho |
| 6 | Arquitectura en el código | — | Módulos con Clean Architecture, puertos y adaptadores, documentos alineados | Hecho (Sprint 2) |
| 7 | Calidad | — | Swagger y Jest + cobertura + GitHub Actions (spec 007, hechos); Redis, k6 hasta 2 000 usuarios y análisis de BD y caché | En curso (Sprint 2) |
| 8 | Paneles completos y avisos | HU08, HU10 | Agenda del dueño, precios y horarios desde la web, notificaciones | Siguiente |

---

## 3. Pantallas del frontend

| Pantalla | Usuario | Contenido |
|---|---|---|
| Inicio | Jugador | Buscador por distrito, botón «Cerca de mí» y mapa con los locales |
| Detalle del local | Jugador | Fotos, canchas, servicios, mapa, botones «Google Maps» y «Waze», calendario de horas libres |
| Confirmar reserva | Jugador | Resumen, total, cuenta regresiva de 15 minutos, número Yape/Plin y subida del comprobante |
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
