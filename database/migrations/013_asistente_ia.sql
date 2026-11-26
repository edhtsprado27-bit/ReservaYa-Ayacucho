-- =====================================================================
--  ReservaYa Ayacucho - 013_asistente_ia.sql
--  Asistente con IA (RF09, HU08): configuración del modelo y cupo diario.
--
--  Cómo trabaja el asistente (ADR-015):
--    - Lo simple ("fútbol en Carmen Alto mañana a las 7") lo entiende con
--      reglas, al instante y sin gastar IA.
--    - Lo libre o las dudas ("¿qué pasa si no pago a tiempo?") van a la IA
--      de OpenRouter, solo para cuentas con sesión y con un cupo diario.
--    - Las canchas, precios y horarios SIEMPRE salen de la base de datos:
--      la IA solo interpreta lo que pide la persona.
--
--  Por qué un cupo: los modelos gratis de OpenRouter permiten 50 pedidos
--  por día en total (también cuentan los que fallan) y ese cupo se comparte
--  con la lectura de comprobantes. Por defecto el asistente usa como mucho
--  30 al día y 10 por cuenta; se cambia sin publicar la web:
--     UPDATE app_settings SET value = '20' WHERE key = 'ia_asistente_por_dia';
--
--  Ejecutar en Supabase > SQL Editor DESPUÉS de 012. Se puede ejecutar
--  más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Modelo de IA del asistente (mismos modelos gratis que los comprobantes).
--    system_prompt vacío = se usan las instrucciones que trae la web.
-- ---------------------------------------------------------------------
INSERT INTO ai_model_configs (feature, primary_model, fallback_models, temperature, max_tokens, system_prompt, prompt_version)
VALUES (
  'chat_assistant',
  'google/gemma-4-31b-it:free',
  '["nvidia/nemotron-3.5-super-vl:free", "openrouter/free"]'::jsonb,
  0.2,
  1500,
  NULL,
  'asistente-v1'
)
ON CONFLICT (feature) DO NOTHING;

-- Límites de uso (texto en app_settings; se pueden cambiar con un UPDATE)
INSERT INTO app_settings (key, value) VALUES
  ('ia_asistente_por_dia', '30'),
  ('ia_asistente_por_cuenta', '10')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_ai_requests_funcion_fecha ON ai_requests (feature, created_at);

-- ---------------------------------------------------------------------
-- 2. ¿Puede esta persona usar la IA ahora?
--    Sin sesión o con la cuenta suspendida: no (el asistente responde con
--    reglas). El día se cuenta en hora UTC, igual que OpenRouter.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_cupo_asistente();
CREATE OR REPLACE FUNCTION fn_cupo_asistente()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario     uuid := fn_usuario_actual();
  v_desde       timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_lim_dia     integer;
  v_lim_cuenta  integer;
  v_usados_dia  integer;
  v_usados_yo   integer := 0;
BEGIN
  SELECT coalesce((SELECT NULLIF(value, '')::integer FROM app_settings WHERE key = 'ia_asistente_por_dia'), 30),
         coalesce((SELECT NULLIF(value, '')::integer FROM app_settings WHERE key = 'ia_asistente_por_cuenta'), 10)
  INTO v_lim_dia, v_lim_cuenta;

  SELECT count(*) INTO v_usados_dia
  FROM ai_requests WHERE feature = 'chat_assistant' AND created_at >= v_desde;

  IF v_usuario IS NOT NULL THEN
    SELECT count(*) INTO v_usados_yo
    FROM ai_requests WHERE feature = 'chat_assistant' AND created_at >= v_desde AND user_id = v_usuario;
  END IF;

  RETURN jsonb_build_object(
    'permitido', v_usuario IS NOT NULL AND v_usados_dia < v_lim_dia AND v_usados_yo < v_lim_cuenta,
    'motivo', CASE
                WHEN v_usuario IS NULL THEN 'SIN_SESION'
                WHEN v_usados_yo >= v_lim_cuenta THEN 'CUPO_CUENTA'
                WHEN v_usados_dia >= v_lim_dia THEN 'CUPO_DIA'
              END,
    'usados_cuenta', v_usados_yo,
    'limite_cuenta', v_lim_cuenta,
    'usados_dia', v_usados_dia,
    'limite_dia', v_lim_dia);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_cupo_asistente() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_cupo_asistente() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Registro de cada llamada del asistente a la IA (modelo, tokens,
--    costo, tiempo y estado). No se guarda lo que escribió la persona.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_registrar_ia_asistente(jsonb);
CREATE OR REPLACE FUNCTION fn_registrar_ia_asistente(p_ia jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario uuid := fn_usuario_actual();
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'SIN_SESION' USING ERRCODE = 'P0001';
  END IF;
  IF p_ia IS NULL OR jsonb_typeof(p_ia) <> 'object' THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO ai_requests (feature, user_id, model_requested, model_used, openrouter_generation_id,
                           prompt_tokens, completion_tokens, cost_usd, latency_ms, status, error_message)
  VALUES ('chat_assistant', v_usuario,
          left(p_ia->>'modelo_pedido', 100), left(p_ia->>'modelo_usado', 100), left(p_ia->>'generacion', 80),
          (CASE WHEN p_ia->>'tokens_entrada' ~ '^\d{1,9}$' THEN (p_ia->>'tokens_entrada')::integer END),
          (CASE WHEN p_ia->>'tokens_salida'  ~ '^\d{1,9}$' THEN (p_ia->>'tokens_salida')::integer END),
          (CASE WHEN p_ia->>'costo_usd' ~ '^\d{1,4}(\.\d+)?$' THEN round((p_ia->>'costo_usd')::numeric, 6) END),
          (CASE WHEN p_ia->>'latencia_ms' ~ '^\d{1,7}$' THEN (p_ia->>'latencia_ms')::integer END),
          CASE WHEN p_ia->>'estado' IN ('success', 'error', 'timeout', 'fallback_used')
               THEN (p_ia->>'estado')::ai_request_status ELSE 'error' END,
          left(p_ia->>'error', 500));
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_registrar_ia_asistente(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_registrar_ia_asistente(jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Uso de la IA de hoy para el panel del administrador
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_uso_ia_hoy();
CREATE OR REPLACE FUNCTION fn_uso_ia_hoy()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_desde timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF NOT fn_es_admin() THEN
    RAISE EXCEPTION 'SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object(
    'asistente', (SELECT count(*) FROM ai_requests WHERE feature = 'chat_assistant' AND created_at >= v_desde),
    'asistente_fallidos', (SELECT count(*) FROM ai_requests
                           WHERE feature = 'chat_assistant' AND created_at >= v_desde AND status IN ('error', 'timeout')),
    'comprobantes', (SELECT count(*) FROM ai_requests WHERE feature = 'receipt_ocr' AND created_at >= v_desde),
    'limite_asistente', coalesce((SELECT NULLIF(value, '')::integer FROM app_settings WHERE key = 'ia_asistente_por_dia'), 30),
    'limite_openrouter', 50);
END;
$$;
REVOKE EXECUTE ON FUNCTION fn_uso_ia_hoy() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION fn_uso_ia_hoy() TO authenticated;

NOTIFY pgrst, 'reload schema';
