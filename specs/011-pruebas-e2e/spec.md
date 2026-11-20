# 011 · Pruebas E2E con Playwright en el CI

> **Estado:** implementado y probado · **Fecha:** 20/11/2026

## 1. Historias de usuario

- **Equipo de desarrollo:** quiero que, en cada push, un navegador recorra la web como jugador, dueño y administrador, para enterarme si un cambio rompe un flujo completo aunque cada pieza por separado funcione.
- **Equipo de desarrollo:** quiero ver la doble reserva simultánea desde el navegador, no solo con k6.
- **Docente / revisor:** quiero evidencia (informe, capturas y videos) de que los flujos principales funcionan de punta a punta.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | Recorrido del jugador: buscar, ver horarios con precio de hora punta, registrarse desde "Ingresa para reservar", reservar, ver el Yape del local, subir la captura y ver la reserva confirmada después de que el dueño confirme. |
| RF-2 | Dueño: agenda (reserva por teléfono con pago en efectivo, cobro del saldo, cancelación con motivo, bloqueo por mantenimiento) y configuración (precio y horario); cada cambio se comprueba como visitante. |
| RF-3 | Administrador: aprobar una cancha, asignar el dueño real por correo (incluido un correo sin cuenta), suspender y reactivar. |
| RF-4 | Dos jugadores pulsan "Reservar" en la misma hora al mismo tiempo: solo uno lo logra y el otro ve el aviso y la hora ocupada. |
| RF-5 | Accesos: un jugador no entra a los paneles (redirección y API 403); un visitante va al login. |
| RF-6 | Celular (Pixel 7): buscar, abrir la cancha y elegir hora sin desbordar la pantalla. |
| RNF-1 | **App sin cambios:** se prueba la misma compilación que va a producción; nada en `src/` sabe que existen las pruebas. |
| RNF-2 | **Base real:** PostgreSQL 16 con `database/supabase_inicial.sql` y todas las migraciones, en orden, más datos de prueba. RLS, funciones y `EXCLUDE` son los de producción. |
| RNF-3 | **Sin tocar Supabase de producción** ni usar claves reales: la base y las cuentas existen solo durante la prueba. |
| RNF-4 | **Determinismo:** base nueva en cada ejecución, un trabajador, sin reintentos; tres corridas seguidas sin fallos. |
| RNF-5 | **Evidencia:** captura y video de cada prueba, informe HTML, resumen en la página de la ejecución y anotaciones de GitHub si algo falla. |

## 3. Plan técnico

```
apps/web/
├── playwright.config.ts            proyectos: sesiones → escritorio (Desktop Chrome) y celular (Pixel 7)
│                                   webServer: Supabase de pruebas + next start
└── pruebas-e2e/
    ├── supabase-de-pruebas/
    │   ├── 00-imitar-supabase.sql  roles anon/authenticated, auth.users + auth.uid(), storage.*
    │   ├── preparar-base.mjs       crea la base: imitación + esquema + migraciones + cuentas + datos
    │   ├── datos-e2e.sql           3 locales, 4 canchas, Yape, horarios 06:00–23:00
    │   ├── comun.mjs               JWT HS256 y contraseñas scrypt (solo pruebas)
    │   └── servidor.mjs            /auth/v1, /rest/v1 (rpc + venues), /storage/v1 con el rol del JWT
    ├── apoyo.ts                    cuentas, sesiones guardadas, "mañana" en hora de Lima, grilla
    ├── sesiones.setup.ts           login real de cada cuenta → .sesiones/<rol>.json
    ├── admin.spec.ts · doble-reserva.spec.ts · dueno.spec.ts · jugador.spec.ts · celular.spec.ts
    ├── resumen-ci.mjs              tabla de resultados para GitHub Actions
    └── archivos/captura-yape.png   captura de ejemplo
.github/workflows/ci.yml            trabajo "e2e" (needs: calidad) con servicio postgres:16
```

Decisión: se descartó levantar Supabase completo con Docker en cada ejecución (más lento, una decena de imágenes) y se descartó probar contra producción (ensucia datos reales y depende de la red y del firewall de Vercel). El servidor de prueba solo reemplaza la capa HTTP; todo lo que decide la seguridad y el negocio está en PostgreSQL y se ejecuta de verdad.

## 4. Criterios de aceptación (probados)

| # | Caso | Resultado |
|---|---|---|
| 1 | `npm run e2e:base` en una base vacía | Imitación + esquema + 8 migraciones + 6 cuentas + datos, sin errores (~200 ms) ✔ |
| 2 | Login con contraseña equivocada / correcta | Mensaje claro / sesión guardada para 5 cuentas ✔ |
| 3 | Las 16 pruebas en una copia limpia del repo con `CI=1` (Playwright levanta los servidores) | 16/16 en ~90 s ✔ |
| 4 | Tres corridas seguidas desde una base nueva | 16/16 cada vez, sin fallos al azar ✔ |
| 5 | La prueba de doble reserva | 1 "reservó" + 1 "ocupado" y la hora marcada como ocupada ✔ |
| 6 | Lint, tipos y Jest con los archivos nuevos | Sin errores; Jest no toma las pruebas E2E ✔ |

Hallazgo documentado en `docs/06-pruebas-y-calidad/03-pruebas-e2e.md`: la misma pestaña puede ver la grilla anterior hasta 15 s por la caché `stale-while-revalidate` (comportamiento esperado).

## 5. Tareas

- [x] Supabase de pruebas (Auth con JWT, RPC, consulta de locales, Storage con RLS)
- [x] Base de pruebas desde el SQL real del proyecto
- [x] 16 pruebas: sesiones, jugador, dueño, administrador, doble reserva, accesos y celular
- [x] Trabajo E2E en GitHub Actions con artefactos y resumen
- [x] Documento `docs/06-pruebas-y-calidad/03-pruebas-e2e.md` con evidencias
- [ ] Firefox y WebKit como proyectos adicionales
- [ ] Probar también contra Supabase local (CLI + Docker) en una ejecución semanal
