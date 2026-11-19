// Reglas para aceptar los datos de una cancha nueva antes de enviarlos a la base.
// Capa: dominio (funciones puras: se prueban con pruebas unitarias).

import { crearError } from "@/modules/compartido/dominio/error-aplicacion";
import { esUUID } from "@/modules/compartido/dominio/validaciones";
import type { NuevaCancha } from "./cancha";

export function validarNuevaCancha(x: unknown): NuevaCancha {
  const o = (x ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const numero = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  };

  const nombre = texto(o.nombre);
  const distrito = texto(o.distrito);
  const lat = numero(o.lat);
  const lng = numero(o.lng);
  if (!nombre || !distrito || lat === undefined || lng === undefined) throw crearError("DATOS_INVALIDOS");

  const precio = numero(o.precioDesde);
  return {
    nombre,
    distrito,
    lat,
    lng,
    direccion: texto(o.direccion),
    referencia: texto(o.referencia),
    deportes: Array.isArray(o.deportes)
      ? (o.deportes.filter((d) => typeof d === "string") as NuevaCancha["deportes"])
      : undefined,
    techada: o.techada === true,
    precioDesde: precio && precio > 0 ? precio : undefined,
    telefono: texto(o.telefono),
  };
}

/** Id de una cancha en revisión (si no es un UUID, no existe) */
export function validarId(id: string): string {
  if (!esUUID(id)) throw crearError("PROPUESTA_NO_ENCONTRADA");
  return id;
}
