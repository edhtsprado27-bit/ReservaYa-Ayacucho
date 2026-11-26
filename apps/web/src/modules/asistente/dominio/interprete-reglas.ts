// Intérprete por reglas del asistente: entiende lo más común sin usar IA
// ("fútbol en Carmen Alto mañana a las 7 con duchas"), al instante y sin
// gastar el cupo diario de OpenRouter. Si no está seguro, lo dice
// (seguro = false) y el caso de uso le pregunta a la IA.
// Capa: dominio (funciones puras).

import type { DeporteWeb } from "@/modules/catalogo/dominio/cancha";
import { SERVICIOS } from "@/modules/catalogo/dominio/servicios";
import { esFechaValida, sumarDias } from "@/modules/reservas/dominio/tiempo";
import {
  completarFecha,
  cuandoTexto,
  hayFiltros,
  HORA_ABRE,
  limpiarHora,
  SIN_FILTROS,
  ULTIMA_HORA,
  ultimoDia,
  type Filtros,
  type Franja,
  type Interpretacion,
} from "./asistente";
import { buscarTema } from "./conocimiento";

export type ContextoReglas = {
  hoy: string; // AAAA-MM-DD en Ayacucho
  horaAhora: string; // HH:MM
  previos: Filtros;
  /** Nombres de los locales publicados (para reconocer "Los Andes") */
  locales: string[];
};

export type ResultadoReglas = Interpretacion & {
  /** Algo que conviene avisar: "Solo se puede reservar hasta el 5 de diciembre" */
  nota: string | null;
};

/** Sin tildes, en minúsculas, solo letras, números, ":" y "/" separados por un espacio */
export const prepararTexto = (t: string) =>
  " " +
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:/?¿]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() +
  " ";

// ---------------------------------------------------------------------
// Distrito, deporte, servicios, techo y precio
// ---------------------------------------------------------------------
const DISTRITOS: [RegExp, string][] = [
  [/\bcarmen alto\b/, "Carmen Alto"],
  [/\bsan juan( bautista)?\b|\bsjb\b/, "San Juan Bautista"],
  [/\b(jesus )?nazareno\b/, "Jesús Nazareno"],
  [/\b(andres )?avelino\b|\bcaceres\b/, "Andrés Avelino Cáceres D."],
  [/\b(centro|cercado|plaza( de armas)?)\b|\bdistrito de ayacucho\b|\bayacucho centro\b/, "Ayacucho"],
];
const CUALQUIER_DISTRITO = /\b(cualquier (distrito|lugar|sitio|parte|zona)|donde sea|todos los distritos|otro distrito)\b/;

const DEPORTES: [RegExp, DeporteWeb][] = [
  [/\b(futsal|futbol sala|futbol de salon|losa)\b/, "Futsal"],
  [/\b(voley|voleibol|volei|volley|voley ?ball)\b/, "Vóley"],
  [/\b(futbol|fulbito|futbito|pichanga|fut|f7|fulbo)\b/, "Fútbol"],
];

const CLAVES_SERVICIO: Record<string, RegExp> = {
  vestuarios: /\b(vestuarios?|camerinos?|cambiarme|cambiarse|cambiarnos)\b/,
  duchas: /\b(duchas?|banarme|banarse|banarnos)\b/,
  banos: /\b(banos?|sshh|servicios higienicos)\b/,
  estacionamiento: /\b(estacionamiento|estacionar|parqueo|cochera|parking|carro|auto|movilidad)\b/,
  cafeteria: /\b(cafeteria|kiosko|kiosco|quiosco|tienda|bebidas?|gaseosas?|snacks?|cafe)\b/,
  tribuna: /\b(tribunas?|graderias?|gradas)\b/,
  iluminacion: /\b(iluminacion|iluminad[ao]s?|luz|luces|reflectores?)\b/,
  balon_incluido: /\b(balon(es)?( incluido)?|pelota incluida|prestan (la )?pelota|incluye pelota)\b/,
};
const SIN = (re: RegExp) => new RegExp(`\\bsin ${re.source.replace(/^\\b/, "")}`);

const TECHADA_SI = /\b(techad[ao]s?|bajo techo|cubiert[ao]s?|con techo|si llueve|por la lluvia|lluvia)\b/;
const TECHADA_NO = /\b(al aire libre|sin techo|descubiert[ao]s?)\b/;
const PRECIO = /\b(?:menos de|hasta|maximo|max|no mas de|por debajo de|a lo mucho|tope)\s*(?:s\/?|s\/\.)?\s*(\d{1,3})\b/;

// ---------------------------------------------------------------------
// Fecha y hora
// ---------------------------------------------------------------------
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre|septiembre", "octubre", "noviembre", "diciembre"];
const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00-05:00`).getUTCDay();

/** Próximo día de la semana (hoy cuenta) */
function proximo(hoy: string, dia: number): string {
  return sumarDias(hoy, (dia - diaSemana(hoy) + 7) % 7);
}

const MANANA_HORARIO = /\b(de|en|por|a) la manana\b|\btemprano\b|\bmatutin/;

function leerFecha(t: string, hoy: string): { fecha: string | null; fuera: boolean } {
  const sinMananaHorario = t.replace(/\b(de|en|por|a) la manana\b/g, " ");
  if (/\bpasado manana\b/.test(t)) return { fecha: sumarDias(hoy, 2), fuera: false };
  if (/\bmanana\b/.test(sinMananaHorario)) return { fecha: sumarDias(hoy, 1), fuera: false };
  if (/\b(hoy|esta noche|esta tarde|ahorita|hoy dia)\b/.test(t)) return { fecha: hoy, fuera: false };
  if (/\b(fin de semana|finde)\b/.test(t)) {
    const d = diaSemana(hoy);
    return { fecha: d === 6 || d === 0 ? hoy : proximo(hoy, 6), fuera: false };
  }
  const dia = DIAS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  if (dia >= 0) return { fecha: proximo(hoy, dia), fuera: false };

  // "28/11", "28-11", "28 de noviembre", "el 28"
  const [anio, mesHoy, diaHoy] = hoy.split("-").map(Number);
  let d: number | null = null;
  let mes: number | null = null;
  const conMesNumero = /\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/.exec(t);
  const conMesNombre = new RegExp(`\\b(\\d{1,2}) de (${MESES.join("|")})\\b`).exec(t);
  const soloDia = /\b(?:el|dia) (\d{1,2})\b(?! ?(:|de la|horas|hrs|h\b|am|pm|soles))/.exec(t);
  if (conMesNumero) [d, mes] = [Number(conMesNumero[1]), Number(conMesNumero[2])];
  else if (conMesNombre) [d, mes] = [Number(conMesNombre[1]), MESES.findIndex((m) => new RegExp(`^(${m})$`).test(conMesNombre[2])) + 1];
  else if (soloDia) [d, mes] = [Number(soloDia[1]), Number(soloDia[1]) >= diaHoy ? mesHoy : mesHoy + 1];
  if (d === null || mes === null || mes < 1 || mes > 13 || d < 1 || d > 31) return { fecha: null, fuera: false };

  const aMes = mes === 13 ? 1 : mes;
  let fecha = `${mes === 13 ? anio + 1 : anio}-${String(aMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (fecha < hoy) fecha = `${anio + 1}-${String(aMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`; // enero del próximo año
  if (!esFechaValida(fecha)) return { fecha: null, fuera: false };
  if (fecha > ultimoDia(hoy)) return { fecha: null, fuera: true };
  return { fecha, fuera: false };
}

/** "a las 7", "7pm", "19:00", "7 y media de la noche", "mediodía" -> "19:00" */
function leerHora(t: string): { hora: string | null; fuera: boolean } {
  if (/\bmedio ?dia\b/.test(t)) return { hora: "12:00", fuera: false };
  const re =
    /(\b(?:a las|las|a la|desde las|para las|tipo|eso de las?|como a las)\s+(\d{1,2})(?::(\d{2}))?(\s*y media)?(\s*(?:am|a m|pm|p m|hrs|horas|h)\b)?)|(\b(\d{1,2}):(\d{2})\b)|(\b(\d{1,2})\s*(am|pm|a m|p m|hrs|h)\b)/;
  const m = re.exec(t);
  if (!m) return { hora: null, fuera: false };
  let h = Number(m[2] ?? m[7] ?? m[10]);
  let min = Number(m[3] ?? m[8] ?? 0);
  if (m[4]) min = 30;
  const sufijo = (m[5] ?? m[11] ?? "").replace(/\s/g, "");
  const despues = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20);
  const tarde = sufijo === "pm" || /^\s*(de la|en la|por la) (tarde|noche)\b/.test(despues);
  const temprano = sufijo === "am" || /^\s*(de la|en la|por la) manana\b/.test(despues);
  const conHoras24 = sufijo === "hrs" || sufijo === "h" || sufijo === "horas";
  if (h > 24 || min > 59) return { hora: null, fuera: false };
  if (tarde && h < 12) h += 12;
  else if (!temprano && !conHoras24 && h >= 1 && h <= 10) h += 12; // "a las 7" de un partido: 19:00
  const hora = limpiarHora(`${h}:${String(min).padStart(2, "0")}`);
  return { hora, fuera: hora === null };
}

function leerFranja(t: string): Franja | null {
  if (/\b(en la|de|por la|esta|de la) noche\b|\bnocturn/.test(t)) return "noche";
  if (/\b(en la|por la|esta|de la) tarde\b/.test(t)) return "tarde";
  if (MANANA_HORARIO.test(t)) return "manana";
  return null;
}

/** "más tarde" / "una hora más tarde" / "más temprano" respecto a la hora anterior */
function moverHora(t: string, previa: string | null): string | null {
  if (!previa) return null;
  const [h, m] = previa.split(":");
  if (/\b(una hora )?mas tarde\b|\bdespues\b/.test(t)) return limpiarHora(`${Number(h) + 1}:${m}`);
  if (/\b(una hora )?mas temprano\b|\bantes\b/.test(t)) return limpiarHora(`${Number(h) - 1}:${m}`);
  return null;
}

/** "Los Andes" -> "Complejo Los Andes" (palabras distintivas del nombre) */
const COMUNES = new Set(["complejo", "cancha", "canchas", "deportivo", "deportiva", "club", "la", "el", "los", "las", "de", "del", "y", "sintetica", "sinteticas", "grass", "local"]);
export function reconocerLocal(t: string, locales: string[]): string | null {
  for (const nombre of locales) {
    const palabras = prepararTexto(nombre).trim().split(" ").filter((p) => p.length >= 4 && !COMUNES.has(p));
    if (palabras.length && palabras.every((p) => new RegExp(`\\b${p}\\b`).test(t))) return nombre;
  }
  return null;
}

// ---------------------------------------------------------------------
// Interpretación
// ---------------------------------------------------------------------
const PREGUNTA = /[?¿]|^\s*(como|que|cuanto|cuanta|cuantos|cuantas|puedo|se puede|donde|cuando|por que|porque|hay que|debo|tengo que|es posible|necesito)\b/;
const SALUDO = /^\s*(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos)\b/;
const GRACIAS = /\b(gracias|grax|muchas gracias|genial|perfecto|listo|ok|okey|vale)\b/;
const QUIERE_JUGAR = /\b(cancha|canchas|jugar|juego|partido|pichanga|reservar|reserva|libre|libres|disponible|disponibles|busco|buscar|quiero|necesito|hay|recomienda|recomiendas|recomendacion|cerca|barat)/;

export function interpretarConReglas(mensaje: string, ctx: ContextoReglas): ResultadoReglas {
  const t = prepararTexto(mensaje);
  const palabras = t.trim().split(" ").filter(Boolean).length;
  let nota: string | null = null;

  // Lo que dice este mensaje
  const nuevos: Filtros = { ...SIN_FILTROS, servicios: [] };
  nuevos.distrito = DISTRITOS.find(([re]) => re.test(t))?.[1] ?? null;
  nuevos.deporte = DEPORTES.find(([re]) => re.test(t))?.[1] ?? null;
  const quitar: string[] = SERVICIOS.filter((s) => SIN(CLAVES_SERVICIO[s.codigo]).test(t)).map((s) => s.codigo);
  nuevos.servicios = SERVICIOS.filter((s) => CLAVES_SERVICIO[s.codigo].test(t) && !quitar.includes(s.codigo)).map((s) => s.codigo);
  nuevos.techada = TECHADA_NO.test(t) ? false : TECHADA_SI.test(t) ? true : null;
  const precio = PRECIO.exec(t);
  nuevos.precioMax = precio ? Number(precio[1]) || null : null;
  nuevos.nombre = reconocerLocal(t, ctx.locales);

  const { fecha, fuera: fechaFuera } = leerFecha(t, ctx.hoy);
  nuevos.fecha = fecha;
  if (fechaFuera) nota = `Solo se puede reservar hasta ${cuandoTexto(ultimoDia(ctx.hoy), ctx.hoy)}.`;
  const { hora, fuera: horaFuera } = leerHora(t);
  nuevos.hora = hora ?? moverHora(t, ctx.previos.hora);
  if (horaFuera) nota = `Las canchas atienden de ${String(HORA_ABRE).padStart(2, "0")}:00 a 23:00 (último turno a las ${ULTIMA_HORA}:00).`;
  nuevos.franja = nuevos.hora ? null : leerFranja(t);

  const propios = [nuevos.distrito, nuevos.deporte, nuevos.fecha, nuevos.hora, nuevos.franja, nuevos.techada, nuevos.precioMax, nuevos.nombre]
    .filter((v) => v !== null).length + nuevos.servicios.length;

  // ¿Búsqueda nueva o seguimiento? Si dice QUÉ busca (deporte, distrito, local o
  // servicios) con 2 o más datos, es nueva. "¿Y a las 8?" o "el sábado a las 8"
  // solo cambian el CUÁNDO: se conserva lo anterior.
  const cambiaQue = Boolean(nuevos.deporte || nuevos.distrito || nuevos.nombre || nuevos.servicios.length);
  let filtros: Filtros;
  if (cambiaQue && propios >= 2 && !/^\s*(y|tambien|ahora|mejor|entonces|pero)\b/.test(t)) {
    filtros = nuevos;
  } else {
    const p = ctx.previos;
    const servicios = [...p.servicios.filter((s) => !quitar.includes(s)), ...nuevos.servicios];
    filtros = {
      distrito: nuevos.distrito ?? p.distrito,
      deporte: nuevos.deporte ?? p.deporte,
      fecha: nuevos.fecha ?? p.fecha,
      hora: nuevos.hora ?? (nuevos.franja ? null : p.hora),
      franja: nuevos.hora ? null : (nuevos.franja ?? p.franja),
      servicios: SERVICIOS.filter((s) => servicios.includes(s.codigo)).map((s) => s.codigo),
      techada: nuevos.techada ?? p.techada,
      precioMax: nuevos.precioMax ?? p.precioMax,
      nombre: nuevos.nombre ?? p.nombre,
    };
  }
  if (CUALQUIER_DISTRITO.test(t)) filtros.distrito = null;
  filtros = completarFecha(filtros, ctx.hoy, ctx.horaAhora);

  const tema = buscarTema(t);
  const esPregunta = PREGUNTA.test(t);
  const base = { filtros, nota };

  // Saludos y agradecimientos cortos
  if (propios === 0 && palabras <= 4 && SALUDO.test(t)) return { ...base, intencion: "saludo", respuesta: null, seguro: true };
  if (propios === 0 && palabras <= 4 && GRACIAS.test(t)) {
    return { ...base, intencion: "saludo", respuesta: "¡De nada! Si quieres buscar otra cancha, dime el día y la hora.", seguro: true };
  }

  // Dudas: pregunta (o mensaje sin filtros) sobre un tema conocido. "¿Cuánto
  // cuesta en Los Andes?" no es duda: se muestra el local con su precio.
  const precioDeUnLocal = tema?.temas.some((x) => x.tema === "precios") && Boolean(filtros.nombre || filtros.distrito);
  if (tema && (esPregunta || propios === 0) && !precioDeUnLocal) {
    const empate = tema.temas.length > 1;
    return {
      ...base,
      intencion: "duda",
      respuesta: tema.temas.slice(0, 2).map((x) => x.respuesta).join(" "),
      seguro: !empate && (tema.puntos >= 2 || (esPregunta && palabras <= 5)),
    };
  }

  // Búsquedas ("sin duchas" o "en cualquier distrito" ajustan la anterior)
  const ajusta = quitar.length > 0 || CUALQUIER_DISTRITO.test(t) || fechaFuera;
  if (propios > 0 || ajusta || (QUIERE_JUGAR.test(t) && hayFiltros(filtros))) {
    return { ...base, intencion: "buscar", respuesta: null, seguro: (propios > 0 || ajusta) && !(esPregunta && !tema && palabras > 14) };
  }
  if (QUIERE_JUGAR.test(t)) return { ...base, intencion: "buscar", respuesta: null, seguro: palabras <= 6 };

  return { ...base, intencion: "otro", respuesta: null, seguro: false };
}
