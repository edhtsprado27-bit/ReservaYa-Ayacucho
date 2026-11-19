# Actores

| Actor | ¿Qué necesita realizar? |
|---|---|
| **Jugador** | Buscar canchas por distrito o nombre, consultar la disponibilidad en tiempo real, reservar un horario, subir el comprobante de pago y consultar o cancelar sus reservas. |
| **Dueño de cancha** | Registrar sus locales (con dirección y ubicación en el mapa) y canchas, definir horarios, tarifas (hora pico y normal) y servicios (iluminación, vestuarios), y validar las reservas y los pagos por Yape/Plin. |
| **Administrador** | Aprobar canchas nuevas, gestionar usuarios y monitorear las estadísticas de la plataforma. |
| **Yape / Plin** | Recibir el pago del jugador al dueño de la cancha. |
| **OpenRouter** | Proveer los modelos de IA para recomendaciones, chat de soporte y lectura de comprobantes. |
| **Supabase Auth (correo)** | Enviar los correos de la cuenta (registro y cambio de contraseña). Los avisos de reservas por correo quedan para una siguiente iteración. |
| **OpenStreetMap** | Proveer el mapa (teselas) donde se muestran los locales. |
| **Google Maps / Waze** | Abrir la ruta hasta el local en el celular del jugador, mediante un enlace. |
| **Waze** | Abrir la ruta hasta el local desde el celular del jugador. |
