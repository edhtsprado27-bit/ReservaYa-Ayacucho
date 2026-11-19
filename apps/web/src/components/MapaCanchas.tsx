"use client";

// Mapa con OpenStreetMap + Leaflet: gratis, sin clave y sin tarjeta.
// Este archivo solo se carga en el navegador (ver MapaCliente.tsx).

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";
import {
  LIMITES_HUAMANGA,
  PLAZA_DE_ARMAS,
  enlaceGoogleMaps,
  enlaceWaze,
  type Cancha,
} from "@/modules/catalogo/dominio/ubicacion";

// Pin naranja de ReservaYa (dibujado con HTML: evita las imágenes por defecto de Leaflet)
const pin = (activo: boolean, ejemplo: boolean, revision: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="ry-pin${activo ? " ry-pin--activo" : ""}${ejemplo ? " ry-pin--ejemplo" : ""}${revision ? " ry-pin--revision" : ""}"><span></span></div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });

const pinNuevo = L.divIcon({
  className: "",
  html: `<div class="ry-pin ry-pin--nuevo"><span></span></div>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

type Punto = { lat: number; lng: number };

type Props = {
  canchas: (Cancha & { km?: number })[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
  miUbicacion: Punto | null;
  modoAgregar: boolean;
  nuevoPunto: Punto | null;
  onElegirPunto: (p: Punto) => void;
  enRevision?: string[]; // ids de canchas registradas que aún no se aprueban
};

// Mueve el mapa cuando se elige una cancha en la lista o se detecta la ubicación
function Enfocar({ canchas, seleccionada, miUbicacion }: Pick<Props, "canchas" | "seleccionada" | "miUbicacion">) {
  const map = useMap();
  useEffect(() => {
    const c = canchas.find((x) => x.id === seleccionada);
    if (c) map.flyTo([c.lat, c.lng], 18, { duration: 0.8 });
  }, [seleccionada, canchas, map]);
  useEffect(() => {
    if (miUbicacion) map.flyTo([miUbicacion.lat, miUbicacion.lng], 16, { duration: 0.8 });
  }, [miUbicacion, map]);
  return null;
}

// En modo "agregar cancha", un clic en el mapa marca la ubicación
function CapturarClic({ activo, onElegirPunto }: { activo: boolean; onElegirPunto: (p: Punto) => void }) {
  const map = useMapEvents({
    click(e) {
      if (activo) onElegirPunto({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = activo ? "crosshair" : "";
  }, [activo, map]);
  return null;
}

export default function MapaCanchas({ canchas, seleccionada, onSeleccionar, miUbicacion, modoAgregar, nuevoPunto, onElegirPunto, enRevision = [] }: Props) {
  return (
    <MapContainer
      center={[PLAZA_DE_ARMAS.lat, PLAZA_DE_ARMAS.lng]}
      zoom={14}
      minZoom={11}
      maxZoom={19}
      maxBounds={LIMITES_HUAMANGA}
      maxBoundsViscosity={1}
      scrollWheelZoom
      className="mapa"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {miUbicacion && (
        <Circle
          center={[miUbicacion.lat, miUbicacion.lng]}
          radius={60}
          pathOptions={{ color: "#1d72e8", fillColor: "#1d72e8", fillOpacity: 0.35 }}
        />
      )}
      {canchas.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lng]}
          icon={pin(c.id === seleccionada, c.id.startsWith("ejemplo"), enRevision.includes(c.id))}
          eventHandlers={{ click: () => onSeleccionar(c.id) }}
        >
          <Popup>
            <div className="popup">
              <strong>{c.nombre}</strong>
              {enRevision.includes(c.id) ? <span className="popup-revision">En revisión: aún no la ven los demás</span> : null}
              <span>
                {c.distrito}
                {c.km !== undefined ? ` · ${c.km.toFixed(1)} km` : ""}
              </span>
              <span>{c.direccion}</span>
              {c.telefono ? <span>Tel. {c.telefono}</span> : null}
              {c.precioDesde ? <span>Desde S/ {c.precioDesde} por hora</span> : null}
              <div className="popup-botones">
                {c.slug && !enRevision.includes(c.id) && (
                  <Link className="popup-reservar" href={`/cancha/${c.slug}`}>
                    Reservar
                  </Link>
                )}
                <a href={enlaceGoogleMaps(c)} target="_blank" rel="noopener noreferrer">
                  Cómo llegar · Google Maps
                </a>
                <a href={enlaceWaze(c)} target="_blank" rel="noopener noreferrer">
                  Waze
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      {modoAgregar && nuevoPunto && (
        <Marker
          position={[nuevoPunto.lat, nuevoPunto.lng]}
          icon={pinNuevo}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onElegirPunto({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
            },
          }}
        />
      )}
      <CapturarClic activo={modoAgregar} onElegirPunto={onElegirPunto} />
      <Enfocar canchas={canchas} seleccionada={seleccionada} miUbicacion={miUbicacion} />
    </MapContainer>
  );
}
