# Nivel 2 · Diagrama de contenedores

> **Proyecto:** ReservaYa Ayacucho  
> **Modelo:** C4 · Nivel 2 de 4 · **Versión:** 1.0

---

## 1. Objetivo

Abrir la caja «ReservaYa Ayacucho» del nivel 1 y mostrar los **contenedores** que la forman: las aplicaciones y almacenes de datos que se ejecutan por separado, la tecnología de cada uno y cómo se comunican.

| Aspecto | Descripción |
|---|---|
| Pregunta que responde | ¿De qué piezas ejecutables se compone el sistema y con qué tecnología? |
| Audiencia | Arquitectos, desarrolladores, operaciones |
| Qué es un contenedor | Algo que se ejecuta o almacena datos de forma independiente: una aplicación web, una API, una base de datos (no es lo mismo que un contenedor Docker) |
| Nivel anterior | `Nivel1-DiagramadeContextodelSistema.md` |
| Siguiente nivel | `Nivel3-Diagrama-de-Componentes.md` |

---

## 2. Diagrama

![Diagrama de contenedores de ReservaYa Ayacucho](/img/nivel2-contenedores.png)

> Archivo editable: `img/fuentes-svg/nivel2-contenedores.mmd`

---

## 3. Contenedores

| Contenedor | Tecnología | Responsabilidad | Datos que maneja |
|---|---|---|---|
| **Aplicación web** | Next.js (React) · desplegada en Vercel | Interfaz para jugadores (buscar, reservar, subir comprobante), panel del dueño de cancha y panel de administración | Ninguno persistente; solo el estado de la pantalla |
| **API ReservaYa** | Node.js + NestJS · desplegada en Render | Expone la API REST, aplica las reglas de negocio, integra los sistemas externos y ejecuta las tareas programadas (expirar reservas sin pago, recordatorios). Es un **monolito modular**: un solo proceso con módulos internos | Ninguno propio; usa la base de datos, la caché y el almacenamiento |
| **Base de datos** | PostgreSQL + PostGIS (Supabase) | Almacena de forma permanente la información del negocio y calcula la cercanía de los locales | Usuarios, locales con su ubicación, canchas, horarios, tarifas, reservas, pagos y uso de IA |
| **Caché y bloqueos** | Redis (Upstash) | Bloquea temporalmente un horario mientras el jugador reserva y guarda en memoria la disponibilidad más consultada | Bloqueos temporales y copia de la disponibilidad |
| **Almacenamiento de archivos** | Supabase Storage | Guarda las imágenes de los comprobantes de Yape/Plin y las fotos de las canchas | Imágenes |

---

## 4. Relaciones

| Origen | Destino | Descripción | Protocolo |
|---|---|---|---|
| Jugador, Dueño de cancha, Administrador | Aplicación web | Usan la aplicación desde el navegador o el celular | HTTPS |
| Aplicación web | API ReservaYa | Llama a la API | HTTPS/JSON |
| Aplicación web | Google Maps | Carga el mapa con los locales (Maps JavaScript API) | HTTPS |
| Aplicación web | Waze / Google Maps | Abre la ruta con un enlace «Cómo llegar» | HTTPS (enlace) |
| API ReservaYa | Base de datos | Lee y escribe información | SQL sobre TCP |
| API ReservaYa | Caché y bloqueos | Bloquea horarios y lee la disponibilidad en memoria | TCP |
| API ReservaYa | Almacenamiento de archivos | Sube y consulta comprobantes y fotos | HTTPS/REST |
| API ReservaYa | OpenRouter | Solicita recomendaciones, chat y lectura de comprobantes | HTTPS/REST |
| API ReservaYa | Servicio de correo | Envía notificaciones | HTTPS/REST |
| API ReservaYa | Google Maps | Convierte la dirección del local en coordenadas (Geocoding API) | HTTPS/REST |

---

## 5. Decisiones arquitectónicas reflejadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Un único contenedor de backend (monolito modular) | Microservicios | Equipo pequeño y plazo acotado; los módulos permiten separar servicios en el futuro si es necesario |
| Frontend separado del backend (Next.js + API REST) | Todo dentro de Next.js | El frontend y el backend evolucionan y se despliegan de forma independiente |
| PostgreSQL como base de datos | Base de datos NoSQL | Las reservas y pagos necesitan transacciones; además PostgreSQL impide que dos reservas se crucen en la misma cancha (restricción de exclusión) |
| Redis para bloquear horarios | Solo controlar en la base de datos | Si dos jugadores eligen el mismo horario al mismo tiempo, solo el primero obtiene el bloqueo; el otro recibe aviso inmediato |
| Comprobantes en almacenamiento de archivos | Guardar las imágenes en la base de datos | Las imágenes pesan; la base de datos guarda solo la ruta |
| Solo la API se comunica con los sistemas externos (excepto el mapa) | Llamar a OpenRouter desde el navegador | La clave de OpenRouter queda en el servidor y no se expone al jugador. El mapa sí se carga en el navegador porque así funciona Google Maps; se usa una clave distinta, restringida al dominio del sistema |
| PostGIS para buscar canchas cercanas | Preguntar a Google la distancia de cada local | La distancia se calcula en la base de datos sin costo y con un índice espacial |
| Tareas programadas dentro de la API | Un servicio aparte para tareas | Son pocas y livianas; mantenerlas en el monolito simplifica el despliegue |

---

## 6. Seguridad entre contenedores

| Comunicación | Medida |
|---|---|
| Navegador → Aplicación web y API | Tráfico cifrado con HTTPS (dominio propio con Cloudflare) |
| Aplicación web → API | Autenticación con token JWT en cada petición y permisos por rol (jugador, dueño, administrador) |
| API → Base de datos, caché y almacenamiento | Acceso solo con credenciales guardadas en variables de entorno |
| API → Sistemas externos | Clave de OpenRouter, del servicio de correo y de geocodificación guardadas solo en el servidor |
| Aplicación web → Google Maps | Clave pública del mapa restringida por dominio (HTTP referrer) y solo a Maps JavaScript API |

---
