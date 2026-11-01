# Arquitectura inicial del sistema

## Diagrama de arquitectura

```mermaid
flowchart TD

%% =========================
%% ACTORES
%% =========================
subgraph ACTORES["ACTORES"]
    Jugador["Jugador"]
    Dueno["Dueño de cancha"]
    Admin["Administrador"]
end

%% =========================
%% PRESENTACIÓN
%% =========================
subgraph PRESENTACION["PRESENTACIÓN"]
    Web["Aplicación Web"]
    API["API REST"]
end

%% =========================
%% LÓGICA DE NEGOCIO
%% =========================
subgraph NEGOCIO["LÓGICA DE NEGOCIO"]
    Usuarios["Usuarios"]
    Canchas["Canchas"]
    Horarios["Horarios"]
    Reservas["Reservas"]
    Pagos["Pagos"]
    IA["Asistente IA"]
end

%% =========================
%% DATOS
%% =========================
subgraph DATOS["DATOS"]
    BD["Base de datos"]
    Cache["Caché y bloqueos"]
    Archivos["Almacenamiento de archivos"]
end

%% =========================
%% SISTEMAS EXTERNOS
%% =========================
subgraph EXTERNOS["SISTEMAS EXTERNOS"]
    OpenRouter["OpenRouter"]
    Correo["Servicio de correo"]
    Maps["Google Maps"]
end

%% =========================
%% FLUJO PRINCIPAL
%% =========================
ACTORES --> Web
Web --> API
API --> NEGOCIO
NEGOCIO --> DATOS

%% =========================
%% INTEGRACIONES EXTERNAS
%% =========================
NEGOCIO --> OpenRouter
NEGOCIO --> Correo
NEGOCIO --> Maps
Web --> Maps

%% =========================
%% DISTRIBUCIÓN HORIZONTAL
%% =========================
Jugador ~~~ Dueno
Dueno ~~~ Admin

Usuarios ~~~ Canchas
Canchas ~~~ Horarios
Horarios ~~~ Reservas
Reservas ~~~ Pagos
Pagos ~~~ IA

BD ~~~ Cache
Cache ~~~ Archivos

OpenRouter ~~~ Correo
Correo ~~~ Maps

%% =========================
%% ESTILOS
%% =========================
style ACTORES fill:#222,stroke:#fff,stroke-width:2px,color:#fff
style PRESENTACION fill:#222,stroke:#fff,stroke-width:2px,color:#fff
style NEGOCIO fill:#222,stroke:#fff,stroke-width:2px,color:#fff
style DATOS fill:#222,stroke:#fff,stroke-width:2px,color:#fff
style EXTERNOS fill:#222,stroke:#fff,stroke-width:2px,color:#fff

style Jugador fill:#222,stroke:#fff,color:#fff
style Dueno fill:#222,stroke:#fff,color:#fff
style Admin fill:#222,stroke:#fff,color:#fff

style Web fill:#222,stroke:#fff,color:#fff
style API fill:#222,stroke:#fff,color:#fff

style Usuarios fill:#222,stroke:#fff,color:#fff
style Canchas fill:#222,stroke:#fff,color:#fff
style Horarios fill:#222,stroke:#fff,color:#fff
style Reservas fill:#222,stroke:#fff,color:#fff
style Pagos fill:#222,stroke:#fff,color:#fff
style IA fill:#222,stroke:#fff,color:#fff

style BD fill:#222,stroke:#fff,color:#fff
style Cache fill:#222,stroke:#fff,color:#fff
style Archivos fill:#222,stroke:#fff,color:#fff

style OpenRouter fill:#222,stroke:#fff,color:#fff
style Correo fill:#222,stroke:#fff,color:#fff
style Maps fill:#222,stroke:#fff,color:#fff
```
## Descripción

La arquitectura inicial se organiza en tres capas principales:

- **Presentación:** permite la interacción de los usuarios con el sistema mediante la aplicación web y la API REST.
- **Lógica de negocio:** contiene los principales módulos responsables de las funcionalidades del sistema: usuarios, canchas, horarios, reservas, pagos y asistente IA.
- **Datos:** permite almacenar y consultar la información mediante una base de datos, una caché con bloqueos de horarios y un almacenamiento de archivos para los comprobantes.

Además, los módulos de **Pagos** y **Asistente IA** se integran con **OpenRouter**, el sistema envía avisos mediante el **servicio de correo**, y usa **Google Maps** para mostrar los locales en el mapa (desde la aplicación web) y convertir direcciones en coordenadas (desde el módulo Canchas). La ruta se abre en Google Maps o **Waze** con un enlace. Los pagos por **Yape/Plin** se realizan fuera del sistema: el jugador solo sube la captura del comprobante.
