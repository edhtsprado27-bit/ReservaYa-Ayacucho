-- =====================================================================
--  ReservaYa Ayacucho - 010_agenda_dueno.sql
--  Paso 7: agenda del dueño.
--
--  - Agenda de un día: todas las canchas del local, sus turnos, las
--    reservas (con nombre y celular de quien reservó) y los bloqueos.
--  - Reserva manual: el dueño anota a quien reservó por teléfono o en
--    persona (sin cuenta). Queda confirmada al instante.
--  - Acciones sobre una reserva: Jugó, No vino, Cancelar (con motivo) y
--    Cobrar (pago en efectivo en el local).
--  - Bloqueos: cerrar una cancha por mantenimiento, torneo o evento.
--    Los jugadores ven esas horas como "Cerrada".
--  - El jugador ve si el local canceló su reserva y el motivo.
--
--  Solo el dueño del local o el admin (fn_administra_local, de 008).
--  La garantía anti doble reserva sigue siendo el EXCLUDE de bookings.
--
--  Ejecutar en Supabase > SQL Editor DESPUÉS de 009.
--  Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

REVOKE ALL ON court_blackouts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS ix_bookings_cancha_inicio_activas
  ON bookings (court_id, starts_at) WHERE status NOT IN ('cancelled', 'expired');

-- ---------------------------------------------------------------------
-- 1. Agenda de un local en un día (dueño o admin)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_agenda_local(uuid, date);
CREATE OR REPLACE FUNCTION fn_agenda_local(p_local uuid, p_fecha date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_desde timestamptz := p_fecha::timestamp AT TIME ZONE 'America/Lima';
  v_hasta timestamptz := (p_fecha + 1)::timestamp AT TIME ZONE 'America/Lima';
  v_local record;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(p_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  IF p_fecha IS NULL OR p_fecha NOT BETWEEN fn_hoy_lima() - 90 AND fn_hoy_lima() + 60 THEN
    RAISE EXCEPTION 'FECHA_FUERA_DE_RANGO' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.id, v.name, v.slug, v.status, v.deposit_percent INTO v_local FROM venues v WHERE v.id = p_local;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'local', jsonb_build_object('id', v_local.id, 'nombre', v_local.name, 'slug', v_local.slug,
                                'estado', v_local.status, 'adelanto_pct', v_local.deposit_percent),
    'fecha', p_fecha,
    'ahora', now(),   -- hora del servidor: decide qué turnos ya pasaron
    'canchas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id,
               'nombre', c.name,
               'deporte', c.sport,
               'minutos_turno', c.slot_minutes,
               'turnos', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object('inicio', a.slot_start, 'fin', a.slot_end, 'precio', a.price_per_hour)
                                  ORDER BY a.slot_start)
                 FROM fn_court_availability(c.id, p_fecha) a), '[]'::jsonb))
             ORDER BY c.sort_order, c.name)
      FROM courts c
      WHERE c.venue_id = p_local AND c.status = 'active'), '[]'::jsonb),
    'reservas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',       b.id,
               'codigo',   b.code,
               'cancha_id', b.court_id,
               'inicio',   b.starts_at,
               'fin',      b.ends_at,
               'estado',   fn_estado_visible(b.status, b.hold_expires_at),
               'origen',   b.source,
               'jugador',  COALESCE(j.full_name, b.guest_name),
               'telefono', COALESCE(j.phone, b.guest_phone),
               'total',    b.total_amount,
               'adelanto', b.deposit_amount,
               'pagado',   b.amount_paid,
               'vence',    b.hold_expires_at,
               'nota',     b.notes)
             ORDER BY b.starts_at)
      FROM bookings b
      JOIN courts c ON c.id = b.court_id
      LEFT JOIN users j ON j.id = b.player_id
      WHERE c.venue_id = p_local
        AND b.period && tstzrange(v_desde, v_hasta, '[)')
        AND b.status NOT IN ('cancelled', 'expired')
        AND fn_estado_visible(b.status, b.hold_expires_at) <> 'expired'), '[]'::jsonb),
    'bloqueos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', bl.id, 'cancha_id', bl.court_id, 'inicio', bl.starts_at,
                                          'fin', bl.ends_at, 'motivo', bl.reason) ORDER BY bl.starts_at)
      FROM court_blackouts bl
      JOIN courts c ON c.id = bl.court_id
      WHERE c.venue_id = p_local
        AND tstzrange(bl.starts_at, bl.ends_at, '[)') && tstzrange(v_desde, v_hasta, '[)')), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_agenda_local(uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_agenda_local(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Reserva manual (alguien reservó por teléfono o en persona)
--    Queda confirmada. Si pagó algo en efectivo, se registra el pago.
--    Errores: SIN_SESION, LOCAL_AJENO, NOMBRE_CLIENTE_INVALIDO,
--      CELULAR_INVALIDO, DATOS_INVALIDOS, HORARIO_INVALIDO, MONTO_INVALIDO,
--      HORARIO_OCUPADO (+ los del trigger: COURT_BLACKOUT, ...)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_reserva_manual(uuid, timestamptz, timestamptz, text, text, numeric, text);
CREATE OR REPLACE FUNCTION fn_reserva_manual(
  p_cancha   uuid,
  p_inicio   timestamptz,
  p_fin      timestamptz,
  p_nombre   text,
  p_telefono text    DEFAULT NULL,
  p_pagado   numeric DEFAULT 0,
  p_nota     text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid := fn_usuario_actual();
  v_cancha  record;
  v_nombre  text := NULLIF(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  v_celular text := fn_celular_valido(p_telefono);
  v_pagado  numeric := round(coalesce(p_pagado, 0), 2);
  v_fecha   date;
  v_minutos integer;
  v_turnos  integer;
  v_total   numeric;
  v_id      uuid;
  v_restriccion text;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id, c.slot_minutes, c.venue_id, v.deposit_percent
    INTO v_cancha
  FROM courts c JOIN venues v ON v.id = c.venue_id
  WHERE c.id = p_cancha;
  IF NOT FOUND OR NOT fn_administra_local(v_cancha.venue_id) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;

  IF v_nombre IS NULL OR length(v_nombre) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'NOMBRE_CLIENTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(coalesce(p_telefono, '')), '') IS NOT NULL AND v_celular IS NULL THEN
    RAISE EXCEPTION 'CELULAR_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF p_inicio IS NULL OR p_fin IS NULL OR p_fin <= p_inicio
     OR p_inicio < now() - interval '1 day'
     OR p_inicio > now() + interval '60 days' THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  v_fecha   := (p_inicio AT TIME ZONE 'America/Lima')::date;
  v_minutos := (extract(epoch FROM p_fin - p_inicio) / 60)::integer;

  -- Turnos completos y seguidos de la grilla de ese día (máx. 4 horas)
  SELECT count(*), COALESCE(sum(COALESCE(a.price_per_hour, 0) * v_cancha.slot_minutes / 60.0), 0)
    INTO v_turnos, v_total
  FROM fn_court_availability(p_cancha, v_fecha) a
  WHERE a.slot_start >= p_inicio AND a.slot_end <= p_fin;
  IF v_turnos * v_cancha.slot_minutes <> v_minutos OR v_minutos > 240 THEN
    RAISE EXCEPTION 'HORARIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  v_total := round(v_total, 2);

  IF v_pagado < 0 OR v_pagado > v_total THEN
    RAISE EXCEPTION 'MONTO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Apartados vencidos que chocan con este horario: se liberan ya
  UPDATE bookings
  SET status = 'expired'
  WHERE court_id = p_cancha AND status = 'pending_payment' AND hold_expires_at <= now()
    AND period && tstzrange(p_inicio, p_fin, '[)');

  PERFORM set_config('app.user_id', v_usuario::text, true);

  FOR intento IN 1..5 LOOP
    BEGIN
      INSERT INTO bookings (
        code, court_id, player_id, guest_name, guest_phone, starts_at, ends_at, status, source,
        price_per_hour, total_amount, deposit_amount, amount_paid, hold_expires_at, notes)
      VALUES (
        fn_codigo_reserva(), p_cancha, NULL, left(v_nombre, 120), v_celular, p_inicio, p_fin, 'confirmed', 'owner_manual',
        round(v_total / (v_minutos / 60.0), 2), v_total,
        round(v_total * v_cancha.deposit_percent / 100.0, 2), v_pagado, NULL,
        left(NULLIF(btrim(coalesce(p_nota, '')), ''), 300))
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION
      WHEN exclusion_violation THEN
        RAISE EXCEPTION 'HORARIO_OCUPADO' USING ERRCODE = 'P0001';
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_restriccion = CONSTRAINT_NAME;
        IF intento = 5 OR v_restriccion NOT LIKE '%code%' THEN
          RAISE;
        END IF;
    END;
  END LOOP;

  IF v_pagado > 0 THEN
    INSERT INTO payments (booking_id, method, amount, status, reviewed_by, reviewed_at)
    VALUES (v_id, 'efectivo', v_pagado, 'approved', v_usuario, now());
  END IF;

  RETURN jsonb_build_object('id', v_id, 'codigo', (SELECT code FROM bookings WHERE id = v_id),
                            'total', v_total, 'pagado', v_pagado, 'estado', 'confirmed');
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_reserva_manual(uuid, timestamptz, timestamptz, text, text, numeric, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_reserva_manual(uuid, timestamptz, timestamptz, text, text, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Acciones del dueño sobre una reserva
--    jugo     -> completed   (la hora ya empezó)
--    no_vino  -> no_show     (la hora ya empezó)
--    cancelar -> cancelled   (con motivo; la hora todavía no termina)
--    cobrar   -> registra un pago en efectivo; si estaba por pagar o en
--                revisión, queda confirmada
--    Errores: SIN_SESION, RESERVA_NO_ENCONTRADA, ACCION_INVALIDA,
--      ACCION_NO_PERMITIDA, FALTA_MOTIVO, MONTO_INVALIDO
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_gestionar_reserva(uuid, text, text, numeric);
CREATE OR REPLACE FUNCTION fn_gestionar_reserva(
  p_reserva uuid,
  p_accion  text,
  p_motivo  text    DEFAULT NULL,
  p_monto   numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid := fn_usuario_actual();
  v_r       record;
  v_estado  text;
  v_activa  boolean;
  v_motivo  text := left(NULLIF(btrim(coalesce(p_motivo, '')), ''), 200);
  v_monto   numeric := round(coalesce(p_monto, 0), 2);
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF p_accion NOT IN ('jugo', 'no_vino', 'cancelar', 'cobrar') THEN
    RAISE EXCEPTION 'ACCION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;

  SELECT b.id, b.status, b.hold_expires_at, b.starts_at, b.ends_at, b.total_amount, b.amount_paid, c.venue_id
    INTO v_r
  FROM bookings b JOIN courts c ON c.id = b.court_id
  WHERE b.id = p_reserva
  FOR UPDATE OF b;
  IF NOT FOUND OR NOT fn_administra_local(v_r.venue_id) THEN
    RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  v_estado := fn_estado_visible(v_r.status, v_r.hold_expires_at);
  v_activa := v_estado IN ('pending_payment', 'payment_review', 'confirmed');
  PERFORM set_config('app.user_id', v_usuario::text, true);

  IF p_accion IN ('jugo', 'no_vino') THEN
    IF NOT v_activa OR v_r.starts_at > now() THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    UPDATE bookings
    SET status = CASE WHEN p_accion = 'jugo' THEN 'completed'::booking_status ELSE 'no_show'::booking_status END,
        hold_expires_at = NULL
    WHERE id = p_reserva;

  ELSIF p_accion = 'cancelar' THEN
    IF NOT v_activa OR v_r.ends_at <= now() THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    IF v_motivo IS NULL OR length(v_motivo) < 3 THEN
      RAISE EXCEPTION 'FALTA_MOTIVO' USING ERRCODE = 'P0001';
    END IF;
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_usuario, cancel_reason = v_motivo
    WHERE id = p_reserva;

  ELSE -- cobrar
    IF NOT (v_activa OR v_estado = 'completed') THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    IF v_monto <= 0 OR v_r.amount_paid + v_monto > v_r.total_amount THEN
      RAISE EXCEPTION 'MONTO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO payments (booking_id, method, amount, status, reviewed_by, reviewed_at)
    VALUES (p_reserva, 'efectivo', v_monto, 'approved', v_usuario, now());
    UPDATE bookings
    SET amount_paid = amount_paid + v_monto,
        status = CASE WHEN v_estado IN ('pending_payment', 'payment_review') THEN 'confirmed'::booking_status ELSE status END,
        hold_expires_at = CASE WHEN v_estado IN ('pending_payment', 'payment_review') THEN NULL ELSE hold_expires_at END
    WHERE id = p_reserva;
  END IF;

  RETURN (SELECT jsonb_build_object('id', b.id, 'estado', fn_estado_visible(b.status, b.hold_expires_at),
                                    'pagado', b.amount_paid, 'total', b.total_amount)
          FROM bookings b WHERE b.id = p_reserva);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_gestionar_reserva(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_gestionar_reserva(uuid, text, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Bloquear horas de una cancha (mantenimiento, torneo, evento)
--    No se puede bloquear encima de reservas activas: primero hay que
--    cancelarlas (así el jugador recibe el aviso).
--    Errores: SIN_SESION, LOCAL_AJENO, DATOS_INVALIDOS, HAY_RESERVAS, YA_BLOQUEADO
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_bloquear_horario(uuid, timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION fn_bloquear_horario(p_cancha uuid, p_inicio timestamptz, p_fin timestamptz, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid := fn_usuario_actual();
  v_local   uuid;
  v_id      bigint;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  SELECT c.venue_id INTO v_local FROM courts c WHERE c.id = p_cancha;
  IF NOT FOUND OR NOT fn_administra_local(v_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  IF p_inicio IS NULL OR p_fin IS NULL OR p_fin <= p_inicio
     OR p_fin <= now() OR p_fin - p_inicio > interval '31 days' THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.court_id = p_cancha
      AND b.status NOT IN ('cancelled', 'expired')
      AND fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
      AND b.period && tstzrange(p_inicio, p_fin, '[)')
  ) THEN
    RAISE EXCEPTION 'HAY_RESERVAS' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO court_blackouts (court_id, starts_at, ends_at, reason, created_by)
    VALUES (p_cancha, p_inicio, p_fin,
            coalesce(left(NULLIF(btrim(coalesce(p_motivo, '')), ''), 120), 'Cerrado por el local'), v_usuario)
    RETURNING id INTO v_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'YA_BLOQUEADO' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object('id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_bloquear_horario(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_bloquear_horario(uuid, timestamptz, timestamptz, text) TO authenticated;

DROP FUNCTION IF EXISTS fn_quitar_bloqueo(bigint);
CREATE OR REPLACE FUNCTION fn_quitar_bloqueo(p_bloqueo bigint)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local uuid;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  SELECT c.venue_id INTO v_local
  FROM court_blackouts bl JOIN courts c ON c.id = bl.court_id
  WHERE bl.id = p_bloqueo;
  IF NOT FOUND OR NOT fn_administra_local(v_local) THEN
    RAISE EXCEPTION 'BLOQUEO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM court_blackouts WHERE id = p_bloqueo;
  RETURN jsonb_build_object('id', p_bloqueo, 'eliminado', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_quitar_bloqueo(bigint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_quitar_bloqueo(bigint) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Mis reservas (jugador): ahora dice si la canceló el local y por qué
--    (misma función de 007, con dos columnas más al final)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_mis_reservas(uuid);
CREATE OR REPLACE FUNCTION fn_mis_reservas(p_id uuid DEFAULT NULL)
RETURNS TABLE (
  id                  uuid,
  codigo              varchar,
  estado              text,
  inicio              timestamptz,
  fin                 timestamptz,
  total               numeric,
  adelanto            numeric,
  pagado              numeric,
  vence               timestamptz,
  cancha              varchar,
  deporte             text,
  local               varchar,
  slug                varchar,
  distrito            varchar,
  direccion           varchar,
  referencia          varchar,
  lat                 numeric,
  lng                 numeric,
  telefono            varchar,
  horas_cancelacion   smallint,
  cancelable          boolean,
  creada              timestamptz,
  cancelada_por_local boolean,
  motivo_cancelacion  text
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
         b.created_at,
         b.status = 'cancelled' AND b.cancelled_by IS DISTINCT FROM b.player_id,
         CASE WHEN b.status = 'cancelled' AND b.cancelled_by IS DISTINCT FROM b.player_id THEN b.cancel_reason END
  FROM bookings b
  JOIN courts c    ON c.id = b.court_id
  JOIN venues v    ON v.id = c.venue_id
  JOIN districts d ON d.id = v.district_id
  WHERE b.player_id = fn_usuario_actual()
    AND (p_id IS NULL OR b.id = p_id)
    AND (p_id IS NOT NULL OR b.ends_at > now() - interval '30 days')
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

-- Que la API (PostgREST) vea las funciones nuevas
NOTIFY pgrst, 'reload schema';
