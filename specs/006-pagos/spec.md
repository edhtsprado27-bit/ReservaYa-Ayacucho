# 006 · Pago del adelanto con Yape/Plin y lectura del comprobante con IA

> **Estado:** implementado y probado · **Fecha:** 18/11/2026

## 1. Historias de usuario

- **Jugador:** después de reservar quiero ver a qué Yape o Plin pagar el adelanto, subir la captura y saber si el local ya la confirmó.
- **Dueño:** quiero registrar mi Yape/Plin y confirmar o rechazar cada pago desde el celular, con la captura y una lectura automática que me ahorre tiempo.
- **Administrador:** quiero ver y revisar los pagos de los locales que administra la plataforma.

## 2. Requisitos

| Código | Requisito |
|---|---|
| RF-1 | En `/dueno`, el dueño (o el admin para los locales publicados) guarda Yape, Plin (opcional) y el titular de cada local. Celular peruano de 9 dígitos; si hay celular, el titular es obligatorio. |
| RF-2 | En `/reservas/{id}` "Por pagar": cuenta regresiva, monto del adelanto, Yape/Plin del local con botón Copiar y el titular. |
| RF-3 | El jugador elige Yape o Plin y sube la captura (JPG, PNG o WEBP, máx. 3 MB). El navegador la reduce a 1600 px antes de enviarla. |
| RF-4 | Al enviar, la reserva pasa a **Pago en revisión** y la hora sigue apartada (ya no vence sola). La página se actualiza sola cada 20 s. |
| RF-5 | La IA lee app, monto, N° de operación, fecha/hora y destinatario. La base compara con lo esperado y deja una recomendación: coincide, monto menor, otro destinatario, fecha distinta, comprobante repetido o no se pudo leer. |
| RF-6 | En `/dueno`, "Pagos por revisar" muestra la captura, los datos de la reserva y del jugador, lo que leyó la IA y la indicación de buscar la operación en su app. |
| RF-7 | **Confirmar:** pago aprobado, reserva **Confirmada** y el monto se suma a lo pagado. **Rechazar** (con motivo): el jugador ve el motivo y recibe un nuevo plazo de `hold_minutes` para enviar otra captura. |
| RF-8 | Un mismo N° de operación o la misma imagen no se aceptan dos veces como válidos: se marcan como "comprobante repetido". |
| RNF-1 | **Seguridad:** capturas en un bucket **privado** de Supabase Storage con RLS (sube solo el jugador de esa reserva; ven el jugador, el dueño del local y el admin). El dueño ve la imagen con enlaces firmados de 15 min. |
| RNF-2 | `payments`, `receipt_extractions`, `ai_requests` y `ai_model_configs` no se abren a la API: todo pasa por funciones `SECURITY DEFINER`. |
| RNF-3 | **IA (OpenRouter):** la clave `OPENROUTER_API_KEY` vive solo en el servidor. Respuesta con JSON Schema (`response_format: json_schema`), `require_parameters: true` y `data_collection: "deny"` (proveedores que no guardan ni entrenan con los datos). |
| RNF-4 | **Modelo configurable sin publicar:** `ai_model_configs` (feature `receipt_ocr`), temperatura 0, prompt versionado (`ocr-v1`); si el principal falla se usa el respaldo. De pago (008): `google/gemini-3.1-flash-lite` → `google/gemini-2.5-flash-lite`. **Gratis (009, el que usa el proyecto por ahora):** `google/gemma-4-31b-it:free` (no entrena con los datos) → `nvidia/nemotron-3.5-super-vl:free` → `openrouter/free`, máx. 50 lecturas por día. Con modelos gratis no se puede pedir `data_collection: deny`: se envían sin esa opción y los respaldos necesitan permitir en OpenRouter los proveedores gratis que pueden entrenar (aceptable para el curso con capturas de prueba; con clientes reales, volver al de pago). |
| RNF-5 | **Trazabilidad y costo:** cada lectura queda en `ai_requests` (modelo pedido y usado, tokens, costo en USD, tiempo, estado y error) y en `receipt_extractions` (lo leído y el resultado). |
| RNF-6 | **Tolerancia a fallas:** sin clave, sin crédito o si la IA tarda más de 25 s, el pago se guarda igual como "submitted" y el dueño revisa a mano. |
| RNF-7 | La lectura es una ayuda: quien confirma es el dueño mirando su propia app. El prompt ordena ignorar instrucciones escritas dentro de la imagen. |

## 3. Plan técnico

```
Jugador (/reservas/{id})
  └─ PagoAdelanto: achica la imagen ──▶ POST /api/reservas/{id}/pago (multipart)
        1. fn_estado_pago        ¿es tuya y sigue por pagar? (antes de gastar en IA)
        2. Storage "comprobantes"  {reserva}/{sha256}.jpg   (RLS: fn_puede_subir_comprobante)
        3. OpenRouter            /chat/completions + imagen base64 + JSON Schema
                                  (principal → respaldo; 25 s por modelo)
        4. verificar.ts          destinatario parecido, fecha a hora de Perú, N° de operación
        5. fn_registrar_pago     ai_requests + payments + receipt_extractions
                                  resultado (match / amount_mismatch / ...) · reserva → payment_review
Dueño (/dueno)
  ├─ fn_pagos_por_revisar + enlaces firmados de las capturas
  ├─ POST /api/pagos/{id}/revisar  ──▶ fn_revisar_pago  (confirmar / rechazar con motivo)
  └─ PUT  /api/locales/{id}/pago   ──▶ fn_guardar_datos_pago
```

| Archivo | Responsabilidad |
|---|---|
| `database/migrations/008_pagos.sql` | Bucket y políticas, datos de pago, registrar, revisar, pagos por revisar, configuración de IA |
| `apps/web/src/lib/pagos/ocr.ts` | Llamada a OpenRouter con respaldo, tiempo límite y registro de costo |
| `apps/web/src/lib/pagos/verificar.ts` | Reglas puras (nombre del destinatario, fecha, operación, monto, validar la respuesta de la IA) |
| `apps/web/src/lib/pagos/pagos-servidor.ts` | Revisa la imagen real (JPG/PNG/WEBP), la sube, pide la lectura y guarda |
| `apps/web/src/lib/pagos/pagos.ts` | Tipos y textos (navegador y servidor) |
| `apps/web/src/components/reservas/PagoAdelanto.tsx`, `RefrescarCada.tsx` | Pagar y esperar la revisión |
| `apps/web/src/components/dueno/RevisionPagos.tsx`, `DatosPago.tsx` | Panel del dueño |

## 4. Criterios de aceptación (probados)

Probados en PostgreSQL 16 con el esquema de Supabase y en el navegador (PC 1280×900 y celular 390×844) con OpenRouter y Storage simulados.

| # | Caso | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | Jugador intenta guardar datos de pago · celular "12345" · Yape sin titular | No se puede · "9 dígitos y empezar con 9" · "Escribe el nombre del titular" | ✔ |
| 2 | Dueño guarda "+51 966 123 456" | Se guarda 966123456 y se muestra "966 123 456" | ✔ |
| 3 | Otro jugador intenta subir una captura a tu reserva · ruta con otro formato | Storage la rechaza (RLS) | ✔ |
| 4 | Registrar sin haber subido la imagen | "No encontramos la captura" | ✔ |
| 5 | Captura correcta (S/ 40, op. 00123456, "Juan Pér*" para el titular "Juan Pérez Quispe") | Coincide · Pago en revisión · costo y tokens en `ai_requests` | ✔ |
| 6 | Enviar otra captura para la misma reserva | "Ya enviaste un comprobante" | ✔ |
| 7 | El dueño ve la captura; otro jugador no ve ni el pago ni la imagen | Correcto | ✔ |
| 8 | Rechazar sin motivo · otro usuario intenta revisar · rechazar con motivo · revisar otra vez | Pide motivo · "No encontramos ese pago" · vuelve a "Por pagar" con 15 min nuevos y el jugador ve el motivo · "ya fue revisado" | ✔ |
| 9 | Segunda captura por S/ 20 | "Monto menor"; el dueño puede confirmarla igual (pagado S/ 20, saldo S/ 60) | ✔ |
| 10 | El mismo N° de operación en otra reserva | "Comprobante repetido" | ✔ |
| 11 | Plazo vencido hace 5 min · hace 1 min (ya marcado vencido por pg_cron) | "ya venció" · se acepta y recupera la hora | ✔ |
| 12 | Fecha del comprobante de hace 3 días | "Fecha distinta" | ✔ |
| 13 | Modelo principal no disponible | Responde el de respaldo; queda `fallback_used` con el error del principal | ✔ |
| 14 | Pedido a OpenRouter | Imagen JPG en base64, `json_schema`, `require_parameters` y `data_collection: deny` (modelo de pago); sin esas exigencias y con las claves en el texto (modelo gratis) | ✔ |
| 14b | Modelos gratis: los dos primeros caídos | Responde `openrouter/free`; queda `fallback_used` | ✔ |
| 15 | Visitante sin sesión llama a las funciones o lee `payments` | Permiso denegado | ✔ |
| 16 | Historial de estados | Por pagar → En revisión → Por pagar → En revisión → Confirmada, con quién hizo cada cambio | ✔ |
| 17 | Reglas de `verificar.ts` (20 casos: nombres abreviados, tildes, fechas, montos, JSON con ```) | Todas pasan | ✔ |
| 18 | `next build` y `eslint` | Sin errores | ✔ |

## 5. Tareas

- [x] Migración `008_pagos.sql` y pruebas en PostgreSQL
- [x] Subir comprobante, lectura con IA y estados en `/reservas/{id}`
- [x] Pagos por revisar y datos de pago en `/dueno`
- [ ] Ejecutar `008_pagos.sql` en Supabase
- [ ] Ejecutar `009_ia_gratis.sql` y permitir en OpenRouter → Privacy los proveedores gratis que pueden entrenar
- [ ] Crear la clave de OpenRouter y ponerla en Vercel (`OPENROUTER_API_KEY`)
- [ ] Paso 8: convertir las pruebas de `verificar.ts` en pruebas unitarias del proyecto
