# Requisitos funcionales

## Requisitos funcionales

| ID | Requisito funcional |
|---|---|
| RF01 | El sistema debe permitir buscar canchas por distrito, nombre y servicios. |
| RF02 | El sistema debe mostrar la disponibilidad de horarios de cada cancha en tiempo real. |
| RF03 | El sistema debe permitir registrar y actualizar locales, canchas, horarios, tarifas y servicios. |
| RF04 | El sistema debe permitir reservar un horario disponible e impedir que dos jugadores reserven el mismo horario. |
| RF05 | El sistema debe permitir subir la imagen del comprobante de pago de una reserva. |
| RF06 | El sistema debe leer el comprobante con IA y permitir que el dueño confirme o rechace el pago. |
| RF07 | El sistema debe permitir consultar y cancelar las reservas realizadas y ver su estado. |
| RF08 | El sistema debe permitir al administrador aprobar o rechazar canchas y gestionar usuarios. |
| RF09 | El sistema debe ofrecer un asistente con IA para recomendaciones y soporte. |
| RF10 | El sistema debe notificar por correo la confirmación, el rechazo o la cancelación de una reserva, y enviar un recordatorio antes del partido. |
| RF11 | El sistema debe mostrar los locales en un mapa y permitir buscar las canchas más cercanas a la ubicación del jugador. |
| RF12 | El sistema debe permitir abrir la ruta hasta el local en Google Maps o Waze. |
| RF13 | El sistema debe guardar las coordenadas del local a partir del punto que el dueño marca en el mapa. |
| RF14 | El sistema debe liberar automáticamente el horario de las reservas sin comprobante cuando vence el apartado (15 minutos por defecto, configurable por local). |

---

## Relación entre historias de usuario y requisitos funcionales

| Historia de usuario | Requisitos funcionales relacionados |
|---|---|
| HU01 Buscar canchas | RF01, RF02, RF11 |
| HU02 Gestionar canchas | RF03, RF13 |
| HU03 Reservar horario | RF02, RF04, RF14 |
| HU04 Subir comprobante | RF05, RF06 |
| HU05 Validar pagos | RF06, RF10 |
| HU06 Consultar y cancelar reservas | RF07, RF10 |
| HU07 Aprobar canchas | RF08 |
| HU08 Asistente inteligente | RF09 |
| HU09 Ver mapa y ruta | RF11, RF12 |
| HU10 Confirmación y recordatorio | RF10 |
