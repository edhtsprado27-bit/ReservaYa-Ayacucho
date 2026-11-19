// Entidad Cancha del catálogo y sus reglas (distritos, deportes, nombres).
// Capa: dominio. No usa nada del servidor: se puede importar desde
// componentes del navegador y desde las rutas /api.

export type DeporteWeb = "Fútbol" | "Vóley" | "Futsal";

// Misma forma que el tipo `Cancha` de ./ubicacion.ts,
// para que el mapa y la lista la usen sin cambios.
export type CanchaBD = {
  id: string;
  slug: string;
  nombre: string;
  distrito: string;
  direccion: string;
  referencia?: string;
  lat: number;
  lng: number;
  deportes: DeporteWeb[];
  techada: boolean;
  precioDesde?: number;
  telefono?: string;
  rating?: number;
  totalResenas?: number;
};

// Lo que se envía al registrar una cancha con "+ Agregar cancha"
export type NuevaCancha = {
  nombre: string;
  distrito: string;
  lat: number;
  lng: number;
  direccion?: string;
  referencia?: string;
  deportes?: DeporteWeb[];
  techada?: boolean;
  precioDesde?: number;
  telefono?: string;
};

// Distritos activos, con el mismo texto que usa la web
export const DISTRITOS_WEB = [
  "Ayacucho",
  "Carmen Alto",
  "San Juan Bautista",
  "Jesús Nazareno",
  "Andrés Avelino Cáceres D.",
] as const;

// sport_type de la base de datos <-> texto de la web
const DEPORTE_A_WEB: Record<string, DeporteWeb> = {
  futbol: "Fútbol",
  futsal: "Futsal",
  voley: "Vóley",
};

export function deporteAWeb(codigo: string): DeporteWeb | null {
  return DEPORTE_A_WEB[codigo] ?? null;
}

export function deporteABD(texto: string): string | null {
  const t = normalizar(texto);
  if (t.startsWith("futbol")) return "futbol";
  if (t.startsWith("futsal")) return "futsal";
  if (t.startsWith("voley") || t.startsWith("voli")) return "voley";
  return null;
}

// "Jesús Nazareno" -> "jesusnazareno"
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Nombre del distrito en la base de datos -> texto de la web.
// Ej.: "Andrés Avelino Cáceres Dorregaray" -> "Andrés Avelino Cáceres D."
export function distritoAWeb(nombreBD: string): string {
  const n = normalizar(nombreBD);
  const encontrado = DISTRITOS_WEB.find((d) => n.startsWith(normalizar(d.replace(/\s+[A-Za-z]\.$/, ""))));
  return encontrado ?? nombreBD;
}
