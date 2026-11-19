# Pruebas de carga y de calidad con k6

Scripts de [k6](https://k6.io) que comprueban los escenarios de calidad del documento
`docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md` sobre la web publicada.

| Script | Escenario | Qué hace | Medida |
|---|---|---|---|
| `eq01-rendimiento.js` | EQ-01 Rendimiento | Usuarios que abren el mapa y miran la grilla de horarios | p95 ≤ 1,5 s y errores < 1 % |
| `eq02-concurrencia.js` | EQ-02 Consistencia | 50 pedidos al mismo tiempo por el mismo horario | 1 reserva creada y 49 × `409 HORARIO_OCUPADO` |
| `eq04-seguridad.js` | EQ-04 Seguridad | 16 intentos sin permiso (sin sesión y como jugador) | 100 % rechazados, sin datos sensibles |
| `comun.js` | — | Funciones compartidas (fechas, cuentas de prueba, cookie de sesión) | — |

## Perfiles de EQ-01

| `-e PERFIL=` | Usuarios virtuales | Duración | Para qué |
|---|---|---|---|
| `humo` | 5 | 35 s | Comprobar que todo responde antes de las pruebas grandes |
| `base` | 100 | 4 min | Medida de EQ-01 (100 usuarios simultáneos) |
| `sin-cdn` | 100 | 4 min | Lo mismo, pero cada pedido salta el CDN: muestra cuánto ayuda la caché |
| `progresivo` | 100 → 500 → 1 000 → 2 000 | 12 min | Carga progresiva hasta 2 000 usuarios (Sprint 2) |

Cada usuario virtual espera entre 6 y 13 segundos entre pantallas, como una persona real; por eso
2 000 usuarios generan unos 300–400 pedidos por segundo y la prueba completa unos 120 000 pedidos.

## Instalar k6 (Windows)

```powershell
winget install k6 --source winget
```

Cierra y abre PowerShell, y comprueba con `k6 version`. (Otra opción: el instalador `.msi` de https://github.com/grafana/k6/releases).

## Ejecutar

Desde la carpeta `pruebas-carga`. Cada prueba guarda dos evidencias en `resultados/`: un reporte HTML con gráficos y un resumen JSON.

```powershell
k6 run -e PERFIL=humo eq01-rendimiento.js
k6 run -e PERFIL=base -o web-dashboard=export=resultados/eq01-base.html --summary-export resultados/eq01-base.json eq01-rendimiento.js
k6 run -e PERFIL=sin-cdn -o web-dashboard=export=resultados/eq01-sin-cdn.html --summary-export resultados/eq01-sin-cdn.json eq01-rendimiento.js
k6 run -e PERFIL=progresivo -o web-dashboard=export=resultados/eq01-progresivo.html --summary-export resultados/eq01-progresivo.json eq01-rendimiento.js
```

EQ-02 y EQ-04 necesitan iniciar sesión con cuentas de jugador de prueba (`k6.jugador1@reservaya.test` … `k6.jugador5@reservaya.test`; se crean solas la primera vez). k6 lee estas variables de PowerShell. Usa la URL y la clave **pública** de Supabase que están en `apps/web/.env.local`, y una clave inventada para esas cuentas:

```powershell
$env:SUPABASE_URL = "https://<proyecto>.supabase.co"
$env:SUPABASE_CLAVE = "sb_publishable_..."
$env:K6_CLAVE = "<una clave de prueba de 8 o más caracteres>"
k6 run --summary-export resultados/eq02.json eq02-concurrencia.js
k6 run --summary-export resultados/eq04.json eq04-seguridad.js
```

Otra web (por ejemplo `npm run dev`): agrega `-e BASE_URL=http://localhost:3000`.

## Cómo leer el resultado

- Al final, k6 muestra **THRESHOLDS**: `✓` = se cumplió la medida, `✗` = no se cumplió.
- `http_req_duration{name:catalogo}` y `{name:disponibilidad}`: tiempos de respuesta (mira `p(95)`).
- `cdn_hit` / `cdn_stale` / `cdn_miss`: cuántas respuestas salieron del CDN de Vercel sin tocar el servidor.
- EQ-02 deja todo como estaba: al terminar cancela la reserva ganadora.

## Cuidados

- Las pruebas usan la web real y los planes gratuitos de Vercel y Supabase: no repitas `progresivo` muchas veces.
- Durante `progresivo` cierra otros programas: k6 usa bastante memoria con 2 000 usuarios.
- Antes y después de la carga, ejecuta la sección 7 de `database/analisis/analisis-bd.sql` para ver cuántas consultas llegaron de verdad a la base.
