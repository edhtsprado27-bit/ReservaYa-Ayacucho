// Fechas, horas y formatos de las reservas, siempre en hora de Ayacucho
// (UTC-5, sin horario de verano). Capa: dominio (funciones puras).

import { DIAS_RESERVABLES } from "./reserva";

export const ZONA = "America/Lima";
const OFFSET = "-05:00";

// ---------------------------------------------------------------------
// Fechas en hora de Ayacucho
// ---------------------------------------------------------------------
const fmtFecha = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("es-PE", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDiaSemana = new Intl.DateTimeFormat("es-PE", { timeZone: ZONA, weekday: "short" });
const fmtDiaMes = new Intl.DateTimeFormat("es-PE", { timeZone: ZONA, day: "numeric", month: "short" });
const fmtLargo = new Intl.DateTimeFormat("es-PE", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });

const sinPunto = (s: string) => s.replace(/\./g, "");
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-11-19" de un instante (en hora de Ayacucho) */
export const fechaLima = (d: Date | string = new Date()) => fmtFecha.format(typeof d === "string" ? new Date(d) : d);

/** "19:00" */
export const horaLima = (d: Date | string) => fmtHora.format(typeof d === "string" ? new Date(d) : d);

/** Mediodía de ese día en Ayacucho (para sumar días sin errores de zona) */
const mediodia = (fecha: string) => new Date(`${fecha}T12:00:00${OFFSET}`);

export function sumarDias(fecha: string, dias: number): string {
  return fechaLima(new Date(mediodia(fecha).getTime() + dias * 86_400_000));
}

export const esFechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(mediodia(f).getTime());

/** Chips del selector de días: { fecha, arriba: "Hoy" | "Vie", abajo: "20 nov" } */
export function diasParaElegir(hoy: string, cuantos = DIAS_RESERVABLES) {
  return Array.from({ length: cuantos }, (_, i) => {
    const fecha = sumarDias(hoy, i);
    const d = mediodia(fecha);
    const arriba = i === 0 ? "Hoy" : i === 1 ? "Mañana" : mayuscula(sinPunto(fmtDiaSemana.format(d)));
    return { fecha, arriba, abajo: sinPunto(fmtDiaMes.format(d)) };
  });
}

/** "jueves 20 de noviembre" -> "Jueves 20 de noviembre" */
export const fechaLarga = (d: Date | string) =>
  mayuscula(fmtLargo.format(typeof d === "string" ? new Date(d) : d));

/** "Jueves 20 de noviembre · 19:00 – 21:00" */
export const rangoTexto = (inicio: string, fin: string) => `${fechaLarga(inicio)} · ${horaLima(inicio)} – ${horaLima(fin)}`;

/** 90 -> "1 h 30 min" */
export function minutosTexto(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const duracionTexto = (inicio: string, fin: string) =>
  minutosTexto((new Date(fin).getTime() - new Date(inicio).getTime()) / 60_000);

export const soles = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

// ---------------------------------------------------------------------
// Clave única por intento de reserva (evita duplicados por doble clic).
// crypto.randomUUID solo existe en https/localhost; si no, se arma a mano.
// ---------------------------------------------------------------------
export function nuevaClave(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
