# Pruebas E2E (de punta a punta) con Playwright

> **Proyecto:** ReservaYa Ayacucho · **Herramientas:** Playwright 1.63 (Chromium), PostgreSQL 16, GitHub Actions · **Versión:** 1.0 (20/11/2026)  
> **Spec:** `specs/011-pruebas-e2e/spec.md` · **Código:** `apps/web/pruebas-e2e/` y `apps/web/playwright.config.ts`

---

## 1. Objetivo

Comprobar que la web completa funciona **como la usa una persona**: un navegador real abre las páginas, escribe en los formularios, toca los botones y revisa lo que aparece en pantalla. Las pruebas de Jest ([`01-pruebas-automatizadas.md`](01-pruebas-automatizadas.md)) revisan cada pieza por separado; las E2E revisan que todas las piezas juntas (pantallas, API, base de datos, sesión, archivos y caché) den el resultado correcto.

---

## 2. Cómo funcionan

```
Playwright (Chromium)  ──▶  Web de ReservaYa compilada (next build + next start, SIN cambios)
   jugador / dueño /              │
   administrador                  ▼
                           Supabase de pruebas (pruebas-e2e/supabase-de-pruebas/servidor.mjs)
                             /auth/v1     registro e inicio de sesión con JWT
                             /rest/v1     funciones de PostgreSQL y la consulta de "Publicadas"
                             /storage/v1  subir la captura del pago y verla con enlace firmado
                                  │  cada pedido con el rol anon/authenticated y el usuario del JWT
                                  ▼
                           PostgreSQL 16 con database/supabase_inicial.sql + migraciones 004 a 011
```

| Pieza | ¿Real o de prueba? |
|---|---|
| Páginas, componentes, rutas `/api`, casos de uso y repositorios | **Reales**: la misma compilación que va a Vercel, sin parches |
| Esquema, funciones `SECURITY DEFINER`, RLS, `EXCLUDE` anti doble reserva, triggers | **Reales**: se ejecuta el mismo SQL que en Supabase, en el mismo orden |
| Inicio de sesión | **Real desde el navegador**: formulario de `/login`, cookies de `@supabase/ssr` y JWT firmado |
| Servidor HTTP de Supabase (Auth, PostgREST, Storage) | **De prueba**: `servidor.mjs` responde en las mismas direcciones y con el mismo formato, y ejecuta cada pedido con el rol y el usuario del JWT, como PostgREST |
| Lectura del comprobante con IA (OpenRouter) | **Apagada**: sin clave, el pago queda para revisión manual (camino de respaldo RNF-6 de la spec 006) |
| Correos de Supabase | No se envían (la confirmación por correo está desactivada, igual que en el proyecto) |

¿Por qué no un Supabase completo en Docker? Se puede (Supabase CLI), pero descarga una decena de imágenes y tarda varios minutos en cada ejecución. Con el servidor de prueba, todo el SQL del proyecto se prueba igual, el CI tarda menos y el resultado es el mismo en GitHub Actions y en cualquier PC con PostgreSQL.

### Datos de prueba (`datos-e2e.sql` y `preparar-base.mjs`)

| Cuenta | Rol | Para qué |
|---|---|---|
| `admin@e2e.pe` | Administrador | Aprobar, asignar dueño, suspender |
| `dueno@e2e.pe` (Rosa Quispe) | Dueño de **Complejo Los Andes** | Agenda, configuración, confirmar pagos |
| `dueno2@e2e.pe` (Mario Cárdenas) | Dueño sin locales | Recibe "La Canchita del Barrio" |
| `jugador2@e2e.pe`, `jugador3@e2e.pe` | Jugadores | Doble reserva simultánea |
| Una cuenta nueva por ejecución | Jugador | Se registra durante la prueba |

Las contraseñas solo existen en esa base de pruebas (se guardan cifradas con scrypt). Locales: **Complejo Los Andes** (publicado, Yape configurado; Cancha 1 fútbol S/ 60 y S/ 80 desde las 18:00, Cancha 2 vóley S/ 40), **La Canchita del Barrio** (publicada, sin dueño) y **Grass Pendiente** (en revisión). Todas atienden de 06:00 a 23:00. Las pruebas usan siempre el día de **mañana** para tener todas las horas por delante.

---

## 3. Qué se prueba

| # | Archivo | Prueba | Qué comprueba |
|---|---|---|---|
| 1 | `sesiones.setup.ts` | Contraseña equivocada | El formulario real muestra "Correo o contraseña incorrectos." |
| 2–6 | `sesiones.setup.ts` | Iniciar sesión como admin, dueño, dueño 2, jugador 2 y jugador 3 | Login real; la sesión se guarda y la usan las demás pruebas |
| 7 | `admin.spec.ts` | Aprobar una cancha en revisión | Desaparece de "por aprobar" y aparece en el mapa al instante |
| 8 | `admin.spec.ts` | Asignar el dueño real por correo | Correo sin cuenta → mensaje claro; con cuenta → el nuevo dueño ve el local en su configuración |
| 9 | `admin.spec.ts` | Suspender y reactivar | Sin motivo no deja; suspendido sale del mapa y su ficha no se encuentra; el dueño ve el motivo; al reactivar vuelve |
| 10 | `admin.spec.ts` | Accesos | Un jugador no entra a `/admin` ni a `/dueno/agenda` (vuelve a Mi cuenta) y la API responde 403; un visitante va al login |
| 11 | `doble-reserva.spec.ts` | **Dos jugadores reservan la misma hora a la vez** | Exactamente uno lo logra; el otro ve "Alguien acaba de reservar ese horario" y la hora ya marcada como ocupada (EQ-02 desde el navegador) |
| 12 | `dueno.spec.ts` | Agenda: reserva por teléfono, cobro y cancelación | Anota con S/ 20 en efectivo → "Falta S/ 20"; un visitante ve la hora ocupada; cobra el saldo → "Pagado S/ 40"; cancelar sin motivo no deja; con "Lluvia" la hora queda libre |
| 13 | `dueno.spec.ts` | Agenda: bloqueo por mantenimiento | El jugador ve 07:00 y 08:00 "Cerrada" y 09:00 libre; al abrir de nuevo, vuelve a estar libre |
| 14 | `dueno.spec.ts` | Configuración de una cancha | Precio S/ 45 y horario 08:00–22:00: el jugador ve el precio nuevo, ya no ve las 06:00 ni las 22:00 |
| 15 | `jugador.spec.ts` | **Recorrido completo del jugador** | Busca "andes" → ve horarios y precio de hora punta → sin sesión le pide ingresar → se registra → reserva las 19:00 → ve el Yape y el titular del local → sube la captura → "Pago en revisión" → el dueño ve la captura y confirma → en Mi cuenta aparece "Confirmada" |
| 16 | `celular.spec.ts` | En el celular (Pixel 7) | Buscar, abrir la cancha, elegir hora y ver el total, sin que la página se salga de la pantalla |

---

## 4. Resultados

Ejecución del 20/11/2026 (simulación completa del CI en una copia limpia del repositorio, y tres corridas seguidas desde una base nueva): **16 de 16 pruebas pasan, en unos 90 segundos, sin fallos al azar.**

| Evidencia | |
|---|---|
| ![Doble reserva: el segundo jugador ve el aviso y la hora ocupada](../../img/evidencias/e2e-doble-reserva.png) | **Doble reserva simultánea:** Pedro pulsó "Reservar" al mismo tiempo que Ana. La base dejó pasar solo una reserva; Pedro ve el aviso y las 21:00 ya ocupadas, sin recargar. |
| ![Reserva confirmada en Mi cuenta](../../img/evidencias/e2e-reserva-confirmada.png) | **Fin del recorrido del jugador:** después de subir la captura y de que el dueño confirmara el pago. |

<img src="../../img/evidencias/e2e-celular.png" alt="Grilla de horarios en el celular" width="320">

### Lo que encontraron las pruebas

- Al reabrir unas horas bloqueadas, **la misma pestaña** que ya tenía la grilla abierta podía seguir viendo "Cerrada" durante unos segundos al recargar. No es un error: la grilla se guarda en caché con `stale-while-revalidate` (5 s en el CDN y hasta 15 s de copia anterior) a propósito, para aguantar mucho tráfico (EQ-01, ADR-013). La reserva igual la decide la base de datos. La prueba quedó revisando como otro visitante, y el comportamiento quedó documentado aquí.

---

## 5. En GitHub Actions

El trabajo **"Pruebas E2E (Playwright)"** de `.github/workflows/ci.yml` corre después de que pasan lint, tipos, Jest y build:

| Paso | Qué hace |
|---|---|
| Servicio `postgres:16` | PostgreSQL vacío solo para esta ejecución |
| `npx playwright install --with-deps chromium` | Navegador |
| `npm run e2e:base` | Crea la base: imitación de Supabase + esquema + migraciones 004 a 011 + datos |
| `npm run build` | Compila la web apuntando al Supabase de pruebas |
| `npm run e2e` | Levanta el Supabase de pruebas y la web, y ejecuta las 16 pruebas |
| Resumen | Tabla con cada prueba en la página de la ejecución |
| Artefactos | `informe-e2e` (informe HTML de Playwright) y `evidencias-e2e` (capturas y un video por prueba), 30 días |

**Para ver la evidencia:** GitHub → **Actions** → la ejecución → abajo, en **Artifacts**, descargar `informe-e2e`, descomprimir y abrir `index.html` (cada prueba muestra sus pasos, capturas y video).

---

## 6. En tu PC (opcional)

Necesitas PostgreSQL instalado. Si tu usuario `postgres` tiene otra contraseña (no `postgres`), cámbiala en la primera línea. En `apps/web`:

```powershell
$env:E2E_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/reservaya_e2e"
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e2e"
npx playwright install chromium
npm run e2e:base
npm run build
npm run e2e
npm run e2e:informe
```

La base `reservaya_e2e` se borra y se vuelve a crear en cada `npm run e2e:base`. Después vuelve a compilar con tus valores reales de `.env.local` antes de usar `npm run dev` o `npm start`.

---

## 7. Límites

- El servidor HTTP de Supabase es de prueba: no se prueban los correos ni el inicio de sesión con enlaces (`/auth/callback`).
- La lectura del comprobante con IA no corre en E2E (se prueba con Jest con un OpenRouter falso, y se probó a mano en producción el 19/11).
- Solo Chromium (escritorio y celular). Firefox y Safari se pueden agregar como proyectos en `playwright.config.ts`.
