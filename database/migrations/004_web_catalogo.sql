-- =====================================================================
--  ReservaYa Ayacucho - 004_web_catalogo.sql
--  Conecta la web (apps/web) con la base de datos:
--    1. fn_catalogo_canchas(): lista publica de locales aprobados para el mapa
--    2. fn_proponer_local():   registra un local desde "+ Agregar cancha"
--                               (queda EN REVISION hasta que el admin lo aprueba)
--  Ejecutar en Supabase > SQL Editor, despues de supabase_inicial.sql.
--  Se puede ejecutar mas de una vez sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Usuario "plataforma": dueno temporal de los locales que se registran
--    desde el mapa, hasta que el dueno real cree su cuenta (paso 4) y
--    el admin le asigne el local.
-- ---------------------------------------------------------------------
INSERT INTO users (id, role, full_name, email)
VALUES ('00000000-0000-0000-0000-00000000a001', 'admin',
        'ReservaYa (sin dueno asignado)', 'plataforma@reservaya.local')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 1. Utilidades de texto
-- ---------------------------------------------------------------------
-- "Jesús Nazareno" -> "jesusnazareno" (para comparar nombres sin tildes ni espacios)
CREATE OR REPLACE FUNCTION fn_normalizar_texto(p text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           translate(lower(coalesce(p, '')), 'áéíóúüñàèìòùäëïö', 'aeiouunaeiouaeio'),
           '[^a-z0-9]', '', 'g');
$$;

-- "Sport Center Wari 2" -> "sport-center-wari-2" (para la URL publica del local)
CREATE OR REPLACE FUNCTION fn_slug(p text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(
           translate(lower(coalesce(p, '')), 'áéíóúüñàèìòùäëïö', 'aeiouunaeiouaeio'),
           '[^a-z0-9]+', '-', 'g'), '-');
$$;

-- Son de uso interno: no se exponen en la API publica
REVOKE EXECUTE ON FUNCTION fn_normalizar_texto(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_slug(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Lectura publica del catalogo (RLS)
--    supabase_inicial.sql ya permite leer el catalogo. Estas politicas
--    aseguran lo que necesita el mapa (incluidos los precios) y no quitan
--    nada de lo que ya existe.
-- ---------------------------------------------------------------------
GRANT SELECT ON districts, venues, courts, pricing_rules TO anon, authenticated;

ALTER TABLE districts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_catalogo_districts ON districts;
CREATE POLICY web_catalogo_districts ON districts
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS web_catalogo_venues ON venues;
CREATE POLICY web_catalogo_venues ON venues
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS web_catalogo_courts ON courts;
CREATE POLICY web_catalogo_courts ON courts
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM venues v WHERE v.id = courts.venue_id AND v.status = 'approved'));

DROP POLICY IF EXISTS web_catalogo_pricing ON pricing_rules;
CREATE POLICY web_catalogo_pricing ON pricing_rules
  FOR SELECT TO anon, authenticated
  USING (is_active AND EXISTS (
    SELECT 1 FROM courts c JOIN venues v ON v.id = c.venue_id
    WHERE c.id = pricing_rules.court_id AND v.status = 'approved'));

-- ---------------------------------------------------------------------
-- 3. Catalogo para el mapa: una fila por local aprobado
--    SECURITY INVOKER: corre con los permisos de quien llama, asi que
--    RLS decide lo que se ve (solo locales aprobados).
-- ---------------------------------------------------------------------
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
  total_resenas integer
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
         v.whatsapp_phone, v.rating_avg, v.rating_count
  FROM venues v
  JOIN districts d ON d.id = v.district_id AND d.is_active
  WHERE v.status = 'approved' AND v.lat IS NOT NULL AND v.lng IS NOT NULL
  ORDER BY v.name;
$$;

REVOKE EXECUTE ON FUNCTION fn_catalogo_canchas() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_catalogo_canchas() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Registrar un local desde la web ("+ Agregar cancha")
--    SECURITY DEFINER: la web no puede escribir en venues directamente
--    (RLS lo impide); solo puede llamar a esta funcion, que valida todo y
--    deja el local en 'pending_review'. Nadie puede publicar sin revision.
--
--    Errores que devuelve (la web los traduce):
--      NOMBRE_INVALIDO, FUERA_DE_HUAMANGA, DISTRITO_NO_ENCONTRADO,
--      DISTRITO_NO_ACTIVO, PRECIO_INVALIDO, LOCAL_DUPLICADO,
--      DEMASIADAS_PROPUESTAS
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_proponer_local(text, text, numeric, numeric, text, text, text[], boolean, numeric, text);
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
  -- Nombre
  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'NOMBRE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Ubicacion dentro de la provincia de Huamanga
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat NOT BETWEEN -13.60 AND -12.80
     OR p_lng NOT BETWEEN -74.75 AND -73.75 THEN
    RAISE EXCEPTION 'FUERA_DE_HUAMANGA' USING ERRCODE = 'P0001';
  END IF;

  -- Distrito: acepta el slug ("san-juan-bautista") o el nombre
  -- ("Andrés Avelino Cáceres D." coincide con "Andrés Avelino Cáceres Dorregaray")
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

  -- Precio por hora (opcional)
  IF p_precio IS NOT NULL AND (p_precio <= 0 OR p_precio > 1000) THEN
    RAISE EXCEPTION 'PRECIO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  -- Freno contra abuso mientras no hay login: maximo 100 registros por hora
  IF (SELECT count(*) FROM venues
      WHERE owner_id = c_plataforma AND created_at > now() - interval '1 hour') >= 100 THEN
    RAISE EXCEPTION 'DEMASIADAS_PROPUESTAS' USING ERRCODE = 'P0001';
  END IF;

  -- Duplicados: mismo nombre en el mismo distrito, o un local a menos de ~25 m
  IF EXISTS (
    SELECT 1 FROM venues v
    WHERE v.status <> 'rejected'
      AND ((v.district_id = v_dist.id AND fn_normalizar_texto(v.name) = fn_normalizar_texto(v_nombre))
           OR (v.lat BETWEEN p_lat - 0.00025 AND p_lat + 0.00025
               AND v.lng BETWEEN p_lng - 0.00025 AND p_lng + 0.00025))
  ) THEN
    RAISE EXCEPTION 'LOCAL_DUPLICADO' USING ERRCODE = 'P0001';
  END IF;

  -- Deportes validos (los desconocidos se ignoran). Si no queda ninguno: futbol
  SELECT coalesce(array_agg(DISTINCT s::sport_type), ARRAY['futbol'::sport_type]) INTO v_deportes
  FROM unnest(coalesce(p_deportes, '{}')) s
  WHERE s = ANY (enum_range(NULL::sport_type)::text[]);

  -- Telefono: 9 digitos peruanos -> +51XXXXXXXXX
  v_tel := CASE
             WHEN v_tel ~ '^9[0-9]{8}$'   THEN '+51' || v_tel
             WHEN v_tel ~ '^519[0-9]{8}$' THEN '+'   || v_tel
             ELSE NULL
           END;

  -- Slug unico para la URL publica
  v_base := left(coalesce(nullif(fn_slug(v_nombre), ''), 'cancha'), 120);
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM venues WHERE venues.slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  END LOOP;

  INSERT INTO venues (owner_id, district_id, name, slug, address, address_reference,
                      lat, lng, whatsapp_phone, status)
  VALUES (c_plataforma, v_dist.id, v_nombre, v_slug,
          left(coalesce(nullif(btrim(p_direccion), ''), 'Por confirmar'), 200),
          left(nullif(btrim(p_referencia), ''), 200),
          round(p_lat, 6), round(p_lng, 6), v_tel, 'pending_review')
  RETURNING id INTO v_venue;

  -- Una cancha por deporte, con horario y precio por defecto (el dueno los cambia despues)
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

REVOKE EXECUTE ON FUNCTION fn_proponer_local(text, text, numeric, numeric, text, text, text[], boolean, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_proponer_local(text, text, numeric, numeric, text, text, text[], boolean, numeric, text)
  TO anon, authenticated, service_role;

-- Que la API de Supabase vea las funciones nuevas sin esperar
NOTIFY pgrst, 'reload schema';

-- =====================================================================
--  Para APROBAR los locales registrados desde la web (hasta tener el
--  panel de admin en el paso 7), ejecuta en el SQL Editor:
--
--    -- ver los que estan en revision
--    SELECT name, address, created_at FROM venues
--    WHERE status = 'pending_review' ORDER BY created_at;
--
--    -- aprobar todos
--    UPDATE venues SET status = 'approved', reviewed_at = now()
--    WHERE status = 'pending_review';
-- =====================================================================
