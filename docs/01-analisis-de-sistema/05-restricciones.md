# Restricciones

Identificar las **restricciones** que condicionan las decisiones de diseño y arquitectura del sistema.

| ID | Restricción | Descripción |
|---|---|---|
| RC01 | **Aplicación web adaptable** | El sistema debe desarrollarse como una aplicación web accesible desde el navegador del celular y de la computadora. |
| RC02 | **Control de versiones** | El código fuente debe gestionarse utilizando Git y mantenerse en un repositorio compartido. |
| RC03 | **API REST** | La comunicación entre el frontend y los servicios del sistema debe realizarse mediante una API REST. |
| RC04 | **Pagos por Yape/Plin** | Los pagos se realizan por Yape o Plin, que no ofrecen una API pública de cobros; el sistema debe trabajar con capturas de comprobantes. |
| RC05 | **IA mediante OpenRouter** | El asistente inteligente y la lectura de comprobantes deben usar modelos de IA a través de la API de OpenRouter. |
| RC06 | **Servicios en la nube con plan gratuito o de bajo costo** | El despliegue debe usar Vercel, Render, Supabase, Upstash y Cloudflare por el presupuesto del proyecto. |
| RC07 | **Mapas con Google Maps** | El mapa y la conversión de direcciones deben usar Google Maps Platform, que requiere una clave de API y una cuenta de facturación; la clave debe restringirse al dominio del sistema. |
| RC08 | **Waze solo mediante enlaces** | Waze no ofrece una API para mostrar su mapa dentro de otra web; solo se puede abrir la ruta con un enlace. |
