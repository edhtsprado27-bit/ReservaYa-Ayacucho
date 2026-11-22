// Validación de lo que llega del navegador para configurar un local y para
// las acciones del administrador. Funciones puras: si algo no tiene la forma
// esperada, error 400 claro. Los rangos y permisos los vuelve a revisar la base.

import { esServicio, ordenarServicios, type CodigoServicio } from "@/modules/catalogo/dominio/servicios";
import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { esDeporte, esHoraMedia, type CodigoDeporte, type DiaHorario } from "./configuracion";

export const datosLocalInvalidos = () =>
  new ErrorAplicacion("DATOS_INVALIDOS_LOCAL", 400, "Los datos enviados no son válidos. Revisa el formulario.");

export type PedidoAjustes = {
  direccion: string;
  referencia: string | null;
  whatsapp: string | null;
  adelantoPct: number;
  minutosApartado: number;
  horasCancelacion: number;
};

export type PedidoCancha = {
  nombre: string;
  deporte: CodigoDeporte;
  techada: boolean;
  maxMinutos: number;
  horario: DiaHorario[];
  precio: number;
  precioPunta: number | null;
  puntaDesde: string | null;
};

export type PedidoNuevaCancha = { nombre: string; deporte: CodigoDeporte; precio: number };

export type PedidoAdmin =
  | { accion: "asignar_dueno"; correo: string }
  | { accion: "suspender"; motivo: string }
  | { accion: "reactivar" };

type Obj = Record<string, unknown>;
const comoObjeto = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const textoOpcional = (v: unknown, max: number) => texto(v, max) || null;
const entero = (v: unknown) => {
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) throw datosLocalInvalidos();
  return n;
};
const soles = (v: unknown) => {
  const n = typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 100_000) throw datosLocalInvalidos();
  return Math.round(n * 100) / 100;
};
const deporte = (v: unknown): CodigoDeporte => {
  if (!esDeporte(v)) throw datosLocalInvalidos();
  return v;
};

export function validarAjustes(x: unknown): PedidoAjustes {
  const o = comoObjeto(x);
  return {
    direccion: texto(o.direccion, 200),
    referencia: textoOpcional(o.referencia, 200),
    whatsapp: textoOpcional(o.whatsapp, 20),
    adelantoPct: entero(o.adelantoPct),
    minutosApartado: entero(o.minutosApartado),
    horasCancelacion: entero(o.horasCancelacion),
  };
}

function horario(v: unknown): DiaHorario[] {
  if (!Array.isArray(v) || v.length > 7) throw datosLocalInvalidos();
  return v.map((d) => {
    const o = comoObjeto(d);
    const dia = entero(o.dia);
    if (dia < 0 || dia > 6 || !esHoraMedia(o.abre) || !esHoraMedia(o.cierra)) throw datosLocalInvalidos();
    return { dia, abre: o.abre, cierra: o.cierra };
  });
}

export function validarCancha(x: unknown): PedidoCancha {
  const o = comoObjeto(x);
  const conPunta = o.precioPunta !== undefined && o.precioPunta !== null && o.precioPunta !== "";
  if (conPunta && !esHoraMedia(o.puntaDesde)) throw datosLocalInvalidos();
  return {
    nombre: texto(o.nombre, 60),
    deporte: deporte(o.deporte),
    techada: o.techada === true,
    maxMinutos: entero(o.maxMinutos),
    horario: horario(o.horario),
    precio: soles(o.precio),
    precioPunta: conPunta ? soles(o.precioPunta) : null,
    puntaDesde: conPunta ? (o.puntaDesde as string) : null,
  };
}

export function validarNuevaCancha(x: unknown): PedidoNuevaCancha {
  const o = comoObjeto(x);
  return { nombre: texto(o.nombre, 60), deporte: deporte(o.deporte), precio: soles(o.precio) };
}

/**
 * Servicios del local: { "servicios": ["vestuarios", "duchas"] }.
 * Lista vacía = el local no ofrece ninguno. Un código desconocido es un error
 * (no se ignora en silencio).
 */
export function validarServicios(x: unknown): CodigoServicio[] {
  const lista = comoObjeto(x).servicios;
  if (!Array.isArray(lista) || lista.length > 20) throw datosLocalInvalidos();
  const codigos = lista.map((s) => (typeof s === "string" ? s.trim().toLowerCase() : s));
  if (!codigos.every(esServicio)) {
    throw new ErrorAplicacion("SERVICIO_INVALIDO", 400, "Uno de los servicios no está en la lista. Recarga la página.");
  }
  return ordenarServicios(codigos);
}

export function validarPedidoAdmin(x: unknown): PedidoAdmin {
  const o = comoObjeto(x);
  switch (o.accion) {
    case "asignar_dueno": {
      const correo = texto(o.correo, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new ErrorAplicacion("CORREO_INVALIDO", 400, "Escribe un correo válido, por ejemplo nombre@gmail.com.");
      }
      return { accion: "asignar_dueno", correo };
    }
    case "suspender":
      return { accion: "suspender", motivo: texto(o.motivo, 300) };
    case "reactivar":
      return { accion: "reactivar" };
    default:
      throw datosLocalInvalidos();
  }
}
