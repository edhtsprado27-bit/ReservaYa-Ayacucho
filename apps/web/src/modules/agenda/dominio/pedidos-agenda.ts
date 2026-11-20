// Validación de lo que llega del navegador para la agenda del dueño.
// Funciones puras: si algo no tiene la forma esperada, error 400 claro.
// Las reglas de negocio (horario, choques, dueño del local) las decide la base.

import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { esUUID } from "@/modules/compartido/dominio/validaciones";
import type { AccionReserva } from "./agenda";

export const datosAgendaInvalidos = () =>
  new ErrorAplicacion("DATOS_INVALIDOS_AGENDA", 400, "Los datos enviados no son válidos. Revisa el formulario.");

export type PedidoReservaManual = {
  canchaId: string;
  inicio: string;
  fin: string;
  nombre: string;
  telefono: string | null;
  pagado: number;
  nota: string | null;
};

export type PedidoBloqueo = { canchaId: string; inicio: string; fin: string; motivo: string | null };

export type PedidoAccion = { accion: AccionReserva; motivo: string | null; monto: number | null };

type Obj = Record<string, unknown>;
const comoObjeto = (x: unknown): Obj => (x && typeof x === "object" ? (x as Obj) : {});
const fechaISO = (v: unknown) => {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw datosAgendaInvalidos();
  return new Date(v).toISOString();
};
const textoOpcional = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown) => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100_000) throw datosAgendaInvalidos();
  return Math.round(n * 100) / 100;
};

function rango(o: Obj) {
  const canchaId = String(o.canchaId ?? "");
  if (!esUUID(canchaId)) throw datosAgendaInvalidos();
  const inicio = fechaISO(o.inicio);
  const fin = fechaISO(o.fin);
  if (Date.parse(fin) <= Date.parse(inicio)) throw datosAgendaInvalidos();
  return { canchaId, inicio, fin };
}

export function validarReservaManual(x: unknown): PedidoReservaManual {
  const o = comoObjeto(x);
  const nombre = typeof o.nombre === "string" ? o.nombre.trim().slice(0, 120) : "";
  return {
    ...rango(o),
    nombre,
    telefono: textoOpcional(o.telefono, 20),
    pagado: numero(o.pagado) ?? 0,
    nota: textoOpcional(o.nota, 300),
  };
}

export function validarBloqueo(x: unknown): PedidoBloqueo {
  const o = comoObjeto(x);
  return { ...rango(o), motivo: textoOpcional(o.motivo, 120) };
}

const ACCIONES: AccionReserva[] = ["cobrar", "jugo", "no_vino", "cancelar"];

export function validarAccion(x: unknown): PedidoAccion {
  const o = comoObjeto(x);
  if (!ACCIONES.includes(o.accion as AccionReserva)) throw datosAgendaInvalidos();
  return { accion: o.accion as AccionReserva, motivo: textoOpcional(o.motivo, 200), monto: numero(o.monto) };
}

/** Id de un bloqueo (número entero positivo) */
export function validarIdBloqueo(id: string): number {
  if (!/^\d{1,15}$/.test(id) || Number(id) < 1) throw datosAgendaInvalidos();
  return Number(id);
}
