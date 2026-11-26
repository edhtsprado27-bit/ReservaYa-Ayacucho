# Drivers arquitectónicos

Los **drivers arquitectónicos** identificados para el sistema son los siguientes:

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe impedir reservas dobles cuando varios jugadores eligen el mismo horario al mismo tiempo. | AC02 – Consistencia | Influye en el control de concurrencia: bloqueos temporales y restricciones en la base de datos. |
| DA02 | El sistema debe mostrar la disponibilidad con tiempos de respuesta adecuados en horas de alta demanda. | AC01 – Rendimiento | Influye en el uso de caché y en la forma de consultar los horarios. |
| DA03 | El sistema debe proteger los datos de los usuarios, reservas y comprobantes. | AC04 – Seguridad | Influye en la autenticación, los permisos por rol y el almacenamiento de imágenes. |
| DA04 | El sistema debe validar pagos sin una API de cobros, a partir de capturas de Yape/Plin. | RC04 – Pagos por Yape/Plin | Condiciona el flujo de pago: comprobante, lectura con IA y confirmación del dueño. |
| DA05 | El sistema debe integrarse con OpenRouter para las funciones de IA. | RC05 – IA mediante OpenRouter, RC10 – Cupo diario de la IA gratuita | Condiciona la integración con un servicio externo que puede cambiar de modelo, fallar o quedarse sin cupo: la IA va detrás de puertos, el modelo se configura en la base y el asistente responde primero con reglas (ADR-006, ADR-015). |
| DA06 | El sistema debe permitir modificar funcionalidades sin afectar innecesariamente otros módulos. | AC05 – Mantenibilidad | Influye en la separación de responsabilidades, modularidad y dependencias internas. |
| DA07 | El sistema debe mostrar mapas y calcular cercanía sin costo. | RC07 – Mapas sin costo | Influye en la elección de OpenStreetMap + Leaflet, en guardar las coordenadas de cada local en la base de datos y en calcular la distancia en el navegador. |
| DA08 | El sistema debe funcionar con servicios gratuitos y un equipo de una persona. | RC06 – Servicios en la nube con plan gratuito, RC08 y RC09 – Enlaces en lugar de APIs de pago | Influye en desplegar una sola aplicación (web + API), en usar servicios administrados (Supabase) en lugar de servidores propios y en integrar Google Maps, Waze y WhatsApp solo con enlaces (ADR-012, ADR-014). |
