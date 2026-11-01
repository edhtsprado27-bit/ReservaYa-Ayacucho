# Drivers arquitectónicos

Los **drivers arquitectónicos** identificados para el sistema son los siguientes:

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe impedir reservas dobles cuando varios jugadores eligen el mismo horario al mismo tiempo. | AC02 – Consistencia | Influye en el control de concurrencia: bloqueos temporales y restricciones en la base de datos. |
| DA02 | El sistema debe mostrar la disponibilidad con tiempos de respuesta adecuados en horas de alta demanda. | AC01 – Rendimiento | Influye en el uso de caché y en la forma de consultar los horarios. |
| DA03 | El sistema debe proteger los datos de los usuarios, reservas y comprobantes. | AC04 – Seguridad | Influye en la autenticación, los permisos por rol y el almacenamiento de imágenes. |
| DA04 | El sistema debe validar pagos sin una API de cobros, a partir de capturas de Yape/Plin. | RC04 – Pagos por Yape/Plin | Condiciona el flujo de pago: comprobante, lectura con IA y confirmación del dueño. |
| DA05 | El sistema debe integrarse con OpenRouter para las funciones de IA. | RC05 – IA mediante OpenRouter | Condiciona la integración con un servicio externo que puede cambiar de modelo. |
| DA06 | El sistema debe permitir modificar funcionalidades sin afectar innecesariamente otros módulos. | AC05 – Mantenibilidad | Influye en la separación de responsabilidades, modularidad y dependencias internas. |
| DA07 | El sistema debe mostrar mapas y calcular cercanía sin elevar el costo de Google Maps. | RC07 – Mapas con Google Maps | Influye en dónde se guardan las coordenadas (en la base de datos, no consultadas a Google cada vez) y en la restricción de la clave. |
