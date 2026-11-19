-- =====================================================================
--  ReservaYa Ayacucho · Análisis del comportamiento de la base de datos
--  (Sprint 2, actividad 5). Solo LEE: no cambia ningún dato.
--
--  Cómo usarlo: Supabase > SQL Editor > New query. Ejecuta UNA sección a
--  la vez (selecciona el bloque y pulsa Run) y guarda una captura del
--  resultado de cada una en img/evidencias/.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Las reglas que protegen la reserva (ADR-011)
--    Debe aparecer bookings_no_overlap con EXCLUDE USING gist.
-- ---------------------------------------------------------------------
SELECT conname AS restriccion,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
ORDER BY contype, conname;


-- ---------------------------------------------------------------------
-- 2. Índices de las tablas que más se consultan
-- ---------------------------------------------------------------------
SELECT tablename AS tabla, indexname AS indice, indexdef AS definicion
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'courts', 'venues', 'pricing_rules', 'court_operating_hours', 'payments')
ORDER BY tablename, indexname;


-- ---------------------------------------------------------------------
-- 3. Tamaño de las tablas (filas y espacio en disco)
-- ---------------------------------------------------------------------
SELECT relname AS tabla,
       n_live_tup AS filas,
       pg_size_pretty(pg_total_relation_size(relid)) AS tamano_total,
       seq_scan AS lecturas_completas,
       idx_scan AS lecturas_por_indice
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 15;


-- ---------------------------------------------------------------------
-- 4. Tiempo real de las consultas más usadas (EXPLAIN ANALYZE)
--    Mira la última línea de cada resultado: "Execution Time: ... ms".
-- ---------------------------------------------------------------------

-- 4a. Catálogo del mapa (GET /api/canchas)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM fn_catalogo_canchas();

-- 4b. Grilla de un día (GET /api/disponibilidad), con el primer local publicado y la fecha de dentro de 7 días
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM fn_disponibilidad_local(
  (SELECT id FROM venues WHERE status = 'approved' ORDER BY name LIMIT 1),
  (now() AT TIME ZONE 'America/Lima')::date + 7);

-- 4c. La pregunta que se hace por cada turno de la grilla y al reservar:
--     "¿hay una reserva activa que se cruce con este horario?"
EXPLAIN (ANALYZE, BUFFERS)
SELECT 1
FROM bookings b
WHERE b.court_id = (SELECT id FROM courts WHERE status = 'active' ORDER BY name LIMIT 1)
  AND b.status NOT IN ('cancelled', 'expired')
  AND b.period && tstzrange(now() + interval '7 days', now() + interval '7 days 1 hour', '[)');

-- 4d. Límite de 2 reservas por pagar por persona (se revisa en cada reserva)
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM bookings b
WHERE b.player_id = (SELECT id FROM users ORDER BY id LIMIT 1)
  AND b.status = 'pending_payment'
  AND b.hold_expires_at > now();


-- ---------------------------------------------------------------------
-- 5. Con pocas filas PostgreSQL prefiere leer la tabla completa (es más
--    rápido). Este bloque obliga a usar índices SOLO dentro de la
--    transacción, para mostrar que la consulta 4c sí puede usar el índice
--    GiST del EXCLUDE cuando la tabla crezca. ROLLBACK: no cambia nada.
-- ---------------------------------------------------------------------
BEGIN;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off; -- sin esto, el costo artificial activa la compilación JIT y el tiempo engaña
EXPLAIN (ANALYZE, BUFFERS)
SELECT 1
FROM bookings b
WHERE b.court_id = (SELECT id FROM courts WHERE status = 'active' ORDER BY name LIMIT 1)
  AND b.status NOT IN ('cancelled', 'expired')
  AND b.period && tstzrange(now() + interval '7 days', now() + interval '7 days 1 hour', '[)');
ROLLBACK;


-- ---------------------------------------------------------------------
-- 6. EQ-02: comprobar que NO existen dos reservas activas cruzadas.
--    Resultado esperado: 0 filas.
-- ---------------------------------------------------------------------
SELECT a.code AS reserva_1, b.code AS reserva_2, a.court_id, a.period, b.period
FROM bookings a
JOIN bookings b
  ON a.court_id = b.court_id
 AND a.id < b.id
 AND a.period && b.period
WHERE a.status NOT IN ('cancelled', 'expired')
  AND b.status NOT IN ('cancelled', 'expired');

-- 6b. Reservas que dejó la prueba de concurrencia de k6 (deben estar canceladas)
SELECT b.code, b.status, b.starts_at AT TIME ZONE 'America/Lima' AS inicio_lima, u.email, b.created_at
FROM bookings b
JOIN users u ON u.id = b.player_id
WHERE u.email LIKE 'k6.jugador%'
ORDER BY b.created_at DESC
LIMIT 20;


-- ---------------------------------------------------------------------
-- 7. ¿Cuántas consultas llegaron de verdad a la base durante k6?
--    (pg_stat_statements ya viene activo en Supabase)
--    7a ANTES de la prueba de carga: pone los contadores en cero.
--    7b DESPUÉS de la prueba: compara "llamadas" con los pedidos que hizo k6.
--       La diferencia es lo que absorbieron el CDN y la caché en memoria.
-- ---------------------------------------------------------------------
-- 7a
SELECT pg_stat_statements_reset();

-- 7b
SELECT CASE
         WHEN query ILIKE '%fn_catalogo_canchas%' THEN 'Catálogo (fn_catalogo_canchas)'
         WHEN query ILIKE '%fn_disponibilidad_local%' THEN 'Grilla (fn_disponibilidad_local)'
         WHEN query ILIKE '%fn_reservar%' THEN 'Reservar (fn_reservar)'
         WHEN query ILIKE '%fn_mis_reservas%' THEN 'Mis reservas (fn_mis_reservas)'
       END AS consulta,
       sum(calls) AS llamadas,
       round((sum(total_exec_time) / nullif(sum(calls), 0))::numeric, 2) AS promedio_ms,
       round(max(max_exec_time)::numeric, 2) AS maximo_ms
FROM pg_stat_statements
WHERE query ILIKE ANY (ARRAY['%fn_catalogo_canchas%', '%fn_disponibilidad_local%', '%fn_reservar%', '%fn_mis_reservas%'])
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%EXPLAIN%'
GROUP BY 1
ORDER BY 2 DESC;
