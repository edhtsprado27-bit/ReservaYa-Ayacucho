// Configuración de un local (panel del dueño) y su vista para el administrador.
// Capa: dominio. Tipos y funciones puras: se usan en el navegador y en el servidor.

export type EstadoLocal = "draft" | "pending_review" | "approved" | "rejected" | "suspended";

export const ESTADO_LOCAL_TEXTO: Record<EstadoLocal, string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  approved: "Publicado",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

/** Deportes que ofrece la web (código de la base -> texto) */
export const DEPORTES = [
  { codigo: "futbol", nombre: "Fútbol" },
  { codigo: "futsal", nombre: "Futsal" },
  { codigo: "voley", nombre: "Vóley" },
] as const;
export type CodigoDeporte = (typeof DEPORTES)[number]["codigo"];
export const esDeporte = (x: unknown): x is CodigoDeporte => DEPORTES.some((d) => d.codigo === x);
export const nombreDeporte = (codigo: string) => DEPORTES.find((d) => d.codigo === codigo)?.nombre ?? "Multideporte";

/** Días de la semana en el orden de Perú (lunes primero). dia: 0 = domingo, como en PostgreSQL */
export const DIAS = [
  { dia: 1, nombre: "Lunes", corto: "Lun" },
  { dia: 2, nombre: "Martes", corto: "Mar" },
  { dia: 3, nombre: "Miércoles", corto: "Mié" },
  { dia: 4, nombre: "Jueves", corto: "Jue" },
  { dia: 5, nombre: "Viernes", corto: "Vie" },
  { dia: 6, nombre: "Sábado", corto: "Sáb" },
  { dia: 0, nombre: "Domingo", corto: "Dom" },
] as const;

export type DiaHorario = { dia: number; abre: string; cierra: string };

export type CanchaConfig = {
  id: string;
  nombre: string;
  deporte: string;
  techada: boolean;
  minutosTurno: number;
  maxMinutos: number;
  horario: DiaHorario[];
  precio: number | null;
  precioPunta: number | null;
  puntaDesde: string | null;
  reservasFuturas: number;
};

export type AjustesLocal = {
  id: string;
  nombre: string;
  slug: string;
  distrito: string;
  estado: EstadoLocal;
  motivoEstado: string | null;
  direccion: string;
  referencia: string | null;
  whatsapp: string | null;
  adelantoPct: number;
  minutosApartado: number;
  horasCancelacion: number;
};

export type ConfigLocal = { local: AjustesLocal; canchas: CanchaConfig[] };

/** Fila de la lista del administrador */
export type LocalAdmin = {
  id: string;
  nombre: string;
  slug: string;
  distrito: string;
  estado: EstadoLocal;
  motivo: string | null;
  sinDueno: boolean;
  duenoNombre: string | null;
  duenoCorreo: string | null;
  canchas: number;
  reservasFuturas: number;
};

// Opciones de los formularios (las mismas reglas que valida la base)
export const OPCIONES_APARTADO = [10, 15, 20, 30, 45, 60];
export const OPCIONES_CANCELACION = [0, 2, 3, 6, 12, 24, 48, 72];
export const OPCIONES_ADELANTO = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

const HORA = /^([01]\d|2[0-3]):(00|30)$|^24:00$/;
/** "HH:MM" en punto o y media, de 00:00 a 24:00 */
export const esHoraMedia = (h: unknown): h is string => typeof h === "string" && HORA.test(h);

const aMinutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const aHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Horas para los selectores: de `desde` a `hasta`, cada 30 minutos */
export function horasEntre(desde = "00:00", hasta = "24:00", paso = 30): string[] {
  const lista: string[] = [];
  for (let m = aMinutos(desde); m <= aMinutos(hasta); m += paso) lista.push(aHora(m));
  return lista;
}

/** ¿El horario de un día es válido? (abre antes que cierra, al menos un turno) */
export const diaValido = (d: DiaHorario, minutosTurno = 60) =>
  esHoraMedia(d.abre) && esHoraMedia(d.cierra) && aMinutos(d.cierra) - aMinutos(d.abre) >= minutosTurno;

/**
 * Resumen corto del horario, agrupando días seguidos con las mismas horas:
 * "Lun a Sáb 07:00–22:00 · Dom cerrado"
 */
export function resumenHorario(horario: DiaHorario[]): string {
  const de = (dia: number) => horario.find((h) => h.dia === dia);
  const grupos: { desde: string; hasta: string; texto: string }[] = [];
  for (const { dia, corto } of DIAS) {
    const h = de(dia);
    const texto = h ? `${h.abre}–${h.cierra}` : "cerrado";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.hasta = corto;
    else grupos.push({ desde: corto, hasta: corto, texto });
  }
  if (grupos.length === 1 && grupos[0].texto !== "cerrado") return `Todos los días ${grupos[0].texto}`;
  return grupos
    .map((g) => `${g.desde === g.hasta ? g.desde : `${g.desde} a ${g.hasta}`} ${g.texto}`)
    .join(" · ");
}

/** Duraciones máximas de una reserva para una cancha (de un turno a 4 horas) */
export function opcionesDuracion(minutosTurno: number): number[] {
  const lista: number[] = [];
  for (let m = minutosTurno; m <= 240; m += minutosTurno) lista.push(m);
  return lista;
}
