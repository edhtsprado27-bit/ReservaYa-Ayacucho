-- =====================================================================
--  ReservaYa Ayacucho - 007_reservas.sql
--  Paso 5: reservar una cancha por horas.
--
--  - El jugador elige cancha, dia y horas en una grilla.
--  - Al reservar, el horario queda APARTADO (pending_payment) durante
--    venues.hold_minutes (15 min por defecto) mientras paga el adelanto.
--  - Si no paga, el apartado vence solo y el horario se libera.
--  - Nunca hay dos reservas cruzadas en la misma cancha: lo garantiza
--    el EXCLUDE bookings_no_overlap de supabase_inicial.sql, incluso
--    si dos personas pulsan "Reservar" en el mismo milisegundo.
--
--  La tabla bookings NO se abre a la API: todo pasa por funciones
--  SECURITY DEFINER que validan quien llama y solo devuelven lo que
--  esa persona puede ver (nadie ve quien reservo otro horario).
--
--  Ejecutar en Supabase > SQL Editor DESPUES de 004, 005 y 006.
--  Se puede ejecutar mas de una vez sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Ajustes de datos
-- ---------------------------------------------------------------------
-- Toda cancha publicada necesita horario de atencion para poder
-- reservarse. Las que se registran desde la web ya lo traen (08:00 a
-- 23:00); esto solo completa las que se hayan creado a mano sin horario.
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time)
SELECT c.id, g, time '08:00', time '23:00'
FROM courts c
JOIN venues v ON v.id = c.venue_id
CROSS JOIN generate_series(0, 6) g
WHERE v.status = 'approved'
  AND c.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM court_operating_hours h WHERE h.court_id = c.id);

-- Indice para "mis reservas" (la tabla ya tiene (player_id, starts_at),
-- este cubre ademas el filtro por estado del limite de apartados)
CREATE INDEX IF NOT EXISTS ix_bookings_jugador_estado
  ON bookings (player_id, status, hold_expires_at);

-- La tabla de reservas solo se toca a traves de las funciones de abajo
ALTER TABLE bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bookings, booking_status_history FROM anon, authenticated;

-- Liberar apartados vencidos es tarea interna (la llama pg_cron)
REVOKE EXECUTE ON FUNCTION fn_expire_holds() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Utilidades internas
-- ---------------------------------------------------------------------
-- Fecha de hoy en Ayacucho (UTC-5)
CREATE OR REPLACE FUNCTION fn_hoy_lima()
RETURNS date
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (now() AT TIME ZONE 'America/Lima')::date;
$$;

-- Codigo corto para mostrar al jugador y al dueno: RY-7K3P9
-- (sin 0, O, 1 ni I para que no se confundan al dictarlo)
CREATE OR REPLACE FUNCTION fn_codigo_reserva()
RETURNS text
LANGUAGE sql VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT 'RY-' || string_agg(
           substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 5);
$$;
REVOKE EXECUTE ON FUNCTION fn_codigo_reserva() FROM PUBLIC, anon, authenticated;

-- Estado que ve la persona: un apartado vencido se muestra como vencido
-- aunque pg_cron todavia no lo haya marcado.
CREATE OR REPLACE FUNCTION fn_estado_visible(p_estado booking_status, p_vence timestamptz)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN p_estado = 'pending_payment' AND p_vence IS NOT NULL AND p_vence <= now() THEN 'expired'
           ELSE p_estado::text
         END;
$$;

-- Datos de una reserva para devolver al navegador
CREATE OR REPLACE FUNCTION fn_reserva_json(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'id',       b.id,
           'codigo',   b.code,
           'estado',   fn_estado_visible(b.status, b.hold_expires_at),
           'inicio',   b.starts_at,
           'fin',      b.ends_at,
           'total',    b.total_amount,
           'adelanto', b.deposit_amount,
           'vence',    b.hold_expires_at,
           'cancha',   c.name,
           'local',    v.name,
           'slug',     v.slug)
  FROM bookings b
  JOIN courts c ON c.id = b.court_id
  JOIN venues v ON v.id = c.venue_id
  WHERE b.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION fn_reserva_json(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Ficha publica de un local (pagina /cancha/{slug})
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_local_publico(text);
CREATE OR REPLACE FUNCTION fn_local_publico(p_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'id',                v.id,
           'slug',              v.slug,
           'nombre',            v.name,
           'distrito',          d.name,
           'direccion',         v.address,
           'referencia',        v.address_reference,
           'lat',               v.lat,
           'lng',               v.lng,
           'telefono',          v.whatsapp_phone,
           'adelanto_pct',      v.deposit_percent,
           'minutos_apartado',  v.hold_minutes,
           'horas_cancelacion', v.cancellation_hours,
           'canchas', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id',           c.id,
                      'nombre',       c.name,
                      'deporte',      c.sport,
                      'techada',      c.is_covered,
                      'minutos_turno', c.slot_minutes,
                      'min_minutos',  c.min_booking_minutes,
                      'max_minutos',  c.max_booking_minutes,
                      'precio_desde', (SELECT min(r.price_per_hour + r.lighting_surcharge)
                                       FROM pricing_rules r
                                       WHERE r.court_id = c.id AND r.is_active
                                         AND (r.valid_to IS NULL OR r.valid_to >= fn_hoy_lima())))
                    ORDER BY c.sort_order, c.name)
             FROM courts c
             WHERE c.venue_id = v.id AND c.status = 'active'), '[]'::jsonb))
  FROM venues v
  JOIN districts d ON d.id = v.district_id
  WHERE v.slug = p_slug
    AND v.status = 'approved';
$$;
REVOKE EXECUTE ON FUNCTION fn_local_publico(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_local_publico(text) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Grilla de horarios de un local en un dia
--    estado: libre | ocupado | pasado | cerrado (mantenimiento/evento)
--    No dice QUIEN reservo: solo si el horario esta tomado.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_disponibilidad_local(uuid, date);
CREATE OR REPLACE FUNCTION fn_disponibilidad_local(p_local_id uuid, p_fecha date)
RETURNS TABLE (
  cancha_id uuid,
  inicio    timestamptz,
  fin       timestamptz,
  estado    text,
  precio    numeric,
  pico      boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id,
    a.slot_start,
    a.slot_end,
    CASE
      WHEN a.slot_start <= now() THEN 'pasado'
      WHEN EXISTS (
        SELECT 1 FROM court_blackouts bl
        WHERE bl.court_id = c.id
          AND tstzrange(bl.starts_at, bl.ends_at, '[)') && tstzrange(a.slot_start, a.slot_end, '[)')
      ) THEN 'cerrado'
      WHEN EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.court_id = c.id
          AND b.status NOT IN ('cancelled', 'expired')       -- usa el indice del EXCLUDE
          AND b.period && tstzrange(a.slot_start, a.slot_end, '[)')
          AND NOT (b.status = 'pending_payment' AND b.hold_expires_at <= now())  -- apartado vencido = libre
      ) THEN 'ocupado'
      ELSE 'libre'
    END,
    a.price_per_hour,
    a.is_peak
  FROM venues v
  JOIN courts c ON c.venue_id = v.id AND c.status = 'active'
  CROSS JOIN LATERAL fn_court_availability(c.id, p_fecha) a
  WHERE v.id = p_local_id
    AND v.status = 'approved'
    AND p_fecha BETWEEN fn_hoy_lima() AND fn_hoy_lima() + 30
  ORDER BY c.sort_order, c.name, a.slot_start;
$$;
REVOKE EXECUTE ON FUNCTION fn_disponibilidad_local(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_disponibilidad_local(uuid, date) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Reservar (apartar el horario mientras se paga)
--    p_clave: identificador unico que genera el navegador por intento.
--    Si llega dos veces (doble clic, red lenta), devuelve la MISMA
--    reserva en vez de crear otra.
--    Errores (texto del RAISE):
--      SIN_SESION, DATOS_INVALIDOS, CANCHA_NO_DISPONIBLE, HORARIO_PASADO,
--      FECHA_MUY_LEJANA, DURACION_INVALIDA, HORARIO_INVALIDO, SIN_TARIFA,
--      DEMASIADAS_PENDIENTES, HORARIO_OCUPADO
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_reservar(uuid, timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION fn_reservar(
  p_cancha_id uuid,
  p_inicio    timestamptz,
  p_fin       timestamptz,
  p_clave     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario    uuid := fn_usuario_actual();
  v_cancha     record;
  v_fecha      date;
  v_minutos    integer;
  v_turnos     integer;
  v_sin_precio integer;
  v_total      numeric;
  v_pendientes integer;
  v_id         uuid;
  v_restriccion text;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;

  IF p_clave IS NOT NULL AND (length(p_clave) < 8 OR length(p_clave) > 64) THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  -- Mismo intento repetido: devolver la reserva que ya se creo
  IF p_clave IS NOT NULL THEN
    SELECT b.id INTO v_id FROM bookings b
    WHERE b.idempotency_key = p_clave AND b.player_id = v_usuario;
    IF FOUND THEN
      RETURN fn_reserva_json(v_id);
    END IF;
  END IF;

  IF p_cancha_id IS NULL OR p_inicio IS NULL OR p_fin IS NULL OR p_fin <= p_inicio THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id, c.slot_minutes, c.min_booking_minutes, c.max_booking_minutes,
         v.deposit_percent, v.hold_minutes
    INTO v_cancha
  FROM courts c
  JOIN venues v ON v.id = c.venue_id
  WHERE c.id = p_cancha_id AND c.status = 'active' AND v.status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANCHA_NO_DISPONIBLE' USING ERRCODE = 'P0001';
  END IF;

  v_fecha   := (p_inicio AT TIME ZONE 'America/Lima')::date;
  v_minutos := (extract(epoch FROM p_fin - p_inicio) / 60)::integer;

  IF p_inicio <= now() THEN
    RAISE EXCEPTION 'HORARIO_PASADO' USING ERRCODE = 'P0001';
  END IF;
  IF v_fecha > fn_hoy_lima() + 30 THEN
    RAISE EXCEPTION 'FECHA_MUY_LEJANA' USING ERRCODE = 'P0001';
  END IF;
  IF v_minutos < v_cancha.min_booking_minutes OR v_minutos > v_cancha.max_booking_minutes THEN
    RAISE EXCEPTION 'DURACION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;

  -- Una persona a la vez: evita que alguien abra muchas pestanas para
  -- apartar todos los horarios sin pagar.
  PERFORM pg_advisory_xact_lock(hashtextextended('reservas:' || v_usuario::text, 0));

  SELECT count(*) INTO v_pendientes
  FROM bookings b
  WHERE b.player_id = v_usuario
    AND b.status = 'pending_payment'
    AND b.hold_expires_at > now();
  IF v_pendientes >= 2 THEN
    RAISE EXCEPTION 'DEMASIADAS_PENDIENTES' USING ERRCODE = 'P0001';
  END IF;

  -- Las horas pedidas deben ser turnos completos y seguidos de la grilla
  -- de ese dia (asi se respeta el horario de atencion y el precio de
  -- cada turno: hora normal y hora pico se suman por separado).
  SELECT count(*),
         count(*) FILTER (WHERE a.price_per_hour IS NULL),
         COALESCE(sum(a.price_per_hour * v_cancha.slot_minutes / 60.0), 0)
    INTO v_turnos, v_sin_precio, v_total
  FROM fn_court_availability(p_cancha_id, v_fecha) a
  WHERE a.slot_start >= p_inicio AND a.slot_end <= p_fin;

  IF v_turnos * v_cancha.slot_minutes <> v_minutos THEN
    RAISE EXCEPTION 'HORARIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF v_sin_precio > 0 THEN
    RAISE EXCEPTION 'SIN_TARIFA' USING ERRCODE = 'P0001';
  END IF;
  v_total := round(v_total, 2);

  -- Apartados vencidos que chocan con este horario: se liberan ya,
  -- sin esperar a pg_cron.
  UPDATE bookings
  SET status = 'expired'
  WHERE court_id = p_cancha_id
    AND status = 'pending_payment'
    AND hold_expires_at <= now()
    AND period && tstzrange(p_inicio, p_fin, '[)');

  -- Para el historial de estados (fn_booking_status_history)
  PERFORM set_config('app.user_id', v_usuario::text, true);

  FOR intento IN 1..5 LOOP
    BEGIN
      INSERT INTO bookings (
        code, court_id, player_id, starts_at, ends_at, status, source,
        price_per_hour, total_amount, deposit_amount, hold_expires_at, idempotency_key)
      VALUES (
        fn_codigo_reserva(), p_cancha_id, v_usuario, p_inicio, p_fin, 'pending_payment', 'web',
        round(v_total / (v_minutos / 60.0), 2),
        v_total,
        round(v_total * v_cancha.deposit_percent / 100.0, 2),
        now() + make_interval(mins => v_cancha.hold_minutes),
        p_clave)
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION
      WHEN exclusion_violation THEN
        -- Otra persona ya tiene ese horario (o lo tomo hace un instante)
        RAISE EXCEPTION 'HORARIO_OCUPADO' USING ERRCODE = 'P0001';
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_restriccion = CONSTRAINT_NAME;
        IF v_restriccion LIKE '%idempotency%' THEN
          -- El mismo intento entro por otra conexion al mismo tiempo
          SELECT b.id INTO v_id FROM bookings b
          WHERE b.idempotency_key = p_clave AND b.player_id = v_usuario;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
          END IF;
          EXIT;
        ELSIF intento = 5 OR v_restriccion NOT LIKE '%code%' THEN
          RAISE;
        END IF;
        -- codigo repetido (muy raro): se intenta con otro
    END;
  END LOOP;

  RETURN fn_reserva_json(v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_reservar(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_reservar(uuid, timestamptz, timestamptz, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Mis reservas (proximas primero; tambien las de los ultimos 30 dias)
--    Con p_id devuelve solo esa reserva (pagina /reservas/{id}).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_mis_reservas(uuid);
CREATE OR REPLACE FUNCTION fn_mis_reservas(p_id uuid DEFAULT NULL)
RETURNS TABLE (
  id                uuid,
  codigo            varchar,
  estado            text,
  inicio            timestamptz,
  fin               timestamptz,
  total             numeric,
  adelanto          numeric,
  pagado            numeric,
  vence             timestamptz,
  cancha            varchar,
  deporte           text,
  local             varchar,
  slug              varchar,
  distrito          varchar,
  direccion         varchar,
  referencia        varchar,
  lat               numeric,
  lng               numeric,
  telefono          varchar,
  horas_cancelacion smallint,
  cancelable        boolean,
  creada            timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.code, fn_estado_visible(b.status, b.hold_expires_at),
         b.starts_at, b.ends_at, b.total_amount, b.deposit_amount, b.amount_paid,
         b.hold_expires_at, c.name, c.sport::text, v.name, v.slug, d.name,
         v.address, v.address_reference, v.lat, v.lng, v.whatsapp_phone,
         v.cancellation_hours,
         fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
           AND b.starts_at > now(),
         b.created_at
  FROM bookings b
  JOIN courts c    ON c.id = b.court_id
  JOIN venues v    ON v.id = c.venue_id
  JOIN districts d ON d.id = v.district_id
  WHERE b.player_id = fn_usuario_actual()
    AND (p_id IS NULL OR b.id = p_id)
    AND (p_id IS NOT NULL OR b.ends_at > now() - interval '30 days')
  -- Primero las que siguen en pie y no han terminado (la más cercana arriba);
  -- después las vencidas, canceladas y pasadas (la más reciente arriba).
  ORDER BY (fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
            AND b.ends_at > now()) DESC,
           CASE WHEN b.ends_at > now()
                 AND fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
                THEN b.starts_at END ASC,
           b.starts_at DESC
  LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION fn_mis_reservas(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_mis_reservas(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Cancelar una reserva propia
--    Se puede cancelar mientras no haya empezado. con_devolucion indica
--    si se cancelo con la anticipacion que pide el local
--    (venues.cancellation_hours); los pagos llegan en el paso 6.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_cancelar_reserva(uuid, text);
CREATE OR REPLACE FUNCTION fn_cancelar_reserva(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid := fn_usuario_actual();
  v_reserva record;
  v_a_tiempo boolean;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;

  SELECT b.id, b.status, b.starts_at, b.hold_expires_at, v.cancellation_hours
    INTO v_reserva
  FROM bookings b
  JOIN courts c ON c.id = b.court_id
  JOIN venues v ON v.id = c.venue_id
  WHERE b.id = p_id AND b.player_id = v_usuario
  FOR UPDATE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.user_id', v_usuario::text, true);

  IF v_reserva.status = 'pending_payment' AND v_reserva.hold_expires_at <= now() THEN
    UPDATE bookings SET status = 'expired' WHERE id = p_id;
    RAISE EXCEPTION 'RESERVA_VENCIDA' USING ERRCODE = 'P0001';
  END IF;

  IF v_reserva.status NOT IN ('pending_payment', 'payment_review', 'confirmed')
     OR v_reserva.starts_at <= now() THEN
    RAISE EXCEPTION 'NO_SE_PUEDE_CANCELAR' USING ERRCODE = 'P0001';
  END IF;

  v_a_tiempo := v_reserva.starts_at - now() >= make_interval(hours => v_reserva.cancellation_hours);

  UPDATE bookings
  SET status        = 'cancelled',
      cancelled_at  = now(),
      cancelled_by  = v_usuario,
      cancel_reason = left(NULLIF(btrim(p_motivo), ''), 200)
  WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'estado', 'cancelled', 'con_devolucion', v_a_tiempo);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_cancelar_reserva(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_cancelar_reserva(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Liberar apartados vencidos cada minuto con pg_cron
--    (opcional: si pg_cron no esta activado, la web igual trata los
--    apartados vencidos como libres y los libera al reservar)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('reservaya-liberar-apartados', '* * * * *', 'SELECT public.fn_expire_holds()');
    RAISE NOTICE 'pg_cron: tarea reservaya-liberar-apartados programada cada minuto';
  ELSE
    RAISE NOTICE 'pg_cron no esta activado: los apartados vencidos se liberan al reservar';
  END IF;
END $$;

-- Que la API (PostgREST) vea las funciones nuevas
NOTIFY pgrst, 'reload schema';
