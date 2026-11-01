# Modelo de datos

> **Proyecto:** ReservaYa Ayacucho · **Base de datos:** PostgreSQL 15+ con PostGIS (Supabase)  
> **Herramientas:** dbdiagram.io (diseño E-R) → DataGrip (ejecución y gestión SQL) · **Versión:** 1.0

---

## 1. Objetivo

Definir las tablas, relaciones y restricciones que necesita el sistema para funcionar, indicando **qué módulo es dueño de cada tabla** (regla 3 del monolito modular: un módulo no escribe las tablas de otro).

---

## 2. Tablas por módulo

| Módulo | Tablas | Qué guarda |
|---|---|---|
| Usuarios | `usuarios` | Cuentas, rol y datos de contacto |
| Canchas | `locales`, `canchas`, `servicios`, `cancha_servicios`, `fotos` | Locales con ubicación (PostGIS), canchas y servicios |
| Horarios | `horarios_atencion`, `tarifas`, `bloqueos_manuales` | Horas de atención, precios pico/normal y horarios cerrados por el dueño |
| Reservas | `reservas` | Reservas con su rango de tiempo y estado |
| Pagos | `pagos` | Comprobantes, lectura de la IA y validación del dueño |
| Asistente IA | `ia_conversaciones`, `ia_mensajes`, `ia_uso` | Chat con el asistente y consumo de OpenRouter (tokens y costo) |
| Notificaciones | `notificaciones` | Correos enviados y su estado |

---

## 3. Diagrama E-R (código para dbdiagram.io)

> Copiar en https://dbdiagram.io para ver y exportar el diagrama.

```dbml
Enum rol_usuario {
  JUGADOR
  DUENO
  ADMIN
}

Enum estado_local {
  PENDIENTE
  APROBADO
  RECHAZADO
  SUSPENDIDO
}

Enum tipo_tarifa {
  NORMAL
  PICO
}

Enum estado_reserva {
  PENDIENTE_PAGO
  EN_VERIFICACION
  CONFIRMADA
  RECHAZADA
  CANCELADA
  EXPIRADA
}

Enum estado_pago {
  SUBIDO
  VERIFICADO_IA
  OBSERVADO_IA
  APROBADO
  RECHAZADO
}

Enum metodo_pago {
  YAPE
  PLIN
}

Table usuarios {
  id uuid [pk]
  nombre varchar(120) [not null]
  email varchar(160) [not null, unique]
  telefono varchar(15)
  password_hash text [not null]
  rol rol_usuario [not null, default: 'JUGADOR']
  activo boolean [not null, default: true]
  creado_en timestamptz [not null, default: `now()`]
}

Table locales {
  id uuid [pk]
  dueno_id uuid [not null, ref: > usuarios.id]
  nombre varchar(120) [not null]
  distrito varchar(60) [not null, note: 'Ayacucho, Carmen Alto, San Juan Bautista, Jesús Nazareno, Andrés Avelino Cáceres...']
  direccion varchar(200) [not null]
  referencia varchar(200)
  ubicacion "geography(Point,4326)" [not null, note: 'Coordenadas obtenidas de Google Maps una sola vez']
  google_place_id varchar(120)
  numero_yape varchar(15)
  numero_plin varchar(15)
  titular_pago varchar(120) [note: 'Nombre que debe aparecer en el comprobante']
  estado estado_local [not null, default: 'PENDIENTE']
  creado_en timestamptz [not null, default: `now()`]
  indexes {
    distrito
    estado
  }
}

Table canchas {
  id uuid [pk]
  local_id uuid [not null, ref: > locales.id]
  nombre varchar(80) [not null]
  tipo varchar(30) [note: 'Fútbol 6, Fútbol 8, Vóley...']
  capacidad_jugadores smallint
  activa boolean [not null, default: true]
}

Table servicios {
  id smallint [pk]
  nombre varchar(60) [not null, unique, note: 'Iluminación, Vestuarios, Estacionamiento, Duchas']
}

Table cancha_servicios {
  cancha_id uuid [ref: > canchas.id]
  servicio_id smallint [ref: > servicios.id]
  indexes {
    (cancha_id, servicio_id) [pk]
  }
}

Table fotos {
  id uuid [pk]
  local_id uuid [not null, ref: > locales.id]
  url text [not null, note: 'Ruta en Supabase Storage']
  orden smallint [default: 0]
}

Table horarios_atencion {
  id uuid [pk]
  cancha_id uuid [not null, ref: > canchas.id]
  dia_semana smallint [not null, note: '0 = domingo ... 6 = sábado']
  hora_apertura smallint [not null]
  hora_cierre smallint [not null]
}

Table tarifas {
  id uuid [pk]
  cancha_id uuid [not null, ref: > canchas.id]
  tipo tipo_tarifa [not null]
  dia_semana smallint [note: 'NULL = todos los días']
  hora_inicio smallint [not null]
  hora_fin smallint [not null]
  precio_hora numeric(8,2) [not null]
}

Table bloqueos_manuales {
  id uuid [pk]
  cancha_id uuid [not null, ref: > canchas.id]
  rango tstzrange [not null, note: 'Mantenimiento, torneo, etc.']
  motivo varchar(120)
}

Table reservas {
  id uuid [pk]
  codigo varchar(10) [not null, unique, note: 'Código corto para el jugador, ej. RY-4K7P']
  jugador_id uuid [not null, ref: > usuarios.id]
  cancha_id uuid [not null, ref: > canchas.id]
  rango tstzrange [not null, note: '[inicio, fin)']
  precio_hora numeric(8,2) [not null]
  total numeric(8,2) [not null]
  estado estado_reserva [not null, default: 'PENDIENTE_PAGO']
  expira_en timestamptz [not null]
  recordatorio_enviado boolean [not null, default: false]
  creado_en timestamptz [not null, default: `now()`]
  indexes {
    jugador_id
    (cancha_id, estado)
    expira_en
  }
}

Table pagos {
  id uuid [pk]
  reserva_id uuid [not null, unique, ref: - reservas.id]
  metodo metodo_pago [not null]
  comprobante_url text [not null]
  monto_leido numeric(8,2)
  numero_operacion varchar(30) [unique, note: 'Evita que se reutilice el mismo comprobante']
  fecha_leida timestamptz
  resultado_ia jsonb [note: 'Respuesta completa del modelo']
  modelo_ia varchar(80)
  estado estado_pago [not null, default: 'SUBIDO']
  validado_por uuid [ref: > usuarios.id]
  validado_en timestamptz
  motivo_rechazo varchar(200)
  creado_en timestamptz [not null, default: `now()`]
}

Table ia_conversaciones {
  id uuid [pk]
  usuario_id uuid [not null, ref: > usuarios.id]
  creado_en timestamptz [not null, default: `now()`]
}

Table ia_mensajes {
  id uuid [pk]
  conversacion_id uuid [not null, ref: > ia_conversaciones.id]
  rol varchar(10) [not null, note: 'user | assistant']
  contenido text [not null]
  creado_en timestamptz [not null, default: `now()`]
}

Table ia_uso {
  id uuid [pk]
  usuario_id uuid [ref: > usuarios.id]
  funcion varchar(30) [not null, note: 'CHAT | RECOMENDACION | OCR_COMPROBANTE']
  modelo varchar(80) [not null, note: 'ej. meta-llama/llama-3.1-8b-instruct']
  tokens_entrada int
  tokens_salida int
  costo_usd numeric(10,6)
  latencia_ms int
  exito boolean [not null]
  creado_en timestamptz [not null, default: `now()`]
}

Table notificaciones {
  id uuid [pk]
  usuario_id uuid [not null, ref: > usuarios.id]
  reserva_id uuid [ref: > reservas.id]
  tipo varchar(30) [not null, note: 'CONFIRMACION | RECHAZO | CANCELACION | RECORDATORIO']
  canal varchar(15) [not null, default: 'CORREO']
  enviado boolean [not null, default: false]
  error text
  creado_en timestamptz [not null, default: `now()`]
}
```

---

## 4. Restricciones e índices clave (SQL para DataGrip)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Nunca dos reservas activas cruzadas en la misma cancha (control de concurrencia final)
ALTER TABLE reservas
  ADD CONSTRAINT reservas_sin_cruce
  EXCLUDE USING gist (cancha_id WITH =, rango WITH &&)
  WHERE (estado IN ('PENDIENTE_PAGO', 'EN_VERIFICACION', 'CONFIRMADA'));

-- 2. Búsqueda "cerca de mí" rápida
CREATE INDEX idx_locales_ubicacion ON locales USING gist (ubicacion);

-- 3. Horas válidas
ALTER TABLE tarifas ADD CONSTRAINT tarifa_horas_validas
  CHECK (hora_inicio BETWEEN 0 AND 23 AND hora_fin BETWEEN 1 AND 24 AND hora_fin > hora_inicio);

-- 4. Reservas que la tarea programada debe expirar
CREATE INDEX idx_reservas_por_expirar ON reservas (expira_en) WHERE estado = 'PENDIENTE_PAGO';
```

### Consulta: canchas a menos de 3 km del jugador

```sql
SELECT l.id, l.nombre, l.distrito,
       ST_Distance(l.ubicacion, ST_MakePoint(:lng, :lat)::geography) AS metros,
       ST_Y(l.ubicacion::geometry) AS lat, ST_X(l.ubicacion::geometry) AS lng
FROM locales l
WHERE l.estado = 'APROBADO'
  AND ST_DWithin(l.ubicacion, ST_MakePoint(:lng, :lat)::geography, 3000)
ORDER BY metros
LIMIT 20;
```

### Enlaces «Cómo llegar» (se arman con las coordenadas guardadas)

| Destino | Enlace |
|---|---|
| Google Maps | `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` |
| Waze | `https://waze.com/ul?ll={lat},{lng}&navigate=yes` |

---

## 5. Reglas del modelo

| # | Regla | Motivo |
|---|---|---|
| 1 | Los precios se guardan en la reserva (`precio_hora`, `total`) | Si el dueño cambia la tarifa después, la reserva conserva el precio acordado |
| 2 | `numero_operacion` es único en `pagos` | Un mismo comprobante de Yape no puede usarse para dos reservas |
| 3 | Las imágenes se guardan en Supabase Storage y la tabla solo guarda la ruta | Las imágenes pesan y no deben llenar la base de datos |
| 4 | `ia_uso` registra cada llamada a OpenRouter | Permite controlar el costo y comparar modelos |
| 5 | Las fechas se guardan con zona horaria (`timestamptz`) y se muestran en hora de Lima (UTC-5) | Evita errores de una hora al calcular el inicio de una reserva |
