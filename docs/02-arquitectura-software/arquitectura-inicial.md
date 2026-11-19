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
subgraph PRESENTACION["PRESENTACIÓN · Next.js en Vercel"]
    Web["Páginas web"]
    API["API REST (/api)"]
end

%% =========================
%% LÓGICA DE NEGOCIO
%% =========================
subgraph NEGOCIO["LÓGICA DE NEGOCIO · módulos"]
    Cuentas["Cuentas"]
    Catalogo["Catálogo"]
    Reservas["Reservas"]
    Pagos["Pagos"]
end

%% =========================
%% DATOS
%% =========================
subgraph DATOS["DATOS · Supabase"]
    BD["PostgreSQL"]
    Auth["Auth"]
    Archivos["Storage (comprobantes)"]
    Cache["Caché (memoria, CDN, Redis)"]
end

%% =========================
%% SISTEMAS EXTERNOS
%% =========================
subgraph EXTERNOS["SISTEMAS EXTERNOS"]
    OpenRouter["OpenRouter (IA)"]
    OSM["OpenStreetMap"]
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
Pagos --> OpenRouter
Web --> OSM

%% =========================
%% DISTRIBUCIÓN HORIZONTAL
%% =========================
Jugador ~~~ Dueno
Dueno ~~~ Admin

Cuentas ~~~ Catalogo
Catalogo ~~~ Reservas
Reservas ~~~ Pagos

BD ~~~ Auth
Auth ~~~ Archivos
Archivos ~~~ Cache

OpenRouter ~~~ OSM

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

style Cuentas fill:#222,stroke:#fff,color:#fff
style Catalogo fill:#222,stroke:#fff,color:#fff
style Reservas fill:#222,stroke:#fff,color:#fff
style Pagos fill:#222,stroke:#fff,color:#fff

style BD fill:#222,stroke:#fff,color:#fff
style Auth fill:#222,stroke:#fff,color:#fff
style Archivos fill:#222,stroke:#fff,color:#fff
style Cache fill:#222,stroke:#fff,color:#fff

style OpenRouter fill:#222,stroke:#fff,color:#fff
style OSM fill:#222,stroke:#fff,color:#fff
```
## Descripción

La arquitectura se organiza en tres capas principales:

- **Presentación:** las páginas web y la API REST, ambas en una sola aplicación Next.js desplegada en Vercel (ADR-009).
- **Lógica de negocio:** los módulos del monolito (`apps/web/src/modules/`): cuentas, catálogo, reservas y pagos, más un módulo compartido. Cada uno se organiza por dentro con Clean Architecture (ADR-002).
- **Datos:** Supabase aporta PostgreSQL (con las reglas críticas en funciones `SECURITY DEFINER` y RLS), la autenticación y el almacenamiento privado de los comprobantes (ADR-010). La caché trabaja en memoria, en el CDN de Vercel y, desde el Sprint 2, en Redis (ADR-004).

El módulo de **Pagos** usa **OpenRouter** para leer los comprobantes con IA. El mapa se dibuja con **OpenStreetMap**, y «Cómo llegar» abre Google Maps o Waze con un enlace (ADR-012). Los pagos por **Yape/Plin** se hacen fuera del sistema: el jugador solo sube la captura del comprobante.
