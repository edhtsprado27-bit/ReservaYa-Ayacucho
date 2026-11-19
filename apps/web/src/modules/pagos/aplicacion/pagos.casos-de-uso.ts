// Casos de uso de pagos para el jugador, el dueño y el admin. Capa: aplicación.
// La base de datos decide qué puede ver y hacer cada uno (jugador, dueño, admin).

import { esUUID } from "@/modules/compartido/dominio/validaciones";
import type { PagoPorRevisar } from "../dominio/pago";
import type { AlmacenComprobantes, PagosRepositorio } from "../dominio/pagos.puertos";
import { datosPagoInvalidos } from "./enviar-comprobante";

export const ENLACE_CAPTURA_SEGUNDOS = 900; // 15 minutos

/** En qué va el pago de una reserva y a quién pagar */
export async function verEstadoPago(pagos: PagosRepositorio, reservaId: string) {
  if (!esUUID(reservaId)) return null;
  return pagos.estadoPago(reservaId);
}

/** Pagos por revisar del dueño (o todos para el admin), con enlaces temporales a las capturas */
export async function verPagosPorRevisar(pagos: PagosRepositorio, almacen: AlmacenComprobantes): Promise<PagoPorRevisar[]> {
  const lista = await pagos.pagosPorRevisar();
  if (!lista.length) return lista;
  const enlaces = await almacen.enlacesFirmados(
    lista.map((p) => p.ruta),
    ENLACE_CAPTURA_SEGUNDOS,
  );
  return lista.map((p) => ({ ...p, imagen: enlaces.get(p.ruta) ?? null }));
}

/** El dueño confirma o rechaza el pago (quien decide es el dueño, no la IA) */
export function revisarPago(pagos: PagosRepositorio, pagoId: string, aprobar: boolean, motivo?: string) {
  if (!esUUID(pagoId)) throw datosPagoInvalidos();
  return pagos.revisarPago(pagoId, aprobar, motivo?.slice(0, 200));
}

/** Locales del dueño con sus datos de Yape y Plin */
export const verMisLocalesPago = (pagos: PagosRepositorio) => pagos.misLocalesPago();

/** Guardar el Yape, Plin y titular de un local (los valida la base de datos) */
export function guardarDatosPago(
  pagos: PagosRepositorio,
  localId: string,
  datos: { yape?: unknown; plin?: unknown; titular?: unknown },
) {
  if (!esUUID(localId)) throw datosPagoInvalidos();
  const texto = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : null);
  return pagos.guardarDatosPago(localId, { yape: texto(datos.yape), plin: texto(datos.plin), titular: texto(datos.titular) });
}
