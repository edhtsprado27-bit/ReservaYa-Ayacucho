# Restricciones

Identificar las **restricciones** que condicionan las decisiones de diseño y arquitectura del sistema.

| ID | Restricción | Descripción |
|---|---|---|
| RC01 | **Aplicación web adaptable** | El sistema debe desarrollarse como una aplicación web accesible desde el navegador del celular y de la computadora. |
| RC02 | **Control de versiones** | El código fuente debe gestionarse utilizando Git y mantenerse en un repositorio compartido. |
| RC03 | **API REST** | La comunicación entre el frontend y los servicios del sistema debe realizarse mediante una API REST, documentada con OpenAPI/Swagger. |
| RC04 | **Pagos por Yape/Plin** | Los pagos se realizan por Yape o Plin, que no ofrecen una API pública de cobros; el sistema debe trabajar con capturas de comprobantes. |
| RC05 | **IA mediante OpenRouter** | El asistente inteligente y la lectura de comprobantes deben usar modelos de IA a través de la API de OpenRouter. |
| RC06 | **Servicios en la nube con plan gratuito** | El proyecto no tiene presupuesto: se usan los planes gratuitos de Vercel (web y API), Supabase (PostgreSQL, Auth y Storage), OpenRouter (modelos de IA gratuitos), Upstash (Redis) y Cloudflare (dominio y CDN). Ningún servicio debe exigir tarjeta de crédito. |
| RC07 | **Mapas sin costo** | El mapa debe funcionar sin clave de pago. Google Maps Platform exige una cuenta de facturación con tarjeta, por eso el mapa usa OpenStreetMap con Leaflet y la ubicación del local se marca en el mapa (sin geocodificación de pago). |
| RC08 | **Google Maps y Waze solo mediante enlaces** | Para «Cómo llegar» se abre la app del celular con un enlace (Google Maps o Waze); no se usa ninguna API ni genera costo. |
| RC09 | **WhatsApp solo mediante enlaces** | La API oficial de WhatsApp (WhatsApp Business Cloud API) exige verificar una empresa, un número dedicado y plantillas aprobadas, y cobra por mensajes. El contacto se hace con enlaces `wa.me` que abren el chat con el mensaje ya escrito; los avisos automáticos irán por correo (RF10). |
| RC10 | **Cupo diario de la IA gratuita** | Sin comprar créditos, los modelos gratis de OpenRouter permiten 50 pedidos por día y 20 por minuto, y los pedidos fallidos también cuentan. El asistente debe responder sin IA todo lo que pueda y limitar su uso (30 consultas por día y 10 por cuenta, configurables), para que siempre quede cupo para leer comprobantes (ADR-015). |
