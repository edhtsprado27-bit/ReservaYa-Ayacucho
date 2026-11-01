# Nivel 3 · Diagrama de componentes

> **Proyecto:** ReservaYa Ayacucho · **Contenedor detallado:** API ReservaYa  
> **Modelo:** C4 · Nivel 3 de 4 · **Versión:** 1.0

---

## 1. Objetivo

Abrir el contenedor **API ReservaYa** del nivel 2 y mostrar sus **componentes**: los módulos del monolito modular, la responsabilidad de cada uno y cómo se relacionan entre sí y con la base de datos, la caché, el almacenamiento y los sistemas externos.

| Aspecto | Descripción |
|---|---|
| Pregunta que responde | ¿Cómo se divide el backend por dentro y qué hace cada parte? |
| Audiencia | Arquitectos y desarrolladores |
| Qué es un componente | Un grupo de funcionalidades con una responsabilidad clara, accesible mediante una interfaz. En este proyecto, cada **módulo** de NestJS es un componente |
| Nivel anterior | `Nivel2-DiagramadeContenedores.md` |
| Siguiente nivel | `Nivel4-DiagramadeCodigo.md` |

---

## 2. Diagrama

![Diagrama de componentes de la API ReservaYa](/img/nivel3-componentes.png)

> Archivo editable: `img/fuentes-svg/nivel3-componentes.mmd`

---

## 3. Componentes

| Componente | Responsabilidad | Funcionalidades principales | Carpeta en el código |
|---|---|---|---|
| **API REST** | Punto de entrada HTTP del contenedor | Rutas `/api/v1`, autenticación JWT, permisos por rol, validación de la entrada, manejo de errores | `src/api/` |
| **Usuarios** | Identidad y acceso | Registro, inicio de sesión, roles (jugador, dueño de cancha, administrador) | `src/modules/usuarios/` |
| **Canchas** | Locales y canchas | Locales por distrito con su ubicación, canchas, fotos, servicios (iluminación, vestuarios), búsqueda por distrito, nombre y cercanía, enlaces «Cómo llegar» | `src/modules/canchas/` |
| **Horarios** | Disponibilidad y precios | Horarios de atención, tarifas hora pico y normal, disponibilidad en tiempo real | `src/modules/horarios/` |
| **Reservas** | Proceso de reserva | Crear, cancelar y consultar reservas, estados de la reserva, evitar reservas dobles | `src/modules/reservas/` |
| **Pagos** | Comprobantes Yape/Plin | Subir comprobante, verificación por IA, confirmación manual del dueño | `src/modules/pagos/` |
| **Asistente IA** | Inteligencia artificial | Recomendaciones de canchas, chat de soporte, lectura de comprobantes | `src/modules/asistente-ia/` |
| **Notificaciones** | Comunicación con los usuarios | Avisar confirmaciones, rechazos y recordatorios de reservas | `src/modules/notificaciones/` |
| **Tareas programadas** | Procesos automáticos | Expirar reservas sin comprobante cada minuto, enviar recordatorios 2 horas antes del partido | `src/modules/tareas/` |
| **Administración** | Operación de la plataforma | Aprobar canchas nuevas, gestionar usuarios, estadísticas | `src/modules/administracion/` |

---

## 4. Relaciones entre componentes

| Origen | Destino | Descripción | Tipo de comunicación |
|---|---|---|---|
| Aplicación web | API REST | Llama a la API | HTTPS/JSON |
| API REST | Módulos de negocio | Invoca los casos de uso | Llamada en memoria |
| Canchas | Usuarios | Valida que el usuario sea dueño de cancha | Llamada en memoria (API pública del módulo) |
| Horarios | Canchas | Asocia horarios y tarifas a cada cancha | Llamada en memoria |
| Reservas | Horarios | Consulta disponibilidad y calcula el precio | Llamada en memoria |
| Pagos | Reservas | Actualiza el estado de la reserva al recibir o validar el comprobante | Llamada en memoria |
| Pagos | Asistente IA | Solicita la lectura del comprobante | Llamada en memoria |
| Reservas | Notificaciones | Publica el cambio de estado | Evento en memoria |
| Administración | Canchas, Usuarios | Aprueba canchas y gestiona usuarios | Llamada en memoria |
| Tareas programadas | Reservas, Notificaciones | Expira reservas y pide enviar recordatorios | Llamada en memoria |

---

## 5. Relaciones con contenedores y sistemas externos

| Componente | Destino | Descripción | Protocolo | Patrón aplicado |
|---|---|---|---|---|
| Todos los módulos | Base de datos (PostgreSQL) | Cada módulo lee y escribe **solo sus propias tablas**; Canchas usa PostGIS para buscar por cercanía | SQL | Repository |
| Reservas | Caché y bloqueos (Redis) | Bloquea el horario mientras el jugador reserva | TCP | Adapter |
| Horarios | Caché y bloqueos (Redis) | Guarda y lee la disponibilidad en memoria | TCP | Decorator |
| Pagos | Almacenamiento de archivos | Sube y consulta comprobantes | HTTPS/REST | Adapter |
| Asistente IA | OpenRouter | Envía consultas a los modelos de IA | HTTPS/REST | Adapter |
| Notificaciones | Servicio de correo | Envía correos | HTTPS/REST | Adapter |
| Canchas | Google Maps | Convierte la dirección del local en coordenadas | HTTPS/REST | Adapter |

---

## 6. Reglas del monolito modular

| # | Regla | Motivo |
|---|---|---|
| 1 | Todos los componentes se despliegan juntos en el contenedor API ReservaYa | Es un monolito: un solo proceso y un solo despliegue |
| 2 | Un módulo usa a otro solo a través de su API pública (`index.ts` y los servicios que exporta su `*.module.ts`) | Evita que un cambio interno en un módulo rompa a los demás |
| 3 | Un módulo no lee ni escribe las tablas de otro módulo | Mantiene la independencia de los datos de cada módulo |
| 4 | Cada sistema externo se integra en un único módulo | La integración queda en un solo lugar y es fácil de reemplazar (por ejemplo, cambiar de modelo en OpenRouter) |
| 5 | Cada módulo se organiza por dentro con Clean Architecture | Las reglas de negocio no dependen de la tecnología (ver nivel 4) |

---
