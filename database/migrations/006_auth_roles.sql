-- =====================================================================
--  ReservaYa Ayacucho - 006_auth_roles.sql
--  Cuentas con Supabase Auth y roles (jugador, dueno, admin).
--    1. Al registrarse, cada cuenta crea su perfil en public.users.
--       El rol sale de lo que eligio en el registro: jugador o dueno.
--       Nadie puede registrarse como admin: eso se asigna con SQL.
--    2. Cada usuario puede leer solo su propio perfil.
--    3. "+ Agregar cancha" queda solo para duenos y admin.
--       - Dueno: la cancha queda a su nombre.
--       - Admin: la cancha queda "sin dueno asignado" (usuario plataforma).
--    4. fn_mis_pendientes(): canchas en revision que puede ver/editar
--       (el dueno, las suyas; el admin, todas).
--    5. fn_revisar_local(): el admin aprueba o rechaza desde /admin
--       (ya no hace falta el UPDATE a mano).
--  Ejecutar en Supabase > SQL Editor, despues de 005_web_propuestas.sql.
--  Se puede ejecutar mas de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil automatico al registrarse
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_crear_perfil(
  p_auth_id  uuid,
  p_email    text,
  p_meta     jsonb
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id     uuid;
  v_rol    user_role := CASE lower(coalesce(p_meta ->> 'rol', ''))
                          WHEN 'dueno' THEN 'owner'::user_role
                          ELSE 'player'::user_role   -- 'admin' nunca se acepta desde el registro
                        END;
  v_nombre text := left(coalesce(nullif(btrim(p_meta ->> 'nombre'), ''),
                                 split_part(coalesce(p_email, ''), '@', 1),
                                 'Usuario'), 120);
  v_tel    text := regexp_replace(coalesce(p_meta ->> 'telefono', ''), '[^0-9]', '', 'g');
BEGIN
  SELECT id INTO v_id FROM users WHERE auth_user_id = p_auth_id;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  v_tel := CASE
             WHEN v_tel ~ '^9[0-9]{8}$'   THEN '+51' || v_tel
             WHEN v_tel ~ '^519[0-9]{8}$' THEN '+'   || v_tel
             ELSE NULL
           END;

  -- Correo o celular repetidos en otro perfil: se guarda sin ese dato
  -- (nunca se "une" a un perfil existente: eso permitiria robar cuentas).
  IF EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(p_email)) THEN p_email := NULL; END IF;
  IF v_tel IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE phone = v_tel) THEN v_tel := NULL; END IF;

  INSERT INTO users (auth_user_id, role, full_name, email, phone)
  VALUES (p_auth_id, v_rol, v_nombre, p_email, v_tel)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_crear_perfil(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger en auth.users: si algo falla, el registro NO se bloquea
-- (el perfil se crea igual la primera vez que la persona entra, ver fn_mi_perfil).
CREATE OR REPLACE FUNCTION fn_trg_nuevo_usuario_auth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM fn_crear_perfil(NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data, '{}'::jsonb));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'No se pudo crear el perfil de %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nuevo_usuario_auth ON auth.users;
CREATE TRIGGER trg_nuevo_usuario_auth
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION fn_trg_nuevo_usuario_auth();

-- ---------------------------------------------------------------------
-- 2. Cada usuario lee solo su propio perfil
-- ---------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON users TO authenticated;

DROP POLICY IF EXISTS users_leer_propio ON users;
CREATE POLICY users_leer_propio ON users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Id de public.users de quien llama (NULL si no inicio sesion)
CREATE OR REPLACE FUNCTION fn_usuario_actual()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION fn_usuario_actual() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_usuario_actual() TO authenticated;

-- Perfil de quien llama. Si no existe (el trigger fallo), lo crea.
DROP FUNCTION IF EXISTS fn_mi_perfil();
CREATE OR REPLACE FUNCTION fn_mi_perfil()
RETURNS TABLE (id uuid, rol user_role, nombre varchar, email varchar, telefono varchar, estado user_status)
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
    SELECT u.id, u.role, u.full_name, u.email, u.phone, u.status
    FROM users u WHERE u.auth_user_id = v_uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_mi_perfil() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_mi_perfil() TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Registrar canchas: solo duenos y admin
--    (reemplaza la version de 004_web_catalogo.sql; las validaciones son las mismas)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_proponer_local(
  p_nombre     text,
  p_distrito   text,
  p_lat        numeric,
  p_lng        numeric,
  p_direccion  text    DEFAULT NULL,
  p_referencia text    DEFAULT NULL,
  p_deportes   text[]  DEFAULT ARRAY['futbol'],
  p_techada    boolean DEFAULT false,
  p_precio     numeric DEFAULT NULL,
  p_telefono   text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_plataforma constant uuid := '00000000-0000-0000-0000-00000000a001';
  v_quien    users%ROWTYPE;
  v_owner    uuid;
  v_nombre   text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_dist_txt text := btrim(regexp_replace(coalesce(p_distrito, ''), '\s+[A-Za-z]\.$', ''));
  v_dist     districts%ROWTYPE;
  v_deportes sport_type[];
  v_sport    sport_type;
  v_tel      text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
  v_base     text;
  v_slug     text;
  v_i        int := 1;
  v_n        int := 0;
  v_venue    uuid;
  v_court    uuid;
BEGIN
  -- Quien registra
  SELECT * INTO v_quien FROM users
  WHERE auth_user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLO_DUENOS' USING ERRCODE = 'P0001';
  END IF;
  v_owner := CASE WHEN v_quien.role = 'admin' THEN c_plataforma ELSE v_quien.id END;

  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'NOMBRE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat NOT BETWEEN -13.60 AND -12.80
     OR p_lng NOT BETWEEN -74.75 AND -73.75 THEN
    RAISE EXCEPTION 'FUERA_DE_HUAMANGA' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(fn_normalizar_texto(v_dist_txt)) < 4 THEN
    RAISE EXCEPTION 'DISTRITO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_dist
  FROM districts d
  WHERE d.slug = lower(v_dist_txt)
     OR fn_normalizar_texto(d.name) LIKE fn_normalizar_texto(v_dist_txt) || '%'
  ORDER BY (d.slug = lower(v_dist_txt)) DESC, d.id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DISTRITO_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_dist.is_active THEN
    RAISE EXCEPTION 'DISTRITO_NO_ACTIVO' USING ERRCODE = 'P0001';
  END IF;

  IF p_precio IS NOT NULL AND (p_precio <= 0 OR p_precio > 1000) THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Freno contra abuso: maximo 100 registros por hora por persona
  IF (SELECT count(*) FROM venues
      WHERE owner_id = v_owner AND created_at > now() - interval '1 hour') >= 100 THEN
    RAISE EXCEPTION 'DEMASIADAS_PROPUESTAS' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM venues v
    WHERE v.status <> 'rejected'
      AND ((v.district_id = v_dist.id AND fn_normalizar_texto(v.name) = fn_normalizar_texto(v_nombre))
           OR (v.lat BETWEEN p_lat - 0.00025 AND p_lat + 0.00025
               AND v.lng BETWEEN p_lng - 0.00025 AND p_lng + 0.00025))
  ) THEN
    RAISE EXCEPTION 'LOCAL_DUPLICADO' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(DISTINCT s::sport_type), ARRAY['futbol'::sport_type]) INTO v_deportes
  FROM unnest(coalesce(p_deportes, '{}')) s
  WHERE s = ANY (enum_range(NULL::sport_type)::text[]);

  v_tel := CASE
             WHEN v_tel ~ '^9[0-9]{8}$'   THEN '+51' || v_tel
             WHEN v_tel ~ '^519[0-9]{8}$' THEN '+'   || v_tel
             ELSE NULL
           END;

  v_base := left(coalesce(nullif(fn_slug(v_nombre), ''), 'cancha'), 120);
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM venues WHERE venues.slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  END LOOP;

  INSERT INTO venues (owner_id, district_id, name, slug, address, address_reference,
                      lat, lng, whatsapp_phone, status)
  VALUES (v_owner, v_dist.id, v_nombre, v_slug,
          left(coalesce(nullif(btrim(p_direccion), ''), 'Por confirmar'), 200),
          left(nullif(btrim(p_referencia), ''), 200),
          round(p_lat, 6), round(p_lng, 6), v_tel, 'pending_review')
  RETURNING id INTO v_venue;

  FOREACH v_sport IN ARRAY v_deportes LOOP
    v_n := v_n + 1;
    INSERT INTO courts (venue_id, name, sport, surface, is_covered, sort_order)
    VALUES (v_venue,
            CASE v_sport WHEN 'futbol' THEN 'Cancha de fútbol'
                         WHEN 'futsal' THEN 'Cancha de futsal'
                         WHEN 'voley'  THEN 'Cancha de vóley'
                         WHEN 'basquet' THEN 'Cancha de básquet'
                         ELSE 'Cancha multideporte' END,
            v_sport,
            CASE WHEN v_sport = 'futbol' THEN 'grass_sintetico'::surface_type ELSE 'losa'::surface_type END,
            coalesce(p_techada, false), v_n)
    RETURNING id INTO v_court;

    INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time)
    SELECT v_court, g, time '08:00', time '23:00' FROM generate_series(0, 6) g;

    IF p_precio IS NOT NULL THEN
      INSERT INTO pricing_rules (court_id, name, start_time, end_time, price_per_hour)
      VALUES (v_court, 'Normal', time '08:00', time '23:00', round(p_precio, 2));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_venue, 'slug', v_slug,
                            'estado', 'pending_review', 'canchas', v_n);
END;
$$;

-- Quitar una cancha en revision: su dueno, o el admin
CREATE OR REPLACE FUNCTION fn_retirar_propuesta(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_plataforma constant uuid := '00000000-0000-0000-0000-00000000a001';
  v_quien users%ROWTYPE;
BEGIN
  SELECT * INTO v_quien FROM users
  WHERE auth_user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLO_DUENOS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM venues
  WHERE id = p_id AND status = 'pending_review'
    AND (owner_id = v_quien.id OR v_quien.role = 'admin')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPUESTA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM pricing_rules         WHERE court_id IN (SELECT id FROM courts WHERE venue_id = p_id);
  DELETE FROM court_operating_hours WHERE court_id IN (SELECT id FROM courts WHERE venue_id = p_id);
  DELETE FROM courts                WHERE venue_id = p_id;
  DELETE FROM venues                WHERE id = p_id;
  RETURN true;
END;
$$;

-- fn_reemplazar_propuesta (005) usa las dos de arriba: hereda los permisos nuevos.

-- Solo usuarios con sesion pueden escribir
REVOKE EXECUTE ON FUNCTION fn_proponer_local(text, text, numeric, numeric, text, text, text[], boolean, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_retirar_propuesta(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION fn_reemplazar_propuesta(uuid, text, text, numeric, numeric, text, text, text[], boolean, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_proponer_local(text, text, numeric, numeric, text, text, text[], boolean, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_retirar_propuesta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_reemplazar_propuesta(uuid, text, text, numeric, numeric, text, text, text[], boolean, numeric, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Canchas en revision visibles para quien las puede revisar
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_mis_pendientes();
CREATE OR REPLACE FUNCTION fn_mis_pendientes()
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
  total_resenas integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH yo AS (
    SELECT id, role FROM users
    WHERE auth_user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  )
  SELECT v.id, v.slug, v.name, d.name, v.address, v.address_reference, v.lat, v.lng,
         COALESCE(ARRAY(SELECT DISTINCT c.sport::text FROM courts c
                        WHERE c.venue_id = v.id AND c.status = 'active' ORDER BY 1), '{}'),
         COALESCE((SELECT bool_or(c.is_covered) FROM courts c
                   WHERE c.venue_id = v.id AND c.status = 'active'), false),
         (SELECT min(p.price_per_hour)
            FROM pricing_rules p JOIN courts c ON c.id = p.court_id
           WHERE c.venue_id = v.id AND c.status = 'active' AND p.is_active),
         v.whatsapp_phone, v.rating_avg, v.rating_count
  FROM venues v
  JOIN districts d ON d.id = v.district_id
  JOIN yo ON yo.role = 'admin' OR v.owner_id = yo.id
  WHERE v.status = 'pending_review'
  ORDER BY v.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION fn_mis_pendientes() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_mis_pendientes() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Aprobar o rechazar una cancha (solo admin) desde /admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revisar_local(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin uuid;
  v_nombre text;
BEGIN
  SELECT id INTO v_admin FROM users
  WHERE auth_user_id = auth.uid() AND status = 'active' AND role = 'admin';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  UPDATE venues
  SET status           = CASE WHEN p_aprobar THEN 'approved'::venue_status ELSE 'rejected'::venue_status END,
      reviewed_by      = v_admin,
      reviewed_at      = now(),
      rejection_reason = CASE WHEN p_aprobar THEN NULL ELSE left(nullif(btrim(p_motivo), ''), 500) END
  WHERE id = p_id AND status = 'pending_review'
  RETURNING name INTO v_nombre;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROPUESTA_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('id', p_id, 'nombre', v_nombre,
                            'estado', CASE WHEN p_aprobar THEN 'approved' ELSE 'rejected' END);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_revisar_local(uuid, boolean, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_revisar_local(uuid, boolean, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
--  Para convertir TU cuenta en administrador (despues de registrarte en
--  la web), ejecuta en el SQL Editor cambiando el correo:
--
--    UPDATE users SET role = 'admin' WHERE email = 'tu-correo@ejemplo.com';
-- =====================================================================
