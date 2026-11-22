# Nivel 1 · Diagrama de contexto del sistema

> **Proyecto:** ReservaYa Ayacucho  
> **Modelo:** C4 · Nivel 1 de 4 · **Versión:** 2.0 (Sprint 2: alineado con el sistema implementado)

---

## 1. Objetivo

Mostrar **ReservaYa Ayacucho como una sola caja**: quiénes lo usan y con qué sistemas externos se comunica. Es la vista de mayor nivel y la primera que se presenta a cualquier persona, técnica o no.

| Aspecto               | Descripción                                                           |
|-----------------------|-----------------------------------------------------------------------|
| Pregunta que responde | ¿Qué es el sistema, quién lo usa y con quién se integra?              |
| Audiencia             | Todos: dueños de canchas, docentes, equipo de desarrollo, operaciones |
| Qué **no** muestra    | Tecnologías, servidores, bases de datos ni módulos internos           |
| Siguiente nivel       | `Nivel2-DiagramadeContenedores.md`                                    |

---

## 2. Diagrama

[![Diagrama de contexto de ReservaYa Ayacucho](/img/nivel1-contexto.png)](/img/nivel1-contexto.png)

> Archivo editable: `img/fuentes-svg/nivel1-contexto.mmd`

---

## 3. Personas (usuarios)

| Persona             | Descripción                                         | Qué hace en el sistema                                                                                                        |
|---------------------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Jugador**         | Persona que reserva canchas para jugar              | Busca canchas por distrito, ve la disponibilidad en tiempo real, reserva, sube su comprobante de pago y consulta sus reservas |
| **Dueño de cancha** | Propietario que ofrece sus canchas en la plataforma | Registra sus locales y canchas, define horarios, tarifas y servicios, y valida las reservas y pagos                           |
| **Administrador**   | Responsable de la operación de la plataforma        | Aprueba canchas nuevas, gestiona usuarios y revisa estadísticas                                                               |

---

## 4. Sistemas

| Sistema                | Tipo               | Responsabilidad                                                                                          | Quién lo construye                  |
|------------------------|--------------------|----------------------------------------------------------------------------------------------------------|-------------------------------------|
| **ReservaYa Ayacucho** | Sistema en alcance | Permite a los dueños publicar sus canchas y a los jugadores reservarlas y pagarlas sin cruces de horario | El equipo del proyecto              |
| **Yape / Plin**        | Sistema externo    | Billeteras digitales donde el jugador paga el adelanto al dueño                                          | Bancos (BCP, Interbank y asociados) |
| **OpenRouter**         | Sistema externo    | Da acceso a modelos de IA (gratuitos) para leer los comprobantes de pago                                 | Proveedor OpenRouter                |
| **OpenStreetMap**      | Sistema externo    | Provee las teselas del mapa donde se ubican los locales                                                  | Comunidad OpenStreetMap             |
| **Google Maps / Waze** | Sistema externo    | Trazan la ruta hasta el local en el celular del jugador (solo con un enlace)                             | Google                              |

---

## 5. Relaciones

| Origen             | Destino            | Descripción                                                            | Protocolo  |
|--------------------|--------------------|------------------------------------------------------------------------|------------|
| Jugador            | ReservaYa Ayacucho | Busca canchas, reserva y sube su comprobante                           | —          |
| Dueño de cancha    | ReservaYa Ayacucho | Registra sus canchas, sus datos de Yape/Plin y revisa los pagos        | —          |
| Administrador      | ReservaYa Ayacucho | Aprueba canchas y gestiona usuarios                                    | —          |
| Jugador            | Yape / Plin        | Paga el adelanto desde su aplicación                                   | —          |
| ReservaYa Ayacucho | OpenRouter         | Envía la captura para leer monto, n.º de operación, fecha y destinatario | HTTPS/REST |
| ReservaYa Ayacucho | OpenStreetMap      | Descarga las teselas del mapa                                          | HTTPS      |
| Jugador            | Google Maps / Waze | Abre la ruta hasta el local desde el enlace «Cómo llegar»              | —          |
| Jugador, dueño y admin | WhatsApp       | Abren un chat con el mensaje ya escrito desde los enlaces `wa.me` (local, reserva, «Ayuda») | —          |

> En el nivel 1 no se indica el protocolo entre personas y sistema: eso se detalla en el nivel 2.

---

## 6. Decisiones y supuestos

| \# | Decisión o supuesto                                    | Motivo                                                                                                                                  |
|----|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| 1  | ReservaYa **no se conecta directamente con Yape/Plin** | No ofrecen una API pública de cobros; el jugador paga en su app y sube la captura del comprobante, que la IA lee y el dueño confirma (ADR-005) |
| 2  | ReservaYa **no almacena datos bancarios**              | Solo guarda la imagen del comprobante (en un almacén privado) y el estado del pago                                                      |
| 3  | El mapa usa **OpenStreetMap** y no Google Maps         | Google Maps Platform exige tarjeta de crédito; Google Maps y Waze se usan solo como enlaces de «Cómo llegar» (ADR-012)                  |
| 4  | Los sistemas externos no se modifican                  | Son de terceros; ReservaYa se adapta a ellos (patrón Adapter)                                                                           |
| 5  | ReservaYa **no se integra con la API de WhatsApp**     | Solo genera enlaces `wa.me`: la persona envía el mensaje desde su propio WhatsApp. Sin costo, sin claves y sin número de empresa (ADR-014) |

### Pendientes por definir

| Tema                    | Detalle                                                                                                       |
|-------------------------|---------------------------------------------------------------------------------------------------------------|
| Avisos de reservas      | Hoy la cuenta usa el correo de Supabase Auth. Los avisos automáticos de reservas irán por correo (RF10) como sistema externo; WhatsApp queda solo como enlaces (ADR-014) |

---
