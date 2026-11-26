// Asistente de canchas (RF09, HU08): tipos, validación de lo que llega del
// navegador y de lo que responde la IA, y textos para la pantalla.
// Capa: dominio (funciones puras; se usan en el servidor y en las pruebas).
//
// Regla principal: la IA solo INTERPRETA lo que pide la persona (filtros).
// Los locales, precios y horarios siempre salen de la base de datos.

import { DISTRITOS_WEB, deporteABD, deporteAWeb, normalizar, type DeporteWeb } from "@/modules/catalogo/dominio/cancha";
import { nombreServicio, ordenarServicios } from "@/modules/catalogo/dominio/servicios";
import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { DIAS_RESERVABLES } from "@/modules/reservas/dominio/reserva";
import { esFechaValida, sumarDias } from "@/modules/reservas/dominio/tiempo";

export type Franja = "manana" | "tarde" | "noche";

export type Filtros = {
  distrito: string | null;
  deporte: DeporteWeb | null;
  fecha: string | null; // AAAA-MM-DD
  hora: string | null; // HH:MM (24 h)
  franja: Franja | null;
  servicios: string[];
  techada: boolean | null;
  precioMax: number | null;
  nombre: string | null; // nombre (o parte) del local
};

export const SIN_FILTROS: Filtros = {
  distrito: null,
  deporte: null,
  fecha: null,
  hora: null,
  franja: null,
  servicios: [],
  techada: null,
  precioMax: null,
  nombre: null,
};

export type Intencion = "buscar" | "duda" | "saludo" | "otro";

export type Interpretacion = {
  intencion: Intencion;
  filtros: Filtros;
  /** Texto para responder una duda (de la IA o de las preguntas frecuentes) */
  respuesta: string | null;
  /** false = las reglas no entendieron bien: conviene preguntarle a la IA */
  seguro: boolean;
};

export type MensajeHistorial = { rol: "persona" | "asistente"; texto: string };

export type PedidoAsistente = { mensaje: string; filtros: Filtros; historial: MensajeHistorial[] };

export type HoraLibre = { hora: string; hasta: string; cancha: string; precio: number | null; enlace: string };

export type Recomendacion = {
  slug: string;
  nombre: string;
  distrito: string;
  precioDesde: number | null;
  servicios: string[];
  deportes: string[];
  /** Ficha del local (con el día elegido, si hay) */
  enlace: string;
  /** Horas libres con su enlace directo a la grilla (hasta 4) */
  horas: HoraLibre[];
  /** true si tiene libre justo la hora pedida */
  exacta: boolean;
};

export type RespuestaAsistente = {
  texto: string;
  /** "ia" = la IA interpretó el mensaje; "reglas" = lo entendió el sistema solo */
  modo: "reglas" | "ia";
  aviso: string | null;
  /** Filtros para el siguiente mensaje (así se puede decir "¿y a las 8?") */
  filtros: Filtros;
  /** Lo que se entendió, en chips: "Fútbol", "Carmen Alto", "sáb 28 nov"... */
  entendido: string[];
  recomendaciones: Recomendacion[];
  sugerencias: string[];
};

// ---------------------------------------------------------------------
// Límites
// ---------------------------------------------------------------------
export const MAX_MENSAJE = 500;
export const MAX_HISTORIAL = 6;
export const HORA_ABRE = 6; // la grilla va de 06:00 a 23:00
export const ULTIMA_HORA = 22;

export const datosAsistenteInvalidos = () =>
  new ErrorAplicacion("DATOS_INVALIDOS_ASISTENTE", 400, `Escribe tu pregunta (hasta ${MAX_MENSAJE} letras).`);

const objeto = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Último día que se puede reservar */
export const ultimoDia = (hoy: string) => sumarDias(hoy, DIAS_RESERVABLES - 1);

// ---------------------------------------------------------------------
// Normalizadores (los usan las reglas, la IA y el navegador)
// ---------------------------------------------------------------------
const ALIAS_DISTRITO: [RegExp, string][] = [
  [/carmenalto/, "Carmen Alto"],
  [/sanjuan|^sjb$/, "San Juan Bautista"],
  [/nazareno/, "Jesús Nazareno"],
  [/caceres|avelino|andresavelino/, "Andrés Avelino Cáceres D."],
  [/^ayacucho|centro|cercado|plazadearmas/, "Ayacucho"],
];

/** "carmen alto", "Cáceres", "centro" -> nombre del distrito activo (o null) */
export function buscarDistrito(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = normalizar(v);
  const exacto = DISTRITOS_WEB.find((d) => normalizar(d) === n);
  if (exacto) return exacto;
  return ALIAS_DISTRITO.find(([re]) => re.test(n))?.[1] ?? null;
}

/** "19:00", "7:30", "19" -> "19:00" / "07:30" (solo de 06:00 a 22:30, en medias horas) */
export function limpiarHora(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h < HORA_ABRE || h > ULTIMA_HORA || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${min >= 30 ? "30" : "00"}`;
}

const FRANJAS: Franja[] = ["manana", "tarde", "noche"];

/** Filtros de cualquier origen (IA o navegador) -> filtros válidos */
export function limpiarFiltros(x: unknown, hoy: string): Filtros {
  const o = objeto(x);
  const fecha = typeof o.fecha === "string" && esFechaValida(o.fecha) && o.fecha >= hoy && o.fecha <= ultimoDia(hoy) ? o.fecha : null;
  const deporte = typeof o.deporte === "string" ? deporteAWeb(deporteABD(o.deporte) ?? "") : null;
  const precio = Number(o.precioMax ?? o.precio_max);
  const nombre = texto(o.nombre, 60);
  return {
    distrito: buscarDistrito(o.distrito),
    deporte,
    fecha,
    hora: limpiarHora(o.hora),
    franja: FRANJAS.includes(o.franja as Franja) ? (o.franja as Franja) : null,
    servicios: ordenarServicios(Array.isArray(o.servicios) ? o.servicios : []),
    techada: typeof o.techada === "boolean" ? o.techada : null,
    precioMax: Number.isFinite(precio) && precio >= 1 && precio <= 1000 ? Math.round(precio) : null,
    nombre: nombre.length >= 3 ? nombre : null,
  };
}

/** Cuerpo de POST /api/asistente */
export function validarPedidoAsistente(x: unknown, hoy: string): PedidoAsistente {
  const o = objeto(x);
  const mensaje = texto(o.mensaje, MAX_MENSAJE + 1);
  if (!mensaje || mensaje.length > MAX_MENSAJE) throw datosAsistenteInvalidos();
  const historial = (Array.isArray(o.historial) ? o.historial : [])
    .slice(-MAX_HISTORIAL)
    .map((m) => objeto(m))
    .filter((m) => (m.rol === "persona" || m.rol === "asistente") && texto(m.texto, MAX_MENSAJE))
    .map((m) => ({ rol: m.rol as MensajeHistorial["rol"], texto: texto(m.texto, MAX_MENSAJE) }));
  return { mensaje, filtros: limpiarFiltros(o.filtros, hoy), historial };
}

const INTENCIONES: Intencion[] = ["buscar", "duda", "saludo", "otro"];

/** Lo que respondió la IA -> interpretación válida (o null si no sirve) */
export function validarInterpretacionIA(x: unknown, hoy: string): Interpretacion | null {
  const o = objeto(x);
  if (!INTENCIONES.includes(o.intencion as Intencion)) return null;
  const respuesta = texto(o.respuesta, 600) || null;
  const intencion = o.intencion as Intencion;
  if ((intencion === "duda" || intencion === "otro") && !respuesta) return null;
  return { intencion, filtros: limpiarFiltros(o.filtros, hoy), respuesta, seguro: true };
}

// ---------------------------------------------------------------------
// Textos para la pantalla
// ---------------------------------------------------------------------
const fmtCorta = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "short", day: "numeric", month: "short" });
const fmtLarga = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" });
const mediodia = (fecha: string) => new Date(`${fecha}T12:00:00-05:00`);

/** "2026-11-28" -> "sáb 28 nov" */
export const fechaCorta = (fecha: string) => fmtCorta.format(mediodia(fecha)).replace(/\./g, "").replace(/,/g, "");

/** "hoy", "mañana" o "el sábado 28 de noviembre" */
export function cuandoTexto(fecha: string, hoy: string): string {
  if (fecha === hoy) return "hoy";
  if (fecha === sumarDias(hoy, 1)) return "mañana";
  return `el ${fmtLarga.format(mediodia(fecha)).replace(",", "")}`;
}

export const FRANJA_TEXTO: Record<Franja, string> = { manana: "en la mañana", tarde: "en la tarde", noche: "en la noche" };
/** Horas (inicio) de cada franja */
export const FRANJA_HORAS: Record<Franja, [number, number]> = { manana: [6, 11], tarde: [12, 17], noche: [18, 22] };

/** Chips de "Entendí: ..." */
export function entendido(f: Filtros): string[] {
  const chips: string[] = [];
  if (f.nombre) chips.push(f.nombre);
  if (f.deporte) chips.push(f.deporte);
  if (f.distrito) chips.push(f.distrito);
  if (f.fecha) chips.push(fechaCorta(f.fecha));
  if (f.hora) chips.push(f.hora);
  else if (f.franja) chips.push(FRANJA_TEXTO[f.franja].replace("en la ", ""));
  chips.push(...f.servicios.map(nombreServicio));
  if (f.techada) chips.push("Techada");
  if (f.precioMax) chips.push(`Hasta S/ ${f.precioMax}`);
  return chips;
}

const DEPORTE_PLURAL: Record<DeporteWeb, string> = { Fútbol: "fútbol", Futsal: "futsal", Vóley: "vóley" };

/** "canchas de fútbol en Carmen Alto con duchas y vestuarios" */
export function describirBusqueda(f: Filtros): string {
  let d = f.deporte ? `canchas de ${DEPORTE_PLURAL[f.deporte]}` : "canchas";
  if (f.techada) d += " techadas";
  if (f.nombre) d += ` en «${f.nombre}»`;
  if (f.distrito) d += ` en ${f.distrito}`;
  if (f.servicios.length) {
    const s = f.servicios.map((c) => nombreServicio(c).toLowerCase());
    d += ` con ${s.length > 1 ? `${s.slice(0, -1).join(", ")} y ${s.at(-1)}` : s[0]}`;
  }
  if (f.precioMax) d += ` de hasta S/ ${f.precioMax} la hora`;
  return d;
}

/** Una hora sin día: hoy si todavía no pasó, si no mañana. Una franja sin día: hoy. */
export function completarFecha(f: Filtros, hoy: string, horaAhora: string): Filtros {
  if (f.fecha) return f;
  if (f.hora) return { ...f, fecha: f.hora > horaAhora ? hoy : sumarDias(hoy, 1) };
  if (f.franja) return { ...f, fecha: hoy };
  return f;
}

export const hayFiltros = (f: Filtros) =>
  Boolean(f.distrito || f.deporte || f.fecha || f.hora || f.franja || f.servicios.length || f.techada !== null || f.precioMax || f.nombre);
