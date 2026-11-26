# 014 · Dominio propio, DNS y CDN

> **Estado:** implementado y comprobado (paso 11) · **Fecha:** 26/11/2026 · **Sprint 2**  
> **Criterio de la rúbrica:** Dominio, DNS y CDN · **Decisión:** ADR-016

## 1. Historias

- **Jugador:** quiero entrar a una dirección fácil de recordar y segura (`reservaya-ayacucho.app`), no a una dirección de prueba.
- **Equipo:** queremos que el catálogo y la grilla salgan de la CDN más cercana para que la página responda rápido sin cargar al servidor ni a la base de datos.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | La web y la API responden en `https://www.reservaya-ayacucho.app`. |
| RF-2 | `https://reservaya-ayacucho.app` (sin `www`) redirige al principal con un 308. La dirección `reservaya-ayacucho.vercel.app` sigue funcionando. |
| RF-3 | El inicio de sesión, el registro y «Olvidaste tu contraseña» funcionan en el dominio nuevo (Supabase Auth: Site URL y Redirect URLs). |
| RF-4 | Swagger (`/api-docs`) ofrece el dominio nuevo como servidor de producción. |
| RNF-1 | **Costo cero:** dominio gratis por 1 año (GitHub Student Pack en Name.com), renovación automática apagada y sin tarjeta guardada. |
| RNF-2 | **HTTPS obligatorio:** certificado automático de Vercel; `.app` está en la lista HSTS de los navegadores y Vercel envía `Strict-Transport-Security`. |
| RNF-3 | **CDN:** las respuestas públicas se guardan en la red de Vercel (catálogo 60 s + `stale-while-revalidate` 300 s; grilla 5 s + 15 s; Swagger 1 h). Lo privado nunca se guarda (`private, no-store`). |

## 3. Plan técnico

```
Navegador ──DNS (Name.com)──▶ www.reservaya-ayacucho.app  CNAME → *.vercel-dns-017.com
                              reservaya-ayacucho.app      A     → 216.198.79.1 ──308──▶ www
        ──HTTPS──▶ CDN de Vercel (gru1, São Paulo) ──si no tiene copia──▶ Next.js en Vercel ──▶ Supabase
```

| Lugar | Cambio |
|---|---|
| Name.com | Registro del dominio; DNS: `A @ → 216.198.79.1` y `CNAME www → 25ee611e40f29708.vercel-dns-017.com` |
| Vercel | Settings → Domains: `www.reservaya-ayacucho.app` (Production) y `reservaya-ayacucho.app` con redirección 308 a `www` |
| Supabase | Authentication → URL Configuration: Site URL `https://www.reservaya-ayacucho.app` y Redirect URL `https://www.reservaya-ayacucho.app/**` |
| `apps/web/public/openapi.yaml` | Servidor de producción con el dominio nuevo |
| `compartido/infraestructura/openrouter.ts` | `HTTP-Referer` por defecto con el dominio nuevo |
| `README.md`, `docs/05-implementacion/03-despliegue.md` | Dirección, configuración y evidencia |

## 4. Criterios de aceptación (comprobados el 26/11/2026)

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Vercel → Domains | Los tres dominios con ✔ (configuración válida) | ✔ |
| 2 | `nslookup www.reservaya-ayacucho.app` | Responde `25ee611e40f29708.vercel-dns-017.com` | ✔ |
| 3 | `curl.exe -sI https://reservaya-ayacucho.app` | `308` a `https://www.reservaya-ayacucho.app/` con `Strict-Transport-Security` | ✔ |
| 4 | `curl.exe -sI https://www.reservaya-ayacucho.app/api/canchas` varias veces | `MISS`, luego `STALE` (pasados 60 s) y `HIT` con `Age: 2` | ✔ |
| 5 | Iniciar sesión en el dominio nuevo | Entra a la cuenta (probado con la cuenta de administrador) | ✔ |
| 6 | Pruebas automáticas | Jest y OpenAPI siguen pasando | ✔ |

## 5. Tareas

- [x] Reclamar el dominio y apagar la renovación automática
- [x] Agregar el dominio en Vercel y los registros DNS en Name.com
- [x] Actualizar Supabase Auth
- [x] OpenAPI, README, ADR-016, despliegue, C4 nivel 2 y plan de trabajo
- [ ] Avisos automáticos por correo (RF10)
