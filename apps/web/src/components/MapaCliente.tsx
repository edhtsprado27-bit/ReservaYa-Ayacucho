"use client";

// Leaflet necesita el navegador (usa window), así que el mapa no se prerenderiza en el servidor.
import dynamic from "next/dynamic";

const MapaCliente = dynamic(() => import("./MapaCanchas"), {
  ssr: false,
  loading: () => <div className="mapa mapa--cargando">Cargando mapa…</div>,
});

export default MapaCliente;
