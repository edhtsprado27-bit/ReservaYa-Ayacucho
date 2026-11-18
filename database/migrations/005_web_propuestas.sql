-- =====================================================================
--  ReservaYa Ayacucho - 005_web_propuestas.sql
--  Permite corregir o quitar desde la web una cancha que TODAVIA esta
--  en revision ("Editar" y "Quitar" en la lista del mapa).
--  Una cancha ya aprobada no se puede tocar desde la web: se cambia en
--  Supabase (y desde el paso 7, en el panel de admin).
--  Ejecutar en Supabase > SQL Editor, despues de 004_web_catalogo.sql.
--  Se puede ejecutar mas de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quitar una cancha en revision
--   Solo funciona con el id que devolvio fn_proponer_local (un uuid que
--   solo conoce el navegador que la registro).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_retirar_propuesta(uuid);
CREATE OR REPLACE FUNCTION fn_retirar_propuesta(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_plataforma constant uuid := '00000000-0000-0000-0000-00000000a001';
BEGIN
  -- Bloquea la fila: si dos pedidos llegan juntos, uno espera al otro
  PERFORM 1 FROM venues
  WHERE id = p_id AND status = 'pending_review' AND owner_id = c_plataforma
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

REVOKE EXECUTE ON FUNCTION fn_retirar_propuesta(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_retirar_propuesta(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Corregir una cancha en revision
--   Quita la version anterior y registra la nueva en UNA sola transaccion:
--   si la nueva tiene un error (ej. fuera de Huamanga), la anterior no se pierde.
--   Devuelve lo mismo que fn_proponer_local (con un id nuevo).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_reemplazar_propuesta(uuid, text, text, numeric, numeric, text, text, text[], boolean, numeric, text);
CREATE OR REPLACE FUNCTION fn_reemplazar_propuesta(
  p_id         uuid,
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
BEGIN
  PERFORM fn_retirar_propuesta(p_id);
  RETURN fn_proponer_local(p_nombre, p_distrito, p_lat, p_lng, p_direccion,
                           p_referencia, p_deportes, p_techada, p_precio, p_telefono);
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_reemplazar_propuesta(uuid, text, text, numeric, numeric, text, text, text[], boolean, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_reemplazar_propuesta(uuid, text, text, numeric, numeric, text, text, text[], boolean, numeric, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
