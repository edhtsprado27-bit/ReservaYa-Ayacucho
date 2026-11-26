// Búsqueda del asistente sobre datos REALES: filtra el catálogo publicado y
// mira las horas libres de la grilla de cada local. Luego arma el texto de
// la respuesta. Capa: dominio (funciones puras; los datos los trae el caso de uso).

import { normalizar, type CanchaBD } from "@/modules/catalogo/dominio/cancha";
import type { LocalPublico, Turno } from "@/modules/reservas/dominio/reserva";
import { horaLima } from "@/modules/reservas/dominio/tiempo";
import {
  cuandoTexto,
  describirBusqueda,
  FRANJA_HORAS,
  FRANJA_TEXTO,
  type Filtros,
  type HoraLibre,
  type Recomendacion,
} from "./asistente";

export const MAX_LOCALES_A_REVISAR = 6;
export const MAX_RECOMENDACIONES = 3;
const MAX_HORAS = 4;

/** Locales publicados que cumplen los filtros, del más barato al más caro */
export function filtrarCatalogo(catalogo: CanchaBD[], f: Filtros): CanchaBD[] {
  const nombre = f.nombre ? normalizar(f.nombre) : null;
  return catalogo
    .filter((c) => !f.distrito || c.distrito === f.distrito)
    .filter((c) => !f.deporte || c.deportes.includes(f.deporte))
    .filter((c) => !f.techada || c.techada)
    .filter((c) => f.servicios.every((s) => (c.servicios ?? []).includes(s)))
    .filter((c) => !f.precioMax || c.precioDesde === undefined || c.precioDesde <= f.precioMax)
    .filter((c) => !nombre || normalizar(c.nombre).includes(nombre))
    .sort((a, b) => (a.precioDesde ?? 9999) - (b.precioDesde ?? 9999) || a.nombre.localeCompare(b.nombre, "es"));
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const enlaceFicha = (slug: string, fecha?: string | null) => `/cancha/${slug}${fecha ? `?fecha=${fecha}` : ""}`;

/** Enlace que abre la grilla con esa hora ya elegida */
export const enlaceHora = (slug: string, fecha: string, t: Turno) =>
  `/cancha/${slug}?fecha=${fecha}&cancha=${t.cancha}&desde=${horaLima(t.inicio)}&hasta=${horaLima(t.fin)}`;

/** Horas libres de un local ese día que sirven para la búsqueda */
export function evaluarLocal(
  catalogo: CanchaBD,
  local: LocalPublico,
  turnos: Turno[],
  f: Filtros & { fecha: string },
): Recomendacion {
  const canchas = new Map(
    local.canchas
      .filter((c) => !f.deporte || c.deporte === f.deporte)
      .filter((c) => !f.techada || c.techada)
      .map((c) => [c.id, c]),
  );
  // Una hora por inicio (si dos canchas están libres a la misma hora, la más barata)
  const porHora = new Map<string, Turno>();
  for (const t of turnos) {
    if (t.estado !== "libre" || !canchas.has(t.cancha)) continue;
    if (f.precioMax && t.precio !== null && t.precio > f.precioMax) continue;
    const h = horaLima(t.inicio);
    const actual = porHora.get(h);
    if (!actual || (t.precio ?? 9999) < (actual.precio ?? 9999)) porHora.set(h, t);
  }
  let elegidas = [...porHora.entries()].sort(([a], [b]) => a.localeCompare(b));
  let exacta = false;
  if (f.hora) {
    const pedida = minutos(f.hora);
    exacta = porHora.has(f.hora);
    // La hora pedida primero y luego las más cercanas (hasta 3 horas de diferencia)
    elegidas = elegidas
      .filter(([h]) => Math.abs(minutos(h) - pedida) <= 180)
      .sort(([a], [b]) => Math.abs(minutos(a) - pedida) - Math.abs(minutos(b) - pedida) || a.localeCompare(b));
  } else if (f.franja) {
    const [desde, hasta] = FRANJA_HORAS[f.franja];
    elegidas = elegidas.filter(([h]) => Number(h.slice(0, 2)) >= desde && Number(h.slice(0, 2)) <= hasta);
  }
  const horas: HoraLibre[] = elegidas.slice(0, MAX_HORAS).map(([hora, t]) => ({
    hora,
    hasta: horaLima(t.fin),
    cancha: canchas.get(t.cancha)?.nombre ?? "",
    precio: t.precio,
    enlace: enlaceHora(local.slug, f.fecha, t),
  }));
  if (f.hora) horas.sort((a, b) => a.hora.localeCompare(b.hora));
  return { ...base(catalogo, f.fecha), horas, exacta };
}

/** Recomendación sin horas (cuando todavía no hay día) */
export const sinHoras = (c: CanchaBD): Recomendacion => ({ ...base(c, null), horas: [], exacta: false });

const base = (c: CanchaBD, fecha: string | null) => ({
  slug: c.slug,
  nombre: c.nombre,
  distrito: c.distrito,
  precioDesde: c.precioDesde ?? null,
  servicios: c.servicios ?? [],
  deportes: c.deportes,
  enlace: enlaceFicha(c.slug, fecha),
});

/** Primero los que tienen la hora exacta, luego los que tienen más horas libres */
export const ordenarRecomendaciones = (r: Recomendacion[]) =>
  [...r].filter((x) => x.horas.length).sort((a, b) => Number(b.exacta) - Number(a.exacta) || b.horas.length - a.horas.length);

// ---------------------------------------------------------------------
// Texto de la respuesta
// ---------------------------------------------------------------------
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** "el sábado 28 de noviembre a las 19:00" / "hoy en la noche" / "mañana" */
export function cuandoBusqueda(f: Filtros, hoy: string): string {
  if (!f.fecha) return "";
  const dia = cuandoTexto(f.fecha, hoy);
  if (f.hora) return `${dia} a las ${f.hora}`;
  if (f.franja) return `${dia} ${FRANJA_TEXTO[f.franja]}`;
  return dia;
}

export function redactarBusqueda(f: Filtros, hoy: string, encontrados: number, recs: Recomendacion[]): string {
  const que = describirBusqueda(f);
  if (!encontrados) return `No encontré locales con ${que}. Prueba quitando algún filtro.`;
  if (!f.fecha) {
    return `Encontré ${plural(encontrados, "local", "locales")} con ${que}. Dime el día y la hora y te digo qué horas tienen libres.`;
  }
  const cuando = cuandoBusqueda(f, hoy);
  if (!recs.length) return `No quedan horas libres de ${que} ${cuando}. Prueba otro día u otra hora.`;
  if (f.hora) {
    const exactas = recs.filter((r) => r.exacta).length;
    if (exactas) return `Para ${cuando} encontré ${plural(exactas, "local", "locales")} con ${que} y esa hora libre. Toca una hora para reservarla:`;
    return `A las ${f.hora} no hay ${que} libres ${cuandoTexto(f.fecha, hoy)}, pero estas horas cercanas sí:`;
  }
  return `Para ${cuando}, estas son las horas libres de ${que}. Toca una para reservarla:`;
}
