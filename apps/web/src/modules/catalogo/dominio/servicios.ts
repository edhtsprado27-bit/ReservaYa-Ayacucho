// Servicios del local (vestuarios, duchas, estacionamiento...): RF01 y RF03.
// El dueño los marca en "Configurar mi local", salen en la ficha y el mapa se
// puede filtrar por ellos. Misma lista y mismo orden que la tabla amenities
// (012_servicios_usuarios_whatsapp.sql).
// Capa: dominio (sin dependencias: se usa en el navegador y en el servidor).

export const SERVICIOS = [
  { codigo: "vestuarios", nombre: "Vestuarios", corto: "Vestuarios" },
  { codigo: "duchas", nombre: "Duchas", corto: "Duchas" },
  { codigo: "banos", nombre: "Baños", corto: "Baños" },
  { codigo: "estacionamiento", nombre: "Estacionamiento", corto: "Estacionamiento" },
  { codigo: "cafeteria", nombre: "Cafetería o kiosko", corto: "Kiosko" },
  { codigo: "tribuna", nombre: "Tribuna", corto: "Tribuna" },
  { codigo: "iluminacion", nombre: "Iluminación nocturna", corto: "Luz de noche" },
  { codigo: "balon_incluido", nombre: "Balón incluido", corto: "Balón" },
] as const;

export type CodigoServicio = (typeof SERVICIOS)[number]["codigo"];

export const esServicio = (x: unknown): x is CodigoServicio => SERVICIOS.some((s) => s.codigo === x);

export const nombreServicio = (codigo: string) => SERVICIOS.find((s) => s.codigo === codigo)?.nombre ?? codigo;

/** Solo los códigos conocidos, sin repetir y en el orden de la lista */
export function ordenarServicios(codigos: readonly unknown[] | null | undefined): CodigoServicio[] {
  const marcados = new Set(codigos ?? []);
  return SERVICIOS.filter((s) => marcados.has(s.codigo)).map((s) => s.codigo);
}

/** ¿El local tiene TODOS los servicios pedidos en el filtro? (sin filtro: sí) */
export const tieneServicios = (delLocal: readonly string[] | undefined, pedidos: readonly string[]) =>
  pedidos.every((p) => (delLocal ?? []).includes(p));
