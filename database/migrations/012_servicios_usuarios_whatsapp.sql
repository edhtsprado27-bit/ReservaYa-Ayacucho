-- =====================================================================
--  ReservaYa Ayacucho - 012_servicios_usuarios_whatsapp.sql
--    1. Servicios del local (vestuarios, duchas, estacionamiento...).
--       El dueño los marca en "Configurar mi local"; salen en la ficha
--       del local y el mapa se puede filtrar por ellos (RF01, RF03).
--    2. Gestión de usuarios para el admin (RF08): buscar cuentas,
--       cambiar entre jugador y dueño, suspender y reactivar con motivo.
--    3. WhatsApp de soporte (RF15): el admin lo escribe en /admin y sale
--       en el botón "Ayuda" de toda la web. Son enlaces wa.me: no usan
--       la API de WhatsApp ni cuestan nada.
--    4. El admin ve el celular del dueño de cada local para escribirle.
--  Ejecutar en Supabase > SQL Editor, despues de 011_configuracion_local.sql.
--  Se puede ejecutar mas de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Servicios del local
-- ---------------------------------------------------------------------
-- Lista fija de servicios (el orden de inserción es el orden en pantalla)
INSERT INTO amenities (code, name, icon) VALUES
  ('vestuarios',      'Vestuarios',           'vestuario'),
  ('duchas',          'Duchas',               'ducha'),
  ('banos',           'Baños',                'bano'),
  ('estacionamiento', 'Estacionamiento',      'auto'),
  ('cafeteria',       'Cafetería o kiosko',   'cafe'),
  ('tribuna',         'Tribuna',              'tribuna'),
  ('iluminacion',     'Iluminación nocturna', 'foco'),
  ('balon_incluido',  'Balón incluido',       'balon')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon;

COMMENT ON COLUMN amenities.code IS
  'vestuarios, duchas, banos, estacionamiento, cafeteria, tribuna, iluminacion, balon_incluido';

-- El catálogo público los lee con los permisos de quien pide (RLS: lectura libre)
GRANT SELECT ON amenities, venue_amenities TO anon, authenticated;

-- Códigos de los servicios de un local, en el orden de la lista
CREATE OR REPLACE FUNCTION fn_servicios_local(p_local uuid)
RETURNS text[]
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY(
    SELECT a.code::text
    FROM venue_amenities va JOIN amenities a ON a.id = va.amenity_id
    WHERE va.venue_id = p_local
    ORDER BY a.id);
$$;
REVOKE EXECUTE ON FUNCTION fn_servicios_local(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_servicios_local(uuid) TO anon, authenticated;

-- El dueño (o el admin) marca los servicios de su local.
-- Reemplaza la lista completa: lo que no venga se quita.
DROP FUNCTION IF EXISTS fn_guardar_servicios(uuid, text[]);
CREATE OR REPLACE FUNCTION fn_guardar_servicios(p_local uuid, p_servicios text[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local   venues%ROWTYPE;
  v_codigos text[] := ARRAY(
    SELECT DISTINCT lower(btrim(x)) FROM unnest(coalesce(p_servicios, '{}'::text[])) AS x
    WHERE btrim(coalesce(x, '')) <> '');
BEGIN
  IF fn_usuario_actual() IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT fn_administra_local(p_local) THEN
    RAISE EXCEPTION 'LOCAL_AJENO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_local FROM venues WHERE id = p_local AND status <> 'rejected' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOCAL_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_codigos) AS c(codigo)
             WHERE NOT EXISTS (SELECT 1 FROM amenities a WHERE a.code = c.codigo)) THEN
    RAISE EXCEPTION 'SERVICIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM venue_amenities va
  USING amenities a
  WHERE va.venue_id = p_local AND a.id = va.amenity_id AND NOT (a.code = ANY (v_codigos));

  INSERT INTO venue_amenities (venue_id, amenity_id)
  SELECT p_local, a.id FROM amenities a WHERE a.code = ANY (v_codigos)
  ON CONFLICT DO NOTHING;

  PERFORM fn_auditar('venue', p_local::text, 'update_amenities',
    jsonb_build_object('servicios', to_jsonb(fn_servicios_local(p_local))));
  RETURN jsonb_build_object('id', p_local, 'slug', v_local.slug,
                            'servicios', to_jsonb(fn_servicios_local(p_local)));
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_guardar_servicios(uuid, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_guardar_servicios(uuid, text[]) TO authenticated;

-- Catálogo del mapa (misma función de 004, con los servicios al final)
DROP FUNCTION IF EXISTS fn_catalogo_canchas();
CREATE OR REPLACE FUNCTION fn_catalogo_canchas()
RETURNS TABLE (
  id            uuid,
  slug          varchar,
  nombre        varchar,
  distrito      varchar,
  direccion     varchar,
  referencia    varchar,
  lat           numeric,
  lng           numeric,
  deportes      text[],
  techada       boolean,
  precio_desde  numeric,
  telefono      varchar,
  rating        numeric,
  total_resenas integer,
  servicios     text[]
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.slug, v.name, d.name, v.address, v.address_reference, v.lat, v.lng,
         COALESCE(ARRAY(SELECT DISTINCT c.sport::text FROM courts c
                        WHERE c.venue_id = v.id AND c.status = 'active' ORDER BY 1), '{}'),
         COALESCE((SELECT bool_or(c.is_covered) FROM courts c
                   WHERE c.venue_id = v.id AND c.status = 'active'), false),
         (SELECT min(p.price_per_hour)
            FROM pricing_rules p JOIN courts c ON c.id = p.court_id
           WHERE c.venue_id = v.id AND c.status = 'active' AND p.is_active
             AND (p.valid_to IS NULL OR p.valid_to >= current_date)),
         v.whatsapp_phone, v.rating_avg, v.rating_count,
         fn_servicios_local(v.id)
  FROM venues v
  JOIN districts d ON d.id = v.district_id AND d.is_active
  WHERE v.status = 'approved' AND v.lat IS NOT NULL AND v.lng IS NOT NULL
  ORDER BY v.name;
$$;
REVOKE EXECUTE ON FUNCTION fn_catalogo_canchas() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_catalogo_canchas() TO anon, authenticated, service_role;

-- Ficha pública del local (misma función de 007, con los servicios)
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
           'servicios',         to_jsonb(fn_servicios_local(v.id)),
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

-- Configuración del local (misma función de 011, con los servicios)
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
      'horas_cancelacion', v.cancellation_hours,
      'servicios', to_jsonb(fn_servicios_local(v.id))),
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
-- 2. Gestión de usuarios (solo el admin)
-- ---------------------------------------------------------------------
-- Motivo de la suspensión: la persona lo ve al intentar ingresar
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason varchar(300);

-- Perfil de quien llama (misma función de 006, con el motivo al final)
DROP FUNCTION IF EXISTS fn_mi_perfil();
CREATE OR REPLACE FUNCTION fn_mi_perfil()
RETURNS TABLE (id uuid, rol user_role, nombre varchar, email varchar, telefono varchar,
               estado user_status, motivo varchar)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = v_uid) THEN
    PERFORM fn_crear_perfil(v_uid, a.email, coalesce(a.raw_user_meta_data, '{}'::jsonb))
    FROM auth.users a WHERE a.id = v_uid;
  END IF;
  RETURN QUERY
    SELECT u.id, u.role, u.full_name, u.email, u.phone, u.status,
           CASE WHEN u.status = 'suspended' THEN u.status_reason END
    FROM users u WHERE u.auth_user_id = v_uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_mi_perfil() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_mi_perfil() TO authenticated;

-- Lista de cuentas para /admin/usuarios.
--   p_buscar: parte del nombre, correo o celular (opcional)
--   p_filtro: todos | jugadores | duenos | admins | suspendidos
-- Las 100 más recientes. No incluye la cuenta interna "sin dueño asignado".
DROP FUNCTION IF EXISTS fn_usuarios_admin(text, text);
CREATE OR REPLACE FUNCTION fn_usuarios_admin(p_buscar text DEFAULT NULL, p_filtro text DEFAULT 'todos')
RETURNS TABLE (
  id               uuid,
  nombre           varchar,
  correo           varchar,
  telefono         varchar,
  rol              user_role,
  estado           user_status,
  motivo           varchar,
  creado           timestamptz,
  ultimo_ingreso   timestamptz,
  locales          integer,
  reservas         integer,
  soy_yo           boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_plataforma constant uuid := '00000000-0000-0000-0000-00000000a001';
  v_texto  text := btrim(coalesce(p_buscar, ''));
  v_norm   text := fn_normalizar_texto(p_buscar);
  v_digitos text := regexp_replace(coalesce(p_buscar, ''), '\D', '', 'g');
  v_filtro text := coalesce(nullif(btrim(p_filtro), ''), 'todos');
  v_yo     uuid := fn_usuario_actual();
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  IF v_filtro NOT IN ('todos', 'jugadores', 'duenos', 'admins', 'suspendidos') THEN
    RAISE EXCEPTION 'FILTRO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status,
           CASE WHEN u.status = 'suspended' THEN u.status_reason END,
           u.created_at,
           (SELECT a.last_sign_in_at FROM auth.users a WHERE a.id = u.auth_user_id),
           (SELECT count(*)::int FROM venues v WHERE v.owner_id = u.id AND v.status <> 'rejected'),
           (SELECT count(*)::int FROM bookings b WHERE b.player_id = u.id),
           (u.id = v_yo)
    FROM users u
    WHERE u.id <> c_plataforma
      AND u.status <> 'deleted'
      AND (v_filtro = 'todos'
           OR (v_filtro = 'jugadores'   AND u.role = 'player')
           OR (v_filtro = 'duenos'      AND u.role = 'owner')
           OR (v_filtro = 'admins'      AND u.role = 'admin')
           OR (v_filtro = 'suspendidos' AND u.status = 'suspended'))
      AND (v_texto = ''
           OR (char_length(v_norm) >= 2 AND fn_normalizar_texto(u.full_name) LIKE '%' || v_norm || '%')
           OR lower(coalesce(u.email, '')) LIKE '%' || lower(v_texto) || '%'
           OR (char_length(v_digitos) >= 3 AND coalesce(u.phone, '') LIKE '%' || v_digitos || '%'))
    ORDER BY u.created_at DESC
    LIMIT 100;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_usuarios_admin(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_usuarios_admin(text, text) TO authenticated;

-- Cuenta que el admin puede cambiar: existe, no está borrada y no es admin
-- (así ningún admin se quita el rol ni se suspende a sí mismo).
CREATE OR REPLACE FUNCTION fn_usuario_gestionable(p_usuario uuid)
RETURNS users
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v users%ROWTYPE;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v FROM users
  WHERE id = p_usuario AND status <> 'deleted' AND id <> '00000000-0000-0000-0000-00000000a001'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF v.role = 'admin' THEN
    RAISE EXCEPTION 'USUARIO_ES_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_usuario_gestionable(uuid) FROM PUBLIC, anon, authenticated;

-- Cambiar una cuenta entre jugador y dueño.
-- Un dueño con locales (publicados, suspendidos o en revisión) no puede
-- volver a jugador: primero se asigna el local a otra cuenta.
DROP FUNCTION IF EXISTS fn_cambiar_rol(uuid, text);
CREATE OR REPLACE FUNCTION fn_cambiar_rol(p_usuario uuid, p_rol text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v     users%ROWTYPE;
  v_rol user_role;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('jugador', 'dueno') THEN
    RAISE EXCEPTION 'ROL_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  v := fn_usuario_gestionable(p_usuario);
  v_rol := (CASE p_rol WHEN 'dueno' THEN 'owner' ELSE 'player' END)::user_role;

  IF v_rol = 'player' AND EXISTS (
       SELECT 1 FROM venues ve WHERE ve.owner_id = v.id AND ve.status <> 'rejected') THEN
    RAISE EXCEPTION 'DUENO_CON_LOCALES' USING ERRCODE = 'P0001';
  END IF;

  IF v.role <> v_rol THEN
    UPDATE users SET role = v_rol WHERE users.id = v.id;
    PERFORM fn_auditar('user', v.id::text, 'change_role',
      jsonb_build_object('antes', v.role, 'despues', v_rol));
  END IF;
  RETURN jsonb_build_object('id', v.id, 'rol', p_rol, 'cambio', v.role <> v_rol);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_cambiar_rol(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_cambiar_rol(uuid, text) TO authenticated;

-- Suspender (no puede ingresar ni reservar) o reactivar una cuenta.
-- Sus reservas y locales siguen en pie: el admin decide aparte sobre ellos.
DROP FUNCTION IF EXISTS fn_cambiar_estado_usuario(uuid, text, text);
CREATE OR REPLACE FUNCTION fn_cambiar_estado_usuario(p_usuario uuid, p_accion text, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v        users%ROWTYPE;
  v_motivo text := left(nullif(btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), ''), 300);
  v_estado user_status;
  v_reservas int;
  v_locales  int;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  IF p_accion IS NULL OR p_accion NOT IN ('suspender', 'reactivar') THEN
    RAISE EXCEPTION 'ACCION_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  v := fn_usuario_gestionable(p_usuario);

  IF p_accion = 'suspender' THEN
    IF v.status <> 'active' THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(coalesce(v_motivo, '')) < 3 THEN
      RAISE EXCEPTION 'FALTA_MOTIVO' USING ERRCODE = 'P0001';
    END IF;
    v_estado := 'suspended';
  ELSE
    IF v.status <> 'suspended' THEN
      RAISE EXCEPTION 'ACCION_NO_PERMITIDA' USING ERRCODE = 'P0001';
    END IF;
    v_estado := 'active';
    v_motivo := NULL;
  END IF;

  UPDATE users SET status = v_estado, status_reason = v_motivo WHERE users.id = v.id;

  SELECT count(*)::int INTO v_reservas FROM bookings b
  WHERE b.player_id = v.id AND b.starts_at > now()
    AND fn_estado_visible(b.status, b.hold_expires_at) IN ('pending_payment', 'payment_review', 'confirmed');
  SELECT count(*)::int INTO v_locales FROM venues ve
  WHERE ve.owner_id = v.id AND ve.status = 'approved';

  PERFORM fn_auditar('user', v.id::text, CASE WHEN p_accion = 'suspender' THEN 'suspend' ELSE 'reactivate' END,
    jsonb_build_object('motivo', v_motivo));
  RETURN jsonb_build_object('id', v.id, 'estado', v_estado,
                            'reservas_futuras', v_reservas, 'locales_publicados', v_locales);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_cambiar_estado_usuario(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_cambiar_estado_usuario(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Ajustes de la plataforma: WhatsApp de soporte
--    Solo se tocan con estas funciones (RLS sin políticas: nadie lee ni
--    escribe la tabla directo desde la API).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key        varchar(40) PRIMARY KEY,
  value      text,
  updated_by uuid REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;

-- Lo que cualquiera puede ver (el botón "Ayuda" de la web)
CREATE OR REPLACE FUNCTION fn_ajustes_publicos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'whatsapp_soporte', (SELECT s.value FROM app_settings s WHERE s.key = 'whatsapp_soporte'));
$$;
REVOKE EXECUTE ON FUNCTION fn_ajustes_publicos() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_ajustes_publicos() TO anon, authenticated;

-- El admin guarda el WhatsApp de soporte. Vacío = quitarlo (el botón se oculta).
DROP FUNCTION IF EXISTS fn_guardar_ajustes(text);
CREATE OR REPLACE FUNCTION fn_guardar_ajustes(p_whatsapp_soporte text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_texto text := btrim(coalesce(p_whatsapp_soporte, ''));
  v_tel   text;
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  IF v_texto <> '' THEN
    v_tel := fn_celular_valido(v_texto);
    IF v_tel IS NULL THEN
      RAISE EXCEPTION 'TELEFONO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    v_tel := '+51' || v_tel;
  END IF;

  INSERT INTO app_settings (key, value, updated_by, updated_at)
  VALUES ('whatsapp_soporte', v_tel, fn_usuario_actual(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();

  PERFORM fn_auditar('settings', 'whatsapp_soporte', 'update_settings',
    jsonb_build_object('whatsapp_soporte', v_tel));
  RETURN fn_ajustes_publicos();
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_guardar_ajustes(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_guardar_ajustes(text) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Locales publicados para el admin (misma función de 011, con el
--    celular del dueño y el WhatsApp del local al final)
-- ---------------------------------------------------------------------
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
  reservas_futuras integer,
  dueno_telefono   varchar,
  whatsapp         varchar
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
              FROM courts c WHERE c.venue_id = v.id AND c.status = 'active'),
           CASE WHEN u.role = 'admin' THEN NULL ELSE u.phone END,
           v.whatsapp_phone
    FROM venues v
    JOIN districts d ON d.id = v.district_id
    JOIN users u ON u.id = v.owner_id
    WHERE v.status IN ('approved', 'suspended')
    ORDER BY v.status DESC, v.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_locales_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_locales_admin() TO authenticated;

-- Que la API (PostgREST) vea las funciones nuevas
NOTIFY pgrst, 'reload schema';
