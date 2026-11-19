# 007 · API documentada con OpenAPI y pruebas automatizadas con CI

> **Estado:** implementado y probado · **Fecha:** 19/11/2026 · **Sprint 2**

## 1. Historias de usuario

- **Equipo de desarrollo:** quiero ver y probar los endpoints de la API en una página interactiva, para saber qué recibe y qué responde cada uno sin leer el código.
- **Equipo de desarrollo:** quiero que las reglas de negocio se prueben solas en cada cambio, para enterarme antes de publicar si algo se rompió.
- **Docente / revisor:** quiero ver un reporte de cobertura, para comprobar qué parte del código está probada.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | La especificación OpenAPI 3 de la API está en `apps/web/public/openapi.yaml` y se publica en `/openapi.yaml`. |
| RF-2 | `/api-docs` muestra la documentación interactiva con Swagger UI, agrupada por módulo (Catálogo, Reservas, Pagos). |
| RF-3 | Cada endpoint documenta parámetros, cuerpo, respuestas correctas, errores con su código y si necesita sesión. |
| RF-4 | Las pruebas se ejecutan con `npm test` y la cobertura con `npm run test:cobertura` (carpeta `coverage/`, con reporte HTML en `coverage/lcov-report/index.html`). |
| RF-5 | GitHub Actions ejecuta lint, tipos, pruebas con cobertura y build en cada push y pull request a `main`, y guarda el reporte de cobertura como artefacto. |
| RNF-1 | Swagger UI se sirve desde el propio proyecto (`public/swagger-ui/`), sin depender de un CDN externo. |
| RNF-2 | Las pruebas no usan la red ni la base real: Supabase, Storage y OpenRouter se reemplazan por implementaciones falsas. |
| RNF-3 | Cobertura mínima exigida: 80 % de líneas, sentencias y funciones, y 70 % de ramas; si baja, la prueba y el CI fallan. |
| RNF-4 | Una prueba compara las rutas del código con las de `openapi.yaml`: un endpoint nuevo sin documentar hace fallar el CI. |

## 3. Plan técnico

```
apps/web/
├── public/openapi.yaml               Especificación OpenAPI 3.0.3 (13 operaciones)
├── public/swagger-ui/                Swagger UI 5.17.14 (licencia Apache 2.0)
├── src/app/api-docs/route.ts         GET /api-docs -> página HTML con Swagger UI
├── jest.config.mjs                   next/jest (SWC), alias @/, umbrales de cobertura
└── pruebas/
    ├── apoyo/supabase-falso.ts       Supabase falso: rpc(), storage, auth y consultas
    ├── unitarias/                    Dominio, casos de uso, adaptadores y repositorios
    └── integracion/                  Rutas /api reales + coherencia con OpenAPI
.github/workflows/ci.yml              Lint · tipos · Jest con cobertura · build
```

Los casos de uso reciben sus puertos por parámetro (Clean Architecture), así que se prueban con implementaciones falsas en memoria. Las pruebas de integración llaman a las funciones `GET`/`POST`/`PUT`/`DELETE` de cada `route.ts` con un `Request` real; solo se reemplazan los clientes de Supabase.

## 4. Criterios de aceptación (probados)

| # | Caso | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | `openapi.yaml` validado con Redocly CLI | Válido (sin errores) | ✔ |
| 2 | Abrir `/api-docs` en el navegador | Se ven las 13 operaciones en 3 grupos | ✔ |
| 3 | Agregar una ruta al código sin documentarla | La prueba `openapi.test.ts` falla | ✔ |
| 4 | Reglas de verificación del comprobante (nombres abreviados, fechas, montos, JSON de la IA) | Pasan | ✔ |
| 5 | Enviar comprobante: id inválido, imagen grande o falsa, reserva ajena, pago ya enviado, sin permiso en Storage, IA caída | Cada caso responde su error o sigue a revisión manual | ✔ |
| 6 | Caché del catálogo: 3 visitas seguidas, 3 visitas a la vez, al vencer, al aprobar | 1 consulta · 1 consulta · vuelve a consultar · se renueva | ✔ |
| 7 | `POST /api/reservas` con choque en la base | `409 HORARIO_OCUPADO` | ✔ |
| 8 | `POST /api/reservas` con datos inválidos | `400` y no llega a la base | ✔ |
| 9 | OpenRouter: modelo principal caído, todos caídos, demora, modelo gratis vs. de pago | Respaldo · revisión manual · `timeout` · filtros de privacidad correctos | ✔ |
| 10 | `npm run test:cobertura` | 138 pruebas pasan · 98,3 % de líneas | ✔ |
| 11 | `npm run lint`, `npm run typecheck` y `npm run build` | Sin errores | ✔ |

## 5. Tareas

- [x] Especificación OpenAPI de los 10 endpoints (13 operaciones) y página `/api-docs`
- [x] Configurar Jest con `next/jest` y umbrales de cobertura
- [x] Pruebas unitarias del dominio, casos de uso, repositorios y adaptadores
- [x] Pruebas de integración de las rutas `/api`
- [x] Workflow de GitHub Actions con resumen y artefacto de cobertura
- [ ] Pruebas E2E en el navegador (Playwright) de los flujos principales
- [x] Pruebas de carga con k6 (escenarios EQ-01, EQ-02 y EQ-04): spec 008
