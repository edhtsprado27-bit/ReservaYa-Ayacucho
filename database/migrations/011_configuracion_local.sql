-- =====================================================================
-- ReservaYa Ayacucho · 011 · Configuración del local y control del admin
-- Ejecutar en Supabase (SQL Editor) DESPUÉS de 010_agenda_dueno.sql.
-- Se puede ejecutar más de una vez.
--
-- Dueño (o admin) de un local:
--   fn_config_local      reglas de reserva, canchas, horario y precios
--   fn_guardar_local     adelanto, apartado, cancelación, WhatsApp y dirección
--   fn_guardar_cancha    nombre, deporte, horario por día, precio normal y de hora punta
--   fn_agregar_cancha    nueva cancha (08:00 a 23:00 todos los días)
--   fn_quitar_cancha     deja de ofrecer una cancha (si no tiene reservas pendientes)
-- Solo admin:
--   fn_locales_admin         locales publicados y suspendidos con su dueño
--   fn_asignar_dueno         pasa un local a la cuenta de su dueño real (por correo)
--   fn_cambiar_estado_local  suspender (con motivo) o reactivar
--
-- Las tablas siguen cerradas a la API: todo pasa por estas funciones, que
-- verifican quién llama. Cada cambio queda en audit_logs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Un local suspendido sigue apareciendo a su dueño y al admin
--    (para atender las reservas que ya tenía y ver el motivo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_mis_locales_pago()
RETURNS TABLE (id uuid, nombre varchar, estado venue_status, yape varchar, plin varchar, titular varchar, adelanto_pct smallint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.name, v.status, v.yape_phone, v.plin_phone, v.payment_holder_name, v.deposit_percent
  FROM venues v
  JOIN users u ON u.id = fn_usuario_actual() AND u.status = 'active'
  WHERE (u.role = 'owner' AND v.owner_id = u.id AND v.status IN ('approved', 'pending_review', 'suspended'))
     OR (u.role = 'admin' AND v.status IN ('approved', 'suspended'))
  ORDER BY v.name;
$$;
REVOKE EXECUTE ON FUNCTION fn_mis_locales_pago() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_mis_locales_pago() TO authenticated;

-- ---------------------------------------------------------------------
-- 1. Utilidades
-- ---------------------------------------------------------------------
-- Hora 'HH:MM' en punto o y media (00:00 a 24:00) -> time; NULL si no es válida
CREATE OR REPLACE FUNCTION fn_hora_media(p text)
RETURNS time
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN p ~ '^([01][0-9]|2[0-3]):(00|30)$' OR p = '24:00' THEN p::time
         END;
$$;

-- Reservas que siguen en pie (por pagar, en revisión o confirmadas) y aún no empiezan
CREATE OR REPLACE FUNCTION fn_reservas_futuras_cancha(p_cancha uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM bookings b
  WHERE b.court_id = p_cancha
    AND fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
    AND b.ends_at > now();
$$;
REVOKE EXECUTE ON FUNCTION fn_reservas_futuras_cancha(uuid) FROM PUBLIC, anon, authenticated;

-- Precio normal y de hora punta vigentes de una cancha (como los muestra el formulario)
CREATE OR REPLACE FUNCTION fn_precios_cancha(p_cancha uuid)
RETURNS TABLE (precio numeric, precio_punta numeric, punta_desde time)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT r.price_per_hour FROM pricing_rules r
      WHERE r.court_id = p_cancha AND r.is_active AND NOT r.is_peak
        AND (r.valid_to IS NULL OR r.valid_to >= fn_hoy_lima())
      ORDER BY (r.day_of_week IS NULL) DESC, r.priority DESC, r.start_time LIMIT 1),
    p.price_per_hour,
    p.start_time
  FROM (SELECT 1) x
  LEFT JOIN LATERAL (
    SELECT r.price_per_hour, r.start_time FROM pricing_rules r
    WHERE r.court_id = p_cancha AND r.is_active AND r.is_peak
      AND (r.valid_to IS NULL OR r.valid_to >= fn_hoy_lima())
    ORDER BY (r.day_of_week IS NULL) DESC, r.priority DESC, r.start_time LIMIT 1
  ) p ON true;
$$;
REVOKE EXECUTE ON FUNCTION fn_precios_cancha(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fn_auditar(p_entidad text, p_id text, p_accion text, p_detalle jsonb)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO audit_logs (actor_id, entity, entity_id, action, diff)
  VALUES (fn_usuario_actual(), p_entidad, p_id, p_accion, p_detalle);
$$;
REVOKE EXECUTE ON FUNCTION fn_auditar(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Superficie por deporte (la misma regla que al registrar un local)
CREATE OR REPLACE FUNCTION fn_superficie_de(p sport_type)
RETURNS surface_type
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p = 'futbol' THEN 'grass_sintetico'::surface_type ELSE 'losa'::surface_type END;
$$;

-- ---------------------------------------------------------------------
-- 2. Configuración completa de un local (dueño o admin)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_config_local(uuid);
CREATE OR REPLACE FUNCTION fn_config_local(p_local uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(p_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  SELECT ve.*, d.name AS distrito INTO v
  FROM venues ve JOIN districts d ON d.id = ve.district_id
  WHERE ve.id = p_local AND ve.status <> 'rejected';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'local', jsonb_build_object(
      'id', v.id, 'nombre', v.name, 'slug', v.slug, 'distrito', v.distrito,
      'estado', v.status,
      'motivo_estado', CASE WHEN v.status = 'suspended' THEN v.rejection_reason END,
      'direccion', v.address, 'referencia', v.address_reference,
      'whatsapp', fn_celular_valido(v.whatsapp_phone),
      'adelanto_pct', v.deposit_percent,
      'minutos_apartado', v.hold_minutes,
      'horas_cancelacion', v.cancellation_hours),
    'canchas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id,
               'nombre', c.name,
               'deporte', c.sport,
               'techada', c.is_covered,
               'minutos_turno', c.slot_minutes,
               'max_minutos', c.max_booking_minutes,
               'horario', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                          'dia', h.day_of_week,
                          'abre', to_char(h.open_time, 'HH24:MI'),
                          'cierra', to_char(h.close_time, 'HH24:MI'))
                        ORDER BY h.day_of_week, h.open_time)
                 FROM court_operating_hours h WHERE h.court_id = c.id), '[]'::jsonb),
               'precio', pr.precio,
               'precio_punta', pr.precio_punta,
               'punta_desde', to_char(pr.punta_desde, 'HH24:MI'),
               'reservas_futuras', fn_reservas_futuras_cancha(c.id))
             ORDER BY c.sort_order, c.name)
      FROM courts c
      CROSS JOIN LATERAL fn_precios_cancha(c.id) pr
      WHERE c.venue_id = p_local AND c.status = 'active'), '[]'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_config_local(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_config_local(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Reglas de reserva y datos de contacto del local
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_guardar_local(uuid, text, text, text, integer, integer, integer);
CREATE OR REPLACE FUNCTION fn_guardar_local(
  p_local       uuid,
  p_direccion   text,
  p_referencia  text,
  p_whatsapp    text,
  p_adelanto    integer,
  p_apartado    integer,
  p_cancelacion integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dir  text := btrim(regexp_replace(coalesce(p_direccion, ''), '\s+', ' ', 'g'));
  v_ref  text := nullif(btrim(regexp_replace(coalesce(p_referencia, ''), '\s+', ' ', 'g')), '');
  v_tel  text := fn_celular_valido(p_whatsapp);
  v_slug text;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(p_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_dir) NOT BETWEEN 5 AND 200 OR char_length(coalesce(v_ref, '')) > 200 THEN
    RAISE EXCEPTION 'DIRECCION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  IF nullif(btrim(coalesce(p_whatsapp, '')), '') IS NOT NULL AND v_tel IS NULL THEN
    RAISE EXCEPTION 'TELEFONO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF p_adelanto IS NULL OR p_adelanto NOT BETWEEN 0 AND 100
     OR p_apartado IS NULL OR p_apartado NOT BETWEEN 10 AND 60
     OR p_cancelacion IS NULL OR p_cancelacion NOT BETWEEN 0 AND 72 THEN
    RAISE EXCEPTION 'AJUSTES_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  UPDATE venues
  SET address = v_dir, address_reference = v_ref,
      whatsapp_phone = CASE WHEN v_tel IS NULL THEN NULL ELSE '+51' || v_tel END,
      deposit_percent = p_adelanto, hold_minutes = p_apartado, cancellation_hours = p_cancelacion
  WHERE id = p_local AND status <> 'rejected'
  RETURNING slug INTO v_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;

  PERFORM fn_auditar('venue', p_local::text, 'update_settings',
    jsonb_build_object('adelanto_pct', p_adelanto, 'minutos_apartado', p_apartado,
                       'horas_cancelacion', p_cancelacion, 'direccion', v_dir, 'whatsapp', v_tel));
  RETURN jsonb_build_object('id', p_local, 'slug', v_slug);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_guardar_local(uuid, text, text, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_guardar_local(uuid, text, text, text, integer, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Guardar una cancha: datos, horario por día y precios
--    p_horario: [{"dia": 1, "abre": "08:00", "cierra": "23:00"}, ...]  (0 = domingo)
--    Los días que no vienen quedan cerrados.
--    Precios: si cambian, las reglas anteriores se desactivan (no se borran:
--    las reservas viejas las siguen citando) y se crean "Normal" y "Hora punta".
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_guardar_cancha(uuid, text, text, boolean, integer, jsonb, numeric, numeric, text);
CREATE OR REPLACE FUNCTION fn_guardar_cancha(
  p_cancha       uuid,
  p_nombre       text,
  p_deporte      text,
  p_techada      boolean,
  p_max_minutos  integer,
  p_horario      jsonb,
  p_precio       numeric,
  p_precio_punta numeric DEFAULT NULL,
  p_punta_desde  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c       courts%ROWTYPE;
  v_slug    text;
  v_nombre  text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_deporte sport_type;
  v_punta   time := fn_hora_media(p_punta_desde);
  v_dia     jsonb;
  v_abre    time;
  v_cierra  time;
  v_dias    int[] := '{}';
  v_actual  record;
  v_fuera   int;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  -- FOR UPDATE: dos guardados a la vez de la misma cancha se hacen uno tras otro
  SELECT * INTO v_c FROM courts WHERE id = p_cancha AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANCHA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(v_c.venue_id) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(v_nombre) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'NOMBRE_CANCHA_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM courts o WHERE o.venue_id = v_c.venue_id AND o.status = 'active'
               AND o.id <> p_cancha AND fn_normalizar_texto(o.name) = fn_normalizar_texto(v_nombre)) THEN
    RAISE EXCEPTION 'CANCHA_DUPLICADA' USING ERRCODE = 'P0001';
  END IF;
  IF p_deporte IS NULL OR NOT (p_deporte = ANY (enum_range(NULL::sport_type)::text[])) THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;
  v_deporte := p_deporte::sport_type;
  IF p_max_minutos IS NULL OR p_max_minutos NOT BETWEEN v_c.slot_minutes AND 240
     OR p_max_minutos % v_c.slot_minutes <> 0 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  -- Horario
  IF p_horario IS NULL OR jsonb_typeof(p_horario) <> 'array' OR jsonb_array_length(p_horario) > 7 THEN
    RAISE EXCEPTION 'HORARIO_ATENCION_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_horario) = 0 THEN
    RAISE EXCEPTION 'HORARIO_VACIO' USING ERRCODE = 'P0001';
  END IF;
  FOR v_dia IN SELECT * FROM jsonb_array_elements(p_horario) LOOP
    v_abre   := fn_hora_media(v_dia->>'abre');
    v_cierra := fn_hora_media(v_dia->>'cierra');
    IF jsonb_typeof(v_dia) <> 'object' OR NOT coalesce(v_dia->>'dia' ~ '^[0-6]$', false)
       OR v_abre IS NULL OR v_cierra IS NULL OR (v_dia->>'dia')::int = ANY (v_dias)
       OR v_cierra - v_abre < make_interval(mins => v_c.slot_minutes) THEN
      RAISE EXCEPTION 'HORARIO_ATENCION_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    v_dias := v_dias || (v_dia->>'dia')::int;
  END LOOP;

  -- Precios
  IF p_precio IS NULL OR p_precio < 1 OR p_precio > 1000 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF (p_precio_punta IS NULL) <> (p_punta_desde IS NULL)
     OR (p_precio_punta IS NOT NULL AND (p_precio_punta < 1 OR p_precio_punta > 1000
                                         OR v_punta IS NULL OR v_punta = time '00:00' OR v_punta = time '24:00')) THEN
    RAISE EXCEPTION 'PRECIO_PUNTA_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE courts
  SET name = v_nombre, sport = v_deporte, surface = fn_superficie_de(v_deporte),
      is_covered = coalesce(p_techada, false),
      max_booking_minutes = p_max_minutos,
      min_booking_minutes = least(min_booking_minutes, p_max_minutos)
  WHERE id = p_cancha;

  DELETE FROM court_operating_hours WHERE court_id = p_cancha;
  INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time)
  SELECT p_cancha, (e->>'dia')::smallint, fn_hora_media(e->>'abre'), fn_hora_media(e->>'cierra')
  FROM jsonb_array_elements(p_horario) e;

  SELECT * INTO v_actual FROM fn_precios_cancha(p_cancha);
  IF v_actual.precio IS DISTINCT FROM round(p_precio, 2)
     OR v_actual.precio_punta IS DISTINCT FROM round(p_precio_punta, 2)
     OR v_actual.punta_desde IS DISTINCT FROM v_punta
     OR (SELECT count(*) FROM pricing_rules r WHERE r.court_id = p_cancha AND r.is_active)
        <> (CASE WHEN p_precio_punta IS NULL THEN 1 ELSE 2 END) THEN
    UPDATE pricing_rules SET is_active = false WHERE court_id = p_cancha AND is_active;
    INSERT INTO pricing_rules (court_id, name, is_peak, start_time, end_time, price_per_hour, priority)
    VALUES (p_cancha, 'Normal', false, time '00:00', time '24:00', round(p_precio, 2), 0);
    IF p_precio_punta IS NOT NULL THEN
      INSERT INTO pricing_rules (court_id, name, is_peak, start_time, end_time, price_per_hour, priority)
      VALUES (p_cancha, 'Hora punta', true, v_punta, time '24:00', round(p_precio_punta, 2), 10);
    END IF;
  END IF;

  -- Reservas que quedaron fuera del nuevo horario: siguen en pie (se avisa al dueño)
  SELECT count(*)::int INTO v_fuera
  FROM bookings b
  WHERE b.court_id = p_cancha
    AND fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed')
    AND b.ends_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM court_operating_hours h
      WHERE h.court_id = p_cancha
        AND h.day_of_week = EXTRACT(DOW FROM b.starts_at AT TIME ZONE 'America/Lima')
        AND (b.starts_at AT TIME ZONE 'America/Lima')::time >= h.open_time
        AND (b.ends_at AT TIME ZONE 'America/Lima')
            - date_trunc('day', b.starts_at AT TIME ZONE 'America/Lima') <= h.close_time::interval);

  SELECT slug INTO v_slug FROM venues WHERE id = v_c.venue_id;
  PERFORM fn_auditar('court', p_cancha::text, 'update_settings',
    jsonb_build_object('nombre', v_nombre, 'deporte', v_deporte, 'horario', p_horario,
                       'precio', p_precio, 'precio_punta', p_precio_punta, 'punta_desde', p_punta_desde));
  RETURN jsonb_build_object('id', p_cancha, 'slug', v_slug, 'fuera_de_horario', v_fuera);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_guardar_cancha(uuid, text, text, boolean, integer, jsonb, numeric, numeric, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_guardar_cancha(uuid, text, text, boolean, integer, jsonb, numeric, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Agregar y quitar canchas
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_agregar_cancha(uuid, text, text, numeric);
CREATE OR REPLACE FUNCTION fn_agregar_cancha(p_local uuid, p_nombre text, p_deporte text, p_precio numeric)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nombre  text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_deporte sport_type;
  v_slug    text;
  v_id      uuid;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(p_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  -- Bloquea el local: dos "Agregar" a la vez no pasan el límite ni duplican el nombre
  SELECT slug INTO v_slug FROM venues WHERE id = p_local AND status <> 'rejected' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_nombre) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'NOMBRE_CANCHA_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF p_deporte IS NULL OR NOT (p_deporte = ANY (enum_range(NULL::sport_type)::text[])) THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;
  v_deporte := p_deporte::sport_type;
  IF p_precio IS NULL OR p_precio < 1 OR p_precio > 1000 THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM courts WHERE venue_id = p_local AND status = 'active') >= 10 THEN
    RAISE EXCEPTION 'DEMASIADAS_CANCHAS' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM courts o WHERE o.venue_id = p_local AND o.status = 'active'
               AND fn_normalizar_texto(o.name) = fn_normalizar_texto(v_nombre)) THEN
    RAISE EXCEPTION 'CANCHA_DUPLICADA' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO courts (venue_id, name, sport, surface, sort_order)
  VALUES (p_local, v_nombre, v_deporte, fn_superficie_de(v_deporte),
          (SELECT coalesce(max(sort_order), 0) + 1 FROM courts WHERE venue_id = p_local))
  RETURNING id INTO v_id;

  INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time)
  SELECT v_id, g, time '08:00', time '23:00' FROM generate_series(0, 6) g;

  INSERT INTO pricing_rules (court_id, name, start_time, end_time, price_per_hour)
  VALUES (v_id, 'Normal', time '00:00', time '24:00', round(p_precio, 2));

  PERFORM fn_auditar('court', v_id::text, 'create',
    jsonb_build_object('local', p_local, 'nombre', v_nombre, 'deporte', v_deporte, 'precio', p_precio));
  RETURN jsonb_build_object('id', v_id, 'slug', v_slug);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_agregar_cancha(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_agregar_cancha(uuid, text, text, numeric) TO authenticated;

DROP FUNCTION IF EXISTS fn_quitar_cancha(uuid);
CREATE OR REPLACE FUNCTION fn_quitar_cancha(p_cancha uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c    courts%ROWTYPE;
  v_slug text;
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_c FROM courts WHERE id = p_cancha AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CANCHA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(v_c.venue_id) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  SELECT slug INTO v_slug FROM venues WHERE id = v_c.venue_id FOR UPDATE;
  IF fn_reservas_futuras_cancha(p_cancha) > 0 THEN
    RAISE EXCEPTION 'CANCHA_CON_RESERVAS' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM courts WHERE venue_id = v_c.venue_id AND status = 'active') <= 1 THEN
    RAISE EXCEPTION 'ULTIMA_CANCHA' USING ERRCODE = 'P0001';
  END IF;

  -- No se borra: las reservas y pagos antiguos la siguen citando
  UPDATE courts SET status = 'inactive' WHERE id = p_cancha;
  PERFORM fn_auditar('court', p_cancha::text, 'deactivate', jsonb_build_object('nombre', v_c.name));
  RETURN jsonb_build_object('id', p_cancha, 'slug', v_slug);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_quitar_cancha(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_quitar_cancha(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Administrador: locales publicados o suspendidos, con su dueño
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = fn_usuario_actual() AND role = 'admin' AND status = 'active');
$$;
REVOKE EXECUTE ON FUNCTION fn_es_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_es_admin() TO authenticated;

DROP FUNCTION IF EXISTS fn_locales_admin();
CREATE OR REPLACE FUNCTION fn_locales_admin()
RETURNS TABLE (
  id               uuid,
  nombre           varchar,
  slug             varchar,
  distrito         varchar,
  estado           venue_status,
  motivo           text,
  sin_dueno        boolean,
  dueno_nombre     varchar,
  dueno_correo     varchar,
  canchas          integer,
  reservas_futuras integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT v.id, v.name, v.slug, d.name, v.status,
           CASE WHEN v.status = 'suspended' THEN v.rejection_reason END,
           (u.role = 'admin'),
           CASE WHEN u.role = 'admin' THEN NULL ELSE u.full_name END,
           CASE WHEN u.role = 'admin' THEN NULL ELSE u.email END,
           (SELECT count(*)::int FROM courts c WHERE c.venue_id = v.id AND c.status = 'active'),
           (SELECT coalesce(sum(fn_reservas_futuras_cancha(c.id)), 0)::int
              FROM courts c WHERE c.venue_id = v.id AND c.status = 'active')
    FROM venues v
    JOIN districts d ON d.id = v.district_id
    JOIN users u ON u.id = v.owner_id
    WHERE v.status IN ('approved', 'suspended')
    ORDER BY v.status DESC, v.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_locales_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_locales_admin() TO authenticated;

-- Pasar un local a la cuenta de su dueño real. La persona debe haberse
-- registrado antes en la web; si era jugador, pasa a ser dueño.
DROP FUNCTION IF EXISTS fn_asignar_dueno(uuid, text);
CREATE OR REPLACE FUNCTION fn_asignar_dueno(p_local uuid, p_correo text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local    venues%ROWTYPE;
  v_nuevo    users%ROWTYPE;
  v_antes    uuid;
  v_cambio   boolean := false;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_local FROM venues WHERE id = p_local AND status <> 'rejected' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_nuevo FROM users
  WHERE lower(email) = lower(btrim(coalesce(p_correo, ''))) AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF v_nuevo.role = 'admin' THEN
    RAISE EXCEPTION 'CORREO_ES_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  IF v_nuevo.role = 'player' THEN
    UPDATE users SET role = 'owner' WHERE id = v_nuevo.id;
    v_cambio := true;
  END IF;
  v_antes := v_local.owner_id;
  UPDATE venues SET owner_id = v_nuevo.id WHERE id = p_local;

  PERFORM fn_auditar('venue', p_local::text, 'assign_owner',
    jsonb_build_object('antes', v_antes, 'despues', v_nuevo.id, 'ahora_es_dueno', v_cambio));
  RETURN jsonb_build_object('id', p_local, 'slug', v_local.slug, 'estado', v_local.status,
                            'dueno', v_nuevo.full_name, 'correo', v_nuevo.email,
                            'ahora_es_dueno', v_cambio);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_asignar_dueno(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_asignar_dueno(uuid, text) TO authenticated;

-- Suspender (sale del mapa y no recibe reservas nuevas) o reactivar un local.
-- Las reservas que ya tenía siguen en pie: el dueño las atiende o cancela en su agenda.
DROP FUNCTION IF EXISTS fn_cambiar_estado_local(uuid, text, text);
CREATE OR REPLACE FUNCTION fn_cambiar_estado_local(p_local uuid, p_accion text, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local  venues%ROWTYPE;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 300);
  v_estado venue_status;
  v_futuras int;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  IF p_accion IS NULL OR p_accion NOT IN ('suspender', 'reactivar') THEN
    RAISE EXCEPTION 'ACCION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_local FROM venues WHERE id = p_local FOR UPDATE;
  IF NOT FOUND OR v_local.status NOT IN ('approved', 'suspended') THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;

  IF p_accion = 'suspender' THEN
    IF v_local.status <> 'approved' THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(coalesce(v_motivo, '')) < 3 THEN
      RAISE EXCEPTION 'FALTA_MOTIVO' USING ERRCODE = 'P0001';
    END IF;
    v_estado := 'suspended';
  ELSE
    IF v_local.status <> 'suspended' THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    v_estado := 'approved';
    v_motivo := NULL;
  END IF;

  UPDATE venues
  SET status = v_estado, rejection_reason = v_motivo,
      reviewed_by = fn_usuario_actual(), reviewed_at = now()
  WHERE id = p_local;

  SELECT coalesce(sum(fn_reservas_futuras_cancha(c.id)), 0)::int INTO v_futuras
  FROM courts c WHERE c.venue_id = p_local AND c.status = 'active';

  PERFORM fn_auditar('venue', p_local::text, CASE WHEN p_accion = 'suspender' THEN 'suspend' ELSE 'reactivate' END,
    jsonb_build_object('motivo', v_motivo));
  RETURN jsonb_build_object('id', p_local, 'slug', v_local.slug, 'estado', v_estado,
                            'reservas_futuras', v_futuras);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_cambiar_estado_local(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_cambiar_estado_local(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
