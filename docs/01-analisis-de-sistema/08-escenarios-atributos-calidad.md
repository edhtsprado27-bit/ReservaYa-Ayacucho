# Escenarios de atributos de calidad de ReservaYa Ayacucho

## EQ-01. Rendimiento: consulta de disponibilidad

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Rendimiento |
| **Fuente** | Jugador |
| **Estímulo** | El jugador busca canchas en un distrito o consulta los horarios disponibles de una cancha. |
| **Condición** | El sistema funciona normalmente en hora de alta demanda (viernes por la noche) con datos representativos. |
| **Respuesta esperada** | El sistema muestra las canchas y los horarios libres sin errores inesperados. |
| **Medida** | **Propuesta por validar:** el 95 % de las consultas responde en 1,5 segundos o menos, con menos del 1 % de errores técnicos, durante una prueba con 100 usuarios simultáneos. |
| **Verificación** | Ejecutar pruebas de rendimiento (k6 o Artillery) y registrar los tiempos de respuesta, los errores y la cantidad de usuarios simultáneos. |
| **Estado** | **Probado (19/11/2026, k6 contra producción): cumple.** Con 100 usuarios sin CDN: p95 171 ms (catálogo) y 494 ms (grilla), 0,02 % de errores. Hasta 2 000 usuarios desde una sola IP actúa la protección anti-DDoS de Vercel. Ver `docs/06-pruebas-y-calidad/02-pruebas-de-carga-y-analisis-bd.md`. |

## EQ-02. Consistencia: reservas simultáneas del mismo horario

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Consistencia |
| **Fuente** | Dos o más jugadores |
| **Estímulo** | Varios jugadores intentan reservar el mismo horario de la misma cancha al mismo tiempo. |
| **Condición** | El sistema funciona normalmente y el horario está libre. |
| **Respuesta esperada** | Solo un jugador obtiene la reserva; los demás reciben el aviso de que el horario ya no está disponible. |
| **Medida** | En una prueba con 50 solicitudes simultáneas para el mismo horario, se crea exactamente **una** reserva y las demás reciben `409 Conflict`. |
| **Verificación** | Ejecutar una prueba de concurrencia y revisar en la base de datos que no existan reservas cruzadas. |
| **Estado** | **Probado (19/11/2026, k6 contra producción): cumple.** 50 pedidos simultáneos → 1 reserva creada y 49 × `409 HORARIO_OCUPADO`. Script `pruebas-carga/eq02-concurrencia.js`. |

## EQ-03. Disponibilidad: continuidad del servicio

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Disponibilidad |
| **Fuente** | Jugador |
| **Estímulo** | El jugador intenta reservar, pagar o consultar al asistente cuando falla un servicio externo (por ejemplo, OpenRouter) o se acabó su cupo gratis. |
| **Condición** | El sistema está publicado y cuenta con monitoreo. |
| **Respuesta esperada** | El sistema permite seguir reservando; si la IA no responde, el comprobante queda pendiente de revisión manual por el dueño y el asistente responde con sus reglas, usando los datos de la base, y avisa que la IA no respondió. |
| **Medida** | **Propuesta por validar:** disponibilidad mensual de 99 % para la búsqueda y la reserva. |
| **Verificación** | Revisar los registros de monitoreo y calcular los periodos de disponibilidad e interrupción. |
| **Estado** | Meta mensual pendiente de aprobar y de definir la herramienta de monitoreo. **La respuesta ante la falla de la IA está probada (22/11/2026):** las pruebas del asistente simulan la IA caída, lenta, sin formato, sin clave y sin cupo, y en todos los casos responde con las reglas; las pruebas E2E corren sin clave de OpenRouter y el asistente funciona. |

## EQ-04. Seguridad: acceso a operaciones protegidas

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Seguridad |
| **Fuente** | Usuario sin sesión, con credenciales inválidas o sin permisos suficientes |
| **Estímulo** | Un jugador intenta validar un pago, un dueño intenta modificar la cancha de otro dueño o usar la gestión de usuarios, o una cuenta suspendida intenta reservar con su sesión abierta. |
| **Condición** | Se realizan pruebas sobre las funciones protegidas del sistema. |
| **Respuesta esperada** | El sistema rechaza la operación, no ejecuta el cambio solicitado y no expone información sensible ni los comprobantes de otros usuarios. |
| **Medida** | Rechazar el 100 % de los intentos no autorizados incluidos en las pruebas definidas, sin exposición de datos sensibles en las respuestas revisadas. |
| **Verificación** | Ejecutar pruebas de acceso autorizado y no autorizado por rol, revisar las respuestas y comprobar que no se expongan datos sensibles. |
| **Estado** | **Probado (19/11/2026, k6 contra producción): cumple.** 16 de 16 intentos rechazados (sin sesión y como jugador), sin datos expuestos. Script `pruebas-carga/eq04-seguridad.js`. **Ampliado el 21/11/2026 (pruebas E2E):** un dueño no entra a `/admin/usuarios` (la API responde `403`) ni cambia el WhatsApp de ayuda; una cuenta suspendida recibe `401` al reservar aunque tenga la sesión abierta; las cuentas de administrador no se pueden suspender. |

## EQ-05. Mantenibilidad: cambiar el modelo de IA

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | Mantenibilidad |
| **Fuente** | Equipo de desarrollo |
| **Estímulo** | Se necesita cambiar el modelo de IA (por ejemplo, porque un modelo gratis deja de existir) o una regla de tarifas. |
| **Condición** | El sistema está organizado en módulos y dispone de pruebas para las funciones afectadas. |
| **Respuesta esperada** | El cambio se concentra en el módulo responsable (Asistente, Pagos o Locales) sin afectar funciones no relacionadas. |
| **Medida** | Las pruebas del módulo modificado y las pruebas de regresión acordadas deben aprobarse. El cambio de modelo se realiza modificando solo la configuración o el adaptador. |
| **Verificación** | Revisar los cambios de código, ejecutar las pruebas e inspeccionar las dependencias entre módulos. |
| **Estado** | **Cumple para la IA (22/11/2026):** el modelo, los de respaldo, la temperatura y las instrucciones de cada función (`receipt_ocr` y `chat_assistant`) se cambian con un `UPDATE` en `ai_model_configs`, sin tocar código ni volver a publicar. Los dos adaptadores comparten el cliente de OpenRouter (`pedirJSON`), y cada caso de uso depende solo de su puerto (`LectorComprobantes`, `InterpreteIA`). Pruebas obligatorias: las de Jest de los módulos `pagos` y `asistente` (en el CI). |

## Resumen de escenarios

| Código | Atributo de calidad | Qué se busca comprobar |
|---|---|---|
| EQ-01 | Rendimiento | Que la disponibilidad se muestre dentro del tiempo establecido. |
| EQ-02 | Consistencia | Que nunca existan dos reservas para el mismo horario de una cancha. |
| EQ-03 | Disponibilidad | Que se pueda reservar aunque falle un servicio externo. |
| EQ-04 | Seguridad | Que las operaciones protegidas no puedan ejecutarse sin autorización. |
| EQ-05 | Mantenibilidad | Que los cambios puedan realizarse sin afectar innecesariamente otras funciones. |
