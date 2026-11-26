# 015 · Copia de seguridad semanal de la base de datos

> **Estado:** implementado (paso 12) · **Fecha:** 26/11/2026 · **Para:** la prueba piloto con locales reales  
> **Decisión:** ADR-017 · **Escenario de calidad:** EQ-06 (Recuperabilidad)

## 1. Historias

- **Dueño del sistema:** si se borra o daña la base durante la prueba piloto, quiero recuperar las reservas, pagos y cuentas, perdiendo como máximo una semana.
- **Jugadores y locales:** quiero que mis datos personales no queden expuestos en ninguna copia.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | Una copia de roles, esquema y datos de la base de producción cada semana (domingo 03:17 de Ayacucho) y cuando se pida a mano. |
| RF-2 | Cada copia se prueba restaurándola en una base vacía antes de guardarla. Si no se puede restaurar, la ejecución falla y GitHub avisa por correo. |
| RF-3 | El resumen de cada ejecución muestra cuántas filas tiene cada tabla, sin mostrar datos. |
| RF-4 | Guía para restaurar en un proyecto nuevo de Supabase. |
| RNF-1 | **Confidencialidad:** la copia se cifra con GPG AES-256 antes de salir del runner; los archivos sin cifrar se borran con `shred`; nunca se suben al repositorio. Los errores de restauración se muestran sin los DETAIL, que pueden traer datos. |
| RNF-2 | **Costo cero:** GitHub Actions y artifacts del plan gratis. Se guardan 90 días (unas 13 copias semanales). |
| RNF-3 | **Secretos** solo en GitHub Actions (`SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`); la frase también se guarda fuera de GitHub. |
| RNF-4 | **Conexión IPv4:** se usa el Session pooler de Supabase, porque la conexión directa es IPv6 y GitHub no la alcanza. |

## 3. Plan técnico

| Archivo | Responsabilidad |
|---|---|
| `.github/workflows/respaldo.yml` | Revisar secretos → `supabase db dump` (roles, esquema, datos con `COPY`) → resumen de filas → restauración de prueba con `supabase db start` + `psql --single-transaction` → `tar` + `gpg --symmetric --cipher-algo AES256` → `actions/upload-artifact` (90 días) |
| `docs/05-implementacion/03-despliegue.md` §5 | Configuración de los secretos, restauración y qué no cubre |
| `docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md` | ADR-017 |
| `docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md` | EQ-06 |

Se sigue el workflow de respaldo de la documentación de Supabase («Automated backups using GitHub Actions»), con tres cambios: no se hace commit de los archivos, se cifran antes de guardarlos y la frecuencia es semanal.

## 4. Criterios de aceptación

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Resumen con un volcado de la base de pruebas | Tabla con filas por tabla (`auth.users` 7, `public.bookings` 3, …) y tamaños | ✔ (sandbox) |
| 2 | Cifrar y descifrar con la frase correcta | Se recuperan `roles.sql`, `schema.sql` y `data.sql` idénticos | ✔ (sandbox) |
| 3 | Descifrar con una frase equivocada | GPG rechaza el archivo | ✔ (sandbox) |
| 4 | Restaurar en una base vacía con `psql --single-transaction` | Restaurado sin errores; 3 reservas | ✔ (sandbox) |
| 5 | Archivos sin cifrar después del paso de cifrado | No queda ninguno | ✔ (sandbox) |
| 6 | Falta un secreto o la cadena no es del pooler | La ejecución falla con un mensaje que dice qué falta | ✔ (revisado) |
| 7 | Primera ejecución manual en GitHub con la base real | Verde, resumen con filas y artifact `reservaya-respaldo-AAAA-MM-DD.tar.gz.gpg` | Pendiente del usuario |

## 5. Tareas

- [x] Workflow `respaldo.yml`
- [x] ADR-017, EQ-06, guía de despliegue y plan de trabajo
- [ ] Crear los secretos `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE` en GitHub (usuario)
- [ ] Primera ejecución manual y prueba de descifrado (usuario)
