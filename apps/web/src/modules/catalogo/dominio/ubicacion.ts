// Ubicación de las canchas: distritos, límites de Huamanga, distancias y
// enlaces de "Cómo llegar". Capa: dominio (funciones puras, sin servidor).

export type Distrito =
  | "Ayacucho"
  | "Carmen Alto"
  | "San Juan Bautista"
  | "Jesús Nazareno"
  | "Andrés Avelino Cáceres D.";

export const DISTRITOS: Distrito[] = [
  "Ayacucho",
  "Carmen Alto",
  "San Juan Bautista",
  "Jesús Nazareno",
  "Andrés Avelino Cáceres D.",
];

export type Cancha = {
  id: string;
  slug?: string; // solo las canchas publicadas: abre /cancha/<slug> para reservar
  nombre: string;
  distrito: Distrito;
  direccion: string;
  referencia?: string;
  lat: number;
  lng: number;
  deportes: ("Fútbol" | "Vóley" | "Futsal")[];
  techada: boolean;
  precioDesde?: number; // soles por hora; lo define el dueño
  telefono?: string;
  servicios?: string[]; // vestuarios, duchas... (ver ./servicios.ts)
};

// Plaza de Armas de Huamanga: centro del mapa y punto de partida
export const PLAZA_DE_ARMAS = { lat: -13.1588, lng: -74.2239 };

// Límites de la provincia de Huamanga (mismo recuadro que la base de datos)
export const LIMITES_HUAMANGA: [[number, number], [number, number]] = [
  [-13.6, -74.75],
  [-12.8, -73.75],
];

// Enlaces de "Cómo llegar": abren la app del celular. No usan API ni cuestan nada.
export const enlaceGoogleMaps = (c: Pick<Cancha, "lat" | "lng">) =>
  `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
export const enlaceWaze = (c: Pick<Cancha, "lat" | "lng">) =>
  `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;

// Distancia en km entre dos puntos (fórmula de Haversine)
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const dentroDeHuamanga = (p: { lat: number; lng: number }) =>
  p.lat >= LIMITES_HUAMANGA[0][0] && p.lat <= LIMITES_HUAMANGA[1][0] &&
  p.lng >= LIMITES_HUAMANGA[0][1] && p.lng <= LIMITES_HUAMANGA[1][1];
