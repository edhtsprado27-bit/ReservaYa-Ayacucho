# API REST

> **Proyecto:** ReservaYa Ayacucho · **Base:** `https://api.reservaya.pe/api/v1` (dominio de ejemplo) · **Formato:** JSON  
> **Autenticación:** JWT en la cabecera `Authorization: Bearer <token>` · **Versión:** 1.0

---

## 1. Endpoints

### 1.1 Usuarios

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | Público | Crea una cuenta (jugador o dueño) |
| POST | `/auth/login` | Público | Devuelve el token JWT |
| GET | `/usuarios/me` | Autenticado | Datos del usuario actual |

### 1.2 Canchas y mapa

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/locales?distrito=&nombre=&servicio=` | Público | Busca locales aprobados por distrito, nombre o servicio |
| GET | `/locales/cercanos?lat=&lng=&radio=3000` | Público | Locales más cercanos al jugador (PostGIS) |
| GET | `/locales/:id` | Público | Detalle del local, canchas, fotos, coordenadas y enlaces «Cómo llegar» (Google Maps y Waze) |
| POST | `/locales` | Dueño | Registra un local; si no envía coordenadas, se geocodifica la dirección con Google Maps |
| PATCH | `/locales/:id` | Dueño del local | Actualiza datos, ubicación o números Yape/Plin |
| POST | `/locales/:id/canchas` | Dueño del local | Agrega una cancha |
| POST | `/locales/:id/fotos` | Dueño del local | Sube fotos |

### 1.3 Horarios y disponibilidad

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/canchas/:id/disponibilidad?fecha=2026-11-07` | Público | Horas libres y ocupadas del día, con el precio de cada hora |
| PUT | `/canchas/:id/horarios` | Dueño de la cancha | Define horarios de atención |
| PUT | `/canchas/:id/tarifas` | Dueño de la cancha | Define tarifas hora pico y normal |
| POST | `/canchas/:id/bloqueos` | Dueño de la cancha | Cierra un horario (mantenimiento, torneo) |

### 1.4 Reservas

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/reservas` | Jugador | Crea la reserva (`201`) o responde `409` si el horario ya está tomado |
| GET | `/reservas/mias` | Jugador | Reservas del jugador con su estado |
| GET | `/reservas/:id` | Jugador o dueño | Detalle de la reserva, monto y números Yape/Plin del dueño |
| POST | `/reservas/:id/cancelar` | Jugador | Cancela (hasta 2 horas antes) |
| GET | `/locales/:id/reservas?fecha=` | Dueño del local | Agenda del día del dueño |

### 1.5 Pagos

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/reservas/:id/comprobante` | Jugador | Sube la captura (multipart, JPG/PNG, máx. 5 MB); la IA la lee |
| GET | `/locales/:id/pagos?estado=VERIFICADO_IA` | Dueño del local | Pagos por revisar, con lo que leyó la IA |
| PATCH | `/pagos/:id` | Dueño del local | `{ "aprobado": true }` o `{ "aprobado": false, "motivo": "..." }` |

### 1.6 Asistente IA

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/asistente/chat` | Autenticado | Envía un mensaje; responde en streaming (SSE) |
| GET | `/asistente/recomendaciones?lat=&lng=&fecha=` | Autenticado | Canchas sugeridas según ubicación, horario y reservas anteriores |

### 1.7 Administración

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/admin/locales?estado=PENDIENTE` | Administrador | Locales por aprobar |
| PATCH | `/admin/locales/:id` | Administrador | Aprueba, rechaza o suspende un local |
| GET | `/admin/usuarios` | Administrador | Lista y gestiona usuarios |
| GET | `/admin/estadisticas` | Administrador | Reservas por distrito, ingresos estimados, uso y costo de IA |

---

## 2. Ejemplo: crear una reserva

```http
POST /api/v1/reservas
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "canchaId": "6f1c...", "fecha": "2026-11-07", "horaInicio": 19, "horaFin": 21 }
```

```json
// 201 Created
{
  "reservaId": "a3d2...",
  "codigo": "RY-4K7P",
  "total": 120.00,
  "expiraEn": "2026-11-01T20:58:00-05:00",
  "pago": { "yape": "987654321", "titular": "Juan Q." }
}
```

```json
// 409 Conflict
{ "codigo": "HORARIO_OCUPADO", "mensaje": "Ese horario acaba de ser reservado. Elige otro." }
```

---

## 3. Integración con OpenRouter

| Función | Modelo sugerido | Entrada | Salida esperada |
|---|---|---|---|
| Lectura de comprobante | Modelo con visión (ej. Gemini Flash o Claude) | Imagen del comprobante + monto esperado | JSON: `{ monto, fecha, numeroOperacion, titular, coincide }` |
| Chat de soporte | Modelo económico (ej. Llama 3) | Pregunta + contexto (políticas, horarios) | Texto |
| Recomendaciones | Modelo económico | Canchas cercanas disponibles (de la BD) + preferencias | Lista ordenada con motivo |

| Regla | Motivo |
|---|---|
| El modelo se elige con variables de entorno (`OPENROUTER_MODELO_OCR`, `OPENROUTER_MODELO_CHAT`) | Cambiar de modelo sin tocar código |
| La IA **nunca** confirma un pago: solo sugiere | El dueño es quien ve el abono en su Yape |
| Si OpenRouter falla, el pago queda en `SUBIDO` para revisión manual | El sistema sigue funcionando sin IA (EQ-03) |
| Las recomendaciones solo usan canchas que la API ya consultó en la BD | Evita que la IA invente canchas u horarios |
| Cada llamada se registra en `ia_uso` | Control de costos |

---

## 4. Estrategia de caché y CDN

| Capa | Qué se guarda | Tiempo | Cuándo se borra |
|---|---|---|---|
| **Cloudflare (CDN)** | Archivos estáticos de Next.js, fotos de canchas | Larga duración (archivos con hash en el nombre) | Al desplegar una nueva versión |
| **Cloudflare (CDN)** | `GET /locales` y `GET /locales/:id` (públicos) | 60 segundos | Al vencer |
| **Next.js (Vercel)** | Páginas de locales (regeneración incremental) | 5 minutos | Al editar el local |
| **Redis** | `disp:{canchaId}:{fecha}` → disponibilidad del día | 30 segundos | Al crear, cancelar o expirar una reserva de esa cancha y fecha |
| **Redis** | `bloqueo:{canchaId}:{fecha}:{hora}` → bloqueo temporal | 10 minutos | Al vencer o si la reserva falla |
| **Redis** | `limite:{usuarioId}:asistente` → límite de mensajes a la IA | 1 hora | Al vencer |
| **Ninguna** | Reservas, pagos y datos del usuario | — | Nunca se guardan en caché compartida |

> La disponibilidad **nunca** se sirve desde Cloudflare: cambia cada minuto y una copia vieja haría que el jugador vea libre un horario ocupado.

---

## 5. Códigos de respuesta

| Código | Cuándo |
|---|---|
| 200 / 201 | Operación correcta / recurso creado |
| 400 | Datos inválidos (por ejemplo, hora de fin menor que la de inicio) |
| 401 | Sin token o token vencido |
| 403 | Sin permiso (un jugador intenta validar un pago) |
| 404 | No existe |
| 409 | Horario ocupado o comprobante ya usado |
| 422 | Regla de negocio incumplida (cancelar a menos de 2 horas) |
| 429 | Demasiadas solicitudes (límite por usuario) |
