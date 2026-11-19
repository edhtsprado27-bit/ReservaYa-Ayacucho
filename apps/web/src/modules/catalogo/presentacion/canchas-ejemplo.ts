// Canchas de EJEMPLO para probar el mapa sin datos reales (se pueden ocultar).

import type { Cancha } from "../dominio/ubicacion";

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
