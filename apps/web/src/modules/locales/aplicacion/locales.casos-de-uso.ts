// Casos de uso de la gestión de locales. Capa: aplicación.
// Validan la forma de los datos y delegan en el repositorio, que reciben como
// parámetro (inversión de dependencias). La base decide si quien pide es el
// dueño del local o el admin, y revisa los rangos permitidos.

import { esUUID } from "@/modules/compartido/dominio/validaciones";
import type { LocalesRepositorio } from "../dominio/locales.repositorio";
import {
  datosLocalInvalidos,
  validarAjustes,
  validarCancha,
  validarNuevaCancha,
  validarPedidoAdmin,
  validarServicios,
} from "../dominio/pedidos-locales";

const id = (x: string) => {
  if (!esUUID(x)) throw datosLocalInvalidos();
  return x;
};

/** Locales que el dueño puede configurar (publicados, en revisión o suspendidos) */
export const verMisLocales = (repo: LocalesRepositorio) => repo.misLocales();

/** Reglas de reserva, canchas, horario y precios (RF03) */
export const verConfiguracion = (repo: LocalesRepositorio, localId: string) => repo.config(id(localId));

/** Adelanto, apartado, cancelación, WhatsApp y dirección */
export const guardarAjustesLocal = (repo: LocalesRepositorio, localId: string, datos: unknown) =>
  repo.guardarAjustes(id(localId), validarAjustes(datos));

/** Servicios del local: vestuarios, duchas, estacionamiento... (RF01, RF03) */
export const guardarServiciosLocal = (repo: LocalesRepositorio, localId: string, datos: unknown) =>
  repo.guardarServicios(id(localId), validarServicios(datos));

/** Nombre, deporte, horario por día, precio normal y de hora punta */
export const guardarCanchaDelLocal = (repo: LocalesRepositorio, canchaId: string, datos: unknown) =>
  repo.guardarCancha(id(canchaId), validarCancha(datos));

export const agregarCanchaAlLocal = (repo: LocalesRepositorio, localId: string, datos: unknown) =>
  repo.agregarCancha(id(localId), validarNuevaCancha(datos));

export const quitarCanchaDelLocal = (repo: LocalesRepositorio, canchaId: string) => repo.quitarCancha(id(canchaId));

/** Locales publicados y suspendidos con su dueño (RF08, solo admin) */
export const verLocalesAdmin = (repo: LocalesRepositorio) => repo.localesAdmin();

/** Asignar el dueño real, suspender o reactivar un local (RF08, solo admin) */
export function gestionarLocal(repo: LocalesRepositorio, localId: string, datos: unknown) {
  const local = id(localId);
  const p = validarPedidoAdmin(datos);
  if (p.accion === "asignar_dueno") return repo.asignarDueno(local, p.correo);
  return repo.cambiarEstado(local, p.accion, p.accion === "suspender" ? p.motivo : null);
}
