// Tipos y formatos de las reservas. Sin nada del servidor:
// se usa en el navegador (grilla de horarios) y en las rutas /api.
// Todas las horas se muestran en hora de Ayacucho (UTC-5, sin horario de verano).

import { deporteAWeb } from "./canchas-db";

export const ZONA = "America/Lima";
const OFFSET = "-05:00";
export const DIAS_RESERVABLES = 14; // días que se muestran en la grilla (la base acepta hasta 30)

// ---------------------------------------------------------------------
// Datos que vienen de Supabase
// ---------------------------------------------------------------------
export type CanchaLocal = {
  id: string;
  nombre: string;
  deporte: string; // texto para la web: "Fútbol", "Vóley"...
  techada: boolean;
  minutosTurno: number;
  minMinutos: number;
  maxMinutos: number;
  precioDesde: number | null;
};

export type LocalPublico = {
  id: string;
  slug: string;
  nombre: string;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lat: number;
  lng: number;
  telefono: string | null;
  adelantoPct: number;
  minutosApartado: number;
  horasCancelacion: number;
  canchas: CanchaLocal[];
};

export type EstadoTurno = "libre" | "ocupado" | "pasado" | "cerrado";

export type Turno = {
  cancha: string;
  inicio: string; // ISO
  fin: string;
  estado: EstadoTurno;
  precio: number | null;
};

export type EstadoReserva =
  | "pending_payment"
  | "payment_review"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled"
  | "expired";

export type Reserva = {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  inicio: string;
  fin: string;
  total: number;
  adelanto: number;
  pagado: number;
  vence: string | null;
  cancha: string;
  deporte: string;
  local: string;
  slug: string;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  horasCancelacion: number;
  cancelable: boolean; // activa y todavía no empieza (lo decide la base)
};

// Lo que devuelve la base al reservar (y al pedir otra vez con la misma clave)
export type ReservaCreada = {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  inicio: string;
  fin: string;
  total: number;
  adelanto: number;
  vence: string | null;
};

export const ESTADO_TEXTO: Record<EstadoReserva, string> = {
  pending_payment: "Por pagar",
  payment_review: "Pago en revisión",
  confirmed: "Confirmada",
  completed: "Jugada",
  no_show: "No asistió",
  cancelled: "Cancelada",
  expired: "Vencida",
};

// Reserva que todavía ocupa el horario
export const esActiva = (e: EstadoReserva) => e === "pending_payment" || e === "payment_review" || e === "confirmed";

// ---------------------------------------------------------------------
// Conversión de filas de Supabase
// ---------------------------------------------------------------------
type Json = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));
const txt = (v: unknown) => (v == null ? null : String(v));

export function aLocal(j: Json): LocalPublico {
  const canchas = Array.isArray(j.canchas) ? (j.canchas as Json[]) : [];
  return {
    id: String(j.id),
    slug: String(j.slug),
    nombre: String(j.nombre),
    distrito: String(j.distrito),
    direccion: String(j.direccion ?? ""),
    referencia: txt(j.referencia),
    lat: Number(j.lat),
    lng: Number(j.lng),
    telefono: txt(j.telefono),
    adelantoPct: Number(j.adelanto_pct ?? 50),
    minutosApartado: Number(j.minutos_apartado ?? 15),
    horasCancelacion: Number(j.horas_cancelacion ?? 6),
    canchas: canchas.map((c) => ({
      id: String(c.id),
      nombre: String(c.nombre),
      deporte: deporteAWeb(String(c.deporte)) ?? "Multideporte",
      techada: Boolean(c.techada),
      minutosTurno: Number(c.minutos_turno ?? 60),
      minMinutos: Number(c.min_minutos ?? 60),
      maxMinutos: Number(c.max_minutos ?? 180),
      precioDesde: num(c.precio_desde),
    })),
  };
}

export function aTurno(f: Json): Turno {
  return {
    cancha: String(f.cancha_id),
    inicio: String(f.inicio),
    fin: String(f.fin),
    estado: String(f.estado) as EstadoTurno,
    precio: num(f.precio),
  };
}

export function aReserva(f: Json): Reserva {
  return {
    id: String(f.id),
    codigo: String(f.codigo),
    estado: String(f.estado) as EstadoReserva,
    inicio: String(f.inicio),
    fin: String(f.fin),
    total: Number(f.total),
    adelanto: Number(f.adelanto),
    pagado: Number(f.pagado ?? 0),
    vence: txt(f.vence),
    cancha: String(f.cancha),
    deporte: deporteAWeb(String(f.deporte)) ?? "Multideporte",
    local: String(f.local),
    slug: String(f.slug),
    distrito: String(f.distrito),
    direccion: String(f.direccion ?? ""),
    referencia: txt(f.referencia),
    lat: num(f.lat),
    lng: num(f.lng),
    telefono: txt(f.telefono),
    horasCancelacion: Number(f.horas_cancelacion ?? 6),
    cancelable: Boolean(f.cancelable),
  };
}

export function aReservaCreada(j: Json): ReservaCreada {
  return {
    id: String(j.id),
    codigo: String(j.codigo),
    estado: String(j.estado) as EstadoReserva,
    inicio: String(j.inicio),
    fin: String(j.fin),
    total: Number(j.total),
    adelanto: Number(j.adelanto),
    vence: txt(j.vence),
  };
}

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
