# Actores

| Actor | ¿Qué necesita realizar? |
|---|---|
| **Jugador** | Buscar canchas por distrito, nombre o servicios, consultar la disponibilidad en tiempo real, reservar un horario, subir el comprobante de pago, consultar o cancelar sus reservas, preguntar al asistente de canchas y escribir por WhatsApp al local o a la ayuda de la plataforma. |
| **Dueño de cancha** | Registrar sus locales (con dirección y ubicación en el mapa) y canchas, definir horarios, tarifas (hora pico y normal) y servicios (vestuarios, duchas, iluminación, estacionamiento…), llevar su agenda, validar las reservas y los pagos por Yape/Plin y escribir por WhatsApp al jugador cuando hace falta. |
| **Administrador** | Aprobar canchas nuevas, administrar los locales publicados (asignar el dueño real, suspender), gestionar usuarios (cambiar entre jugador y dueño, suspender con motivo y reactivar), configurar el WhatsApp de ayuda y monitorear las estadísticas de la plataforma (incluido el uso diario de la IA). |
| **Yape / Plin** | Recibir el pago del jugador al dueño de la cancha. |
| **OpenRouter** | Proveer los modelos de IA para el asistente de canchas (interpreta lo que escribe el jugador cuando las reglas no bastan) y para la lectura de comprobantes. En el plan gratis ambas funciones comparten 50 pedidos por día (ADR-015). |
| **Supabase Auth (correo)** | Enviar los correos de la cuenta (registro y cambio de contraseña). Los avisos de reservas por correo quedan para una siguiente iteración. |
| **WhatsApp** | Abrir el chat con el mensaje ya escrito cuando alguien pulsa un enlace `wa.me` (al local, a la ayuda, al jugador o al dueño). La persona envía el mensaje desde su propio WhatsApp: no hay integración por API ni costo (ADR-014). |
| **OpenStreetMap** | Proveer el mapa (teselas) donde se muestran los locales. |
| **Google Maps / Waze** | Abrir la ruta hasta el local en el celular del jugador, mediante un enlace. |
