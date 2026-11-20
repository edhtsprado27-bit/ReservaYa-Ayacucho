-- Datos de las pruebas E2E (las cuentas ya existen: las crea preparar-base.mjs).
--   Complejo Los Andes    publicado · dueño Rosa (dueno@e2e.pe) · Yape configurado
--                         Cancha 1 fútbol S/ 60 y S/ 80 desde 18:00 · Cancha 2 vóley S/ 40
--   La Canchita del Barrio publicado · sin dueño (de la plataforma) · para "Asignar dueño"
--   Grass Pendiente       en revisión · dueño Rosa · para "Aprobar"
-- Todas atienden de 06:00 a 23:00 todos los días.

INSERT INTO venues (id, owner_id, district_id, name, slug, address, address_reference, lat, lng, status,
                    whatsapp_phone, yape_phone, payment_holder_name, deposit_percent, hold_minutes, cancellation_hours)
SELECT 'e2e00000-0000-4000-8000-000000000001', u.id, d.id, 'Complejo Los Andes', 'complejo-los-andes',
       'Jr. Grau 245', 'A media cuadra del mercado', -13.158000, -74.224000, 'approved',
       '+51966123456', '966123456', 'Rosa Quispe Huamán', 50, 15, 6
FROM users u, districts d WHERE u.email = 'dueno@e2e.pe' AND d.name = 'Ayacucho';

INSERT INTO venues (id, owner_id, district_id, name, slug, address, lat, lng, status)
SELECT 'e2e00000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-00000000a001', d.id,
       'La Canchita del Barrio', 'la-canchita-del-barrio', 'Av. Cusco 980', -13.171000, -74.214000, 'approved'
FROM districts d WHERE d.name = 'San Juan Bautista';

INSERT INTO venues (id, owner_id, district_id, name, slug, address, lat, lng, status)
SELECT 'e2e00000-0000-4000-8000-000000000003', u.id, d.id, 'Grass Pendiente', 'grass-pendiente',
       'Jr. Libertad 410', -13.164000, -74.232000, 'pending_review'
FROM users u, districts d WHERE u.email = 'dueno@e2e.pe' AND d.name = 'Carmen Alto';

INSERT INTO courts (id, venue_id, name, sport, surface, sort_order) VALUES
  ('e2e00000-0000-4000-8000-0000000000c1', 'e2e00000-0000-4000-8000-000000000001', 'Cancha 1', 'futbol', 'grass_sintetico', 1),
  ('e2e00000-0000-4000-8000-0000000000c2', 'e2e00000-0000-4000-8000-000000000001', 'Cancha 2', 'voley', 'losa', 2),
  ('e2e00000-0000-4000-8000-0000000000c3', 'e2e00000-0000-4000-8000-000000000002', 'Cancha única', 'futsal', 'losa', 1),
  ('e2e00000-0000-4000-8000-0000000000c4', 'e2e00000-0000-4000-8000-000000000003', 'Cancha de fútbol', 'futbol', 'grass_sintetico', 1);

INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time)
SELECT c.id, g, time '06:00', time '23:00'
FROM courts c CROSS JOIN generate_series(0, 6) g
WHERE c.id::text LIKE 'e2e00000-%';

INSERT INTO pricing_rules (court_id, name, is_peak, start_time, end_time, price_per_hour, priority) VALUES
  ('e2e00000-0000-4000-8000-0000000000c1', 'Normal', false, time '00:00', time '24:00', 60, 0),
  ('e2e00000-0000-4000-8000-0000000000c1', 'Hora punta', true, time '18:00', time '24:00', 80, 10),
  ('e2e00000-0000-4000-8000-0000000000c2', 'Normal', false, time '00:00', time '24:00', 40, 0),
  ('e2e00000-0000-4000-8000-0000000000c3', 'Normal', false, time '00:00', time '24:00', 45, 0),
  ('e2e00000-0000-4000-8000-0000000000c4', 'Normal', false, time '00:00', time '24:00', 50, 0);
