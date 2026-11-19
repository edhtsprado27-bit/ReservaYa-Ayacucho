# 008 · Pruebas de los escenarios de calidad con k6 y análisis de la base de datos

> **Estado:** implementado y ejecutado contra la web publicada · **Fecha:** 19/11/2026 · **Sprint 2**

## 1. Historias de usuario

- **Equipo de desarrollo:** quiero medir cuánto tarda la web con muchos usuarios a la vez, para saber si cumple EQ-01 y hasta dónde aguanta.
- **Equipo de desarrollo:** quiero comprobar con pedidos reales y simultáneos que nunca se crean dos reservas del mismo horario (EQ-02).
- **Equipo de desarrollo:** quiero comprobar que las operaciones protegidas se rechazan sin permiso (EQ-04).
- **Docente / revisor:** quiero ver evidencias (reportes, consultas, capturas) de que la arquitectura cumple sus atributos de calidad.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | `pruebas-carga/eq01-rendimiento.js` simula personas que abren el mapa y la grilla, con perfiles `humo`, `base` (100 usuarios), `sin-cdn` y `progresivo` (hasta 2 000 usuarios). |
| RF-2 | `pruebas-carga/eq02-concurrencia.js` envía 50 pedidos simultáneos por el mismo horario desde 5 cuentas y deja el horario libre al terminar. |
| RF-3 | `pruebas-carga/eq04-seguridad.js` intenta 8 operaciones protegidas sin sesión y como jugador, y revisa que el catálogo no cambie. |
| RF-4 | Cada prueba declara su medida como *threshold* de k6: si no se cumple, k6 termina con error. |
| RF-5 | `database/analisis/analisis-bd.sql` muestra restricciones, índices, tamaños, `EXPLAIN ANALYZE` de las consultas principales, la verificación de cruces y las consultas que llegaron a la base durante la carga. |
| RNF-1 | Ningún secreto queda en el repositorio: la URL y la clave pública de Supabase y la clave de las cuentas de prueba llegan por variables de entorno. |
| RNF-2 | Las pruebas cuidan los planes gratuitos: tiempo de lectura de 6 a 13 s por usuario (~120 000 pedidos en la prueba progresiva) y el análisis SQL solo lee. |
| RNF-3 | Las evidencias (HTML con gráficos y JSON) se guardan en `pruebas-carga/resultados/`. |

## 3. Plan técnico

```
pruebas-carga/
├── comun.js                 BASE_URL, fechas en hora de Ayacucho, cuentas de prueba,
│                            cookie de sesión igual a @supabase/ssr (base64url, partida en .0/.1)
├── eq01-rendimiento.js      ramping-vus · thresholds p95 < 1,5 s y errores < 1 % · contadores de CDN (X-Vercel-Cache)
├── eq02-concurrencia.js     per-vu-iterations (50) con salida sincronizada · 1 × 201 y 49 × 409
├── eq04-seguridad.js        16 intentos · 401/403/404 con ok:false · sin datos sensibles
└── resultados/              reportes de cada ejecución
database/analisis/analisis-bd.sql   Consultas de análisis (solo lectura)
```

La carrera de EQ-02 usa 5 cuentas porque `fn_reservar` toma un candado por persona (`pg_advisory_xact_lock`): los pedidos de la misma cuenta se atienden uno tras otro, y los de cuentas distintas compiten de verdad en el `EXCLUDE` de `bookings` (ADR-011).

## 4. Criterios de aceptación

| # | Caso | Resultado esperado | Local (Supabase simulado) | Web publicada |
|---|---|---|---|---|
| 1 | EQ-01 `base`: 100 usuarios, 4 min | p95 ≤ 1,5 s y errores < 1 % en catálogo y grilla | ✔ (perfil `humo`) | ✔ p95 171 / 494 ms, 0,02 % de errores |
| 2 | EQ-01 `sin-cdn` vs `base` | Sin CDN aumenta el tiempo y las consultas a la base | — | ✔ grilla: 2 161 consultas sin CDN; catálogo: 29 (caché en memoria) |
| 3 | EQ-01 `progresivo` hasta 2 000 usuarios | Se registra hasta dónde se cumple la medida | — | ✔ registrado: el firewall anti-DDoS de Vercel frena desde una IP (16,9 % sin respuesta); la base, 3 ms |
| 4 | EQ-02: 50 pedidos simultáneos | 1 reserva creada · 49 × `409 HORARIO_OCUPADO` · grilla "ocupado" · reserva cancelada al final | ✔ | ✔ 1 × 201 y 49 × 409 |
| 5 | EQ-04: 16 intentos sin permiso | 100 % rechazados · sin datos sensibles · catálogo igual | ✔ | ✔ 16 de 16 rechazados |
| 6 | Sección 6 de `analisis-bd.sql` | 0 reservas activas cruzadas | ✔ (PostgreSQL 16) | ✔ garantizado por el `EXCLUDE` (EQ-02) |

## 5. Tareas

- [x] Script EQ-01 con cuatro perfiles y contadores de CDN
- [x] Script EQ-02 con cuentas de prueba, horario libre automático y limpieza
- [x] Script EQ-04 con 16 intentos no autorizados
- [x] Consultas SQL de análisis (validadas en PostgreSQL 16)
- [x] Validar los scripts contra la app compilada y un Supabase simulado
- [x] Ejecutar contra https://reservaya-ayacucho.vercel.app y guardar las evidencias
- [x] Documento `docs/06-pruebas-y-calidad/02-pruebas-de-carga-y-analisis-bd.md` con los resultados reales
- [ ] Medir el límite real repartiendo la carga entre varias IP (Grafana Cloud k6)
