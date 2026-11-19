# Nivel 2 · Diagrama de contenedores

> **Proyecto:** ReservaYa Ayacucho  
> **Modelo:** C4 · Nivel 2 de 4 · **Versión:** 2.0 (Sprint 2: alineado con el sistema implementado)

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
| **Aplicación web** | Next.js 16 (React) · se ejecuta en el navegador | Interfaz para jugadores (mapa, grilla de horarios, subir comprobante), panel del dueño y panel del administrador | Ninguno persistente; solo el estado de la pantalla |
| **Servidor de la aplicación (web + API REST)** | Next.js 16 en Vercel (funciones en São Paulo) | Renderiza las páginas, expone la API REST (`/api/...`) y ejecuta los módulos del **monolito modular** (catálogo, reservas, pagos, cuentas) | Ninguno propio; caché en memoria del catálogo (30 s) |
| **Base de datos** | PostgreSQL en Supabase | Guarda la información y aplica las reglas críticas en funciones `SECURITY DEFINER` (reservar, registrar pago), con RLS y la restricción `EXCLUDE` anti doble reserva | Usuarios, distritos, locales, canchas, tarifas, horarios, reservas, pagos y uso de IA |
| **Autenticación** | Supabase Auth | Registro, inicio de sesión y sesión en cookies; la base sabe quién llama con `auth.uid()` | Cuentas y sesiones |
| **Almacenamiento de archivos** | Supabase Storage (bucket privado `comprobantes`) | Guarda las capturas de Yape/Plin; solo las ven el jugador, el dueño y el admin (enlaces firmados de 15 min) | Imágenes |
| **CDN** | Red de Vercel (dominio propio con Cloudflare en el Sprint 2) | Guarda copias de las respuestas públicas (catálogo 60 s, grilla 5 s) y los archivos estáticos | Copias temporales |
| **Caché compartida** *(Sprint 2)* | Redis en Upstash | Compartir la caché del catálogo y la disponibilidad entre instancias del servidor | Copias temporales |

---

## 4. Relaciones

| Origen | Destino | Descripción | Protocolo |
|---|---|---|---|
| Jugador, Dueño de cancha, Administrador | Aplicación web | Usan la aplicación desde el navegador o el celular | HTTPS |
| Aplicación web | Servidor de la aplicación | Pide páginas y llama a la API REST | HTTPS/JSON |
| Aplicación web | Supabase Auth | Inicia sesión y cierra sesión (cliente del navegador) | HTTPS |
| Aplicación web | OpenStreetMap | Descarga las teselas del mapa (Leaflet) | HTTPS |
| Servidor de la aplicación | Base de datos | Llama a funciones `fn_*` con la sesión de quien pide | HTTPS (PostgREST) |
| Servidor de la aplicación | Almacenamiento | Sube capturas y crea enlaces firmados | HTTPS/REST |
| Servidor de la aplicación | OpenRouter | Pide la lectura del comprobante a un modelo con visión | HTTPS/REST |

---

## 5. Decisiones arquitectónicas reflejadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Web y API en una sola aplicación Next.js (ADR-009) | API NestJS separada en Render | Un solo despliegue gratuito; el plan gratis de Render apaga el servidor. La API REST es la misma (`/api/...`) |
| Monolito modular con Clean Architecture (ADR-001, ADR-002) | Microservicios | Equipo de una persona y plazo acotado; los módulos permiten separar servicios en el futuro |
| Supabase como backend administrado (ADR-010) | Servidor de base de datos propio | Base, autenticación y archivos en un solo servicio gratuito, con RLS |
| Anti doble reserva en PostgreSQL (ADR-011) | Bloqueo en Redis | La restricción de la base es la garantía más fuerte y no depende de otro servicio |
| Comprobantes en almacenamiento privado | Guardar las imágenes en la base de datos | Las imágenes pesan; la base guarda solo la ruta y su huella SHA-256 |
| Solo el servidor habla con OpenRouter | Llamar a la IA desde el navegador | La clave `OPENROUTER_API_KEY` nunca llega al navegador |

---

## 6. Seguridad entre contenedores

| Comunicación | Medida |
|---|---|
| Navegador → Servidor | HTTPS; las páginas privadas exigen sesión (`proxy.ts`) |
| Servidor → Base de datos | Se usa la sesión de quien pide: la base valida el rol con `auth.uid()`; las tablas sensibles (`bookings`, `payments`) no se exponen y todo pasa por funciones `SECURITY DEFINER` |
| Servidor → Almacenamiento | Bucket privado con RLS; las imágenes se ven solo con enlaces firmados de 15 minutos |
| Servidor → OpenRouter | Clave solo en las variables de entorno del servidor (Vercel, tipo Secret) |
