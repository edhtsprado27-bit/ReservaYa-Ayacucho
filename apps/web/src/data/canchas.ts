// Canchas que se muestran en el mapa.
// Por ahora es una lista local de EJEMPLO para probar el mapa.
// En la siguiente etapa estos datos vendrán de Supabase (tabla venues),
// cargados desde el panel admin o registrados por cada dueño.

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
};

// Plaza de Armas de Huamanga: centro del mapa y punto de partida
export const PLAZA_DE_ARMAS = { lat: -13.1588, lng: -74.2239 };

// Límites de la provincia de Huamanga (mismo recuadro que la base de datos)
export const LIMITES_HUAMANGA: [[number, number], [number, number]] = [
  [-13.6, -74.75],
  [-12.8, -73.75],
];

// DATOS DE EJEMPLO: nombres inventados. Reemplázalos por tus canchas reales.
export const CANCHAS: Cancha[] = [
  {
    id: "ejemplo-1",
    nombre: "Cancha de ejemplo Centro",
    distrito: "Ayacucho",
    direccion: "Dirección de ejemplo",
    referencia: "Cerca de la Plaza de Armas",
    lat: -13.1601,
    lng: -74.2262,
    deportes: ["Fútbol", "Vóley"],
    techada: false,
    precioDesde: 50,
  },
  {
    id: "ejemplo-2",
    nombre: "Cancha de ejemplo Carmen Alto",
    distrito: "Carmen Alto",
    direccion: "Dirección de ejemplo",
    lat: -13.1745,
    lng: -74.2235,
    deportes: ["Fútbol"],
    techada: true,
    precioDesde: 60,
  },
  {
    id: "ejemplo-3",
    nombre: "Cancha de ejemplo San Juan",
    distrito: "San Juan Bautista",
    direccion: "Dirección de ejemplo",
    lat: -13.1712,
    lng: -74.2125,
    deportes: ["Fútbol", "Futsal"],
    techada: false,
    precioDesde: 55,
  },
  {
    id: "ejemplo-4",
    nombre: "Cancha de ejemplo Nazareno",
    distrito: "Jesús Nazareno",
    direccion: "Dirección de ejemplo",
    lat: -13.1508,
    lng: -74.2135,
    deportes: ["Fútbol"],
    techada: false,
    precioDesde: 50,
  },
  {
    id: "ejemplo-5",
    nombre: "Cancha de ejemplo Cáceres",
    distrito: "Andrés Avelino Cáceres D.",
    direccion: "Dirección de ejemplo",
    lat: -13.1675,
    lng: -74.2028,
    deportes: ["Fútbol", "Vóley"],
    techada: false,
    precioDesde: 45,
  },
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
