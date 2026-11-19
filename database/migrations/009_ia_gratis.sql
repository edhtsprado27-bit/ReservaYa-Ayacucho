-- =====================================================================
--  ReservaYa Ayacucho - 009_ia_gratis.sql
--  Leer los comprobantes con modelos GRATIS de OpenRouter (sin crédito).
--
--  Por qué: la cuenta de OpenRouter del proyecto no tiene crédito.
--  Modelos elegidos (gratis, aceptan imágenes, revisados el 18/11/2026):
--    1. google/gemma-4-31b-it:free           (principal: su proveedor no entrena con los datos)
--    2. nvidia/nemotron-3.5-super-vl:free   (respaldo: NVIDIA puede usar los datos para entrenar)
--    3. openrouter/free                      (elige otro modelo gratis compatible)
--
--  Límites del plan gratis: 20 pedidos por minuto y 50 por día
--  (1,000 por día si alguna vez se compran 10 o más créditos).
--
--  Privacidad: varios modelos gratis corren en proveedores que pueden
--  usar los datos para entrenar, y con ellos no se puede pedir
--  data_collection = deny. Gemma funciona sin tocar nada; para que
--  también funcionen los respaldos hay que activar en
--  https://openrouter.ai/settings/privacy (Settings → Privacy) la opción
--  de modelos gratis que pueden entrenar ("Free endpoints that may train
--  on request data"; en versiones anteriores "Enable free endpoints that
--  may train on inputs" o "Model Training").
--  Sirve para el curso y para pruebas; con clientes reales conviene
--  volver al modelo de pago (abajo está cómo).
--
--  Ejecutar en Supabase > SQL Editor DESPUÉS de 008.
-- =====================================================================

UPDATE ai_model_configs
SET primary_model   = 'google/gemma-4-31b-it:free',
    fallback_models = '["nvidia/nemotron-3.5-super-vl:free", "openrouter/free"]'::jsonb,
    max_tokens      = 2000,          -- algunos modelos gratis "piensan" antes de responder
    prompt_version  = 'ocr-v1',
    updated_at      = now()
WHERE feature = 'receipt_ocr';

-- Para volver al modelo de pago (cuando la cuenta tenga crédito):
-- UPDATE ai_model_configs
-- SET primary_model = 'google/gemini-3.1-flash-lite',
--     fallback_models = '["google/gemini-2.5-flash-lite"]'::jsonb,
--     max_tokens = 1000, updated_at = now()
-- WHERE feature = 'receipt_ocr';

SELECT feature, primary_model, fallback_models FROM ai_model_configs WHERE feature = 'receipt_ocr';
