// Pagos en Supabase (patrón Repository). Siempre con la sesión de quien pide:
// las funciones de PostgreSQL (008_pagos.sql) deciden qué puede ver y hacer
// cada uno, comparan la lectura de la IA con lo esperado y cambian el estado
// de la reserva en una sola transacción.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aConfigIA } from "@/modules/compartido/dominio/ia";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import type { EstadoPago, LocalPago, PagoPorRevisar } from "../dominio/pago";
import type { ConfigIA, DatosPagoLocal, NuevoPago, PagoEnviado, PagosRepositorio } from "../dominio/pagos.puertos";
import { aEstadoPago, aLocalPago, aPagoPorRevisar } from "./mapeo-pagos";

const traducir = (e: { message?: string; code?: string }) =>
  aErrorAplicacion(Object.assign(new Error(e.message ?? ""), { code: e.code }));

export class SupabasePagosRepositorio implements PagosRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  async estadoPago(reservaId: string): Promise<EstadoPago | null> {
    const { data, error } = await this.db.rpc("fn_estado_pago", { p_reserva: reservaId });
    if (error) throw traducir(error);
    return data ? aEstadoPago(data) : null;
  }

  async configIA(): Promise<ConfigIA | null> {
    const { data, error } = await this.db.rpc("fn_config_ia", { p_funcion: "receipt_ocr" });
    if (error) return null;
    return aConfigIA(data);
  }

  async registrarPago(p: NuevoPago): Promise<PagoEnviado> {
    const { data, error } = await this.db.rpc("fn_registrar_pago", {
      p_reserva: p.reservaId,
      p_metodo: p.metodo,
      p_ruta: p.ruta,
      p_sha256: p.sha256,
      p_lectura: p.lectura,
      p_ia: p.ia,
    });
    if (error) throw traducir(error);
    return { pago: String(data.pago), estadoPago: String(data.estado_pago), resultado: data.resultado ?? null };
  }

  async pagosPorRevisar(): Promise<PagoPorRevisar[]> {
    const { data, error } = await this.db.rpc("fn_pagos_por_revisar");
    if (error) throw traducir(error);
    return (data ?? []).map(aPagoPorRevisar);
  }

  async revisarPago(pagoId: string, aprobar: boolean, motivo?: string) {
    const { data, error } = await this.db.rpc("fn_revisar_pago", {
      p_pago: pagoId,
      p_aprobar: aprobar,
      p_motivo: motivo ?? null,
    });
    if (error) throw traducir(error);
    return { estadoReserva: String(data.estado_reserva) };
  }

  async misLocalesPago(): Promise<LocalPago[]> {
    const { data, error } = await this.db.rpc("fn_mis_locales_pago");
    if (error) throw traducir(error);
    return (data ?? []).map(aLocalPago);
  }

  async guardarDatosPago(localId: string, datos: { yape: string | null; plin: string | null; titular: string | null }) {
    const { data, error } = await this.db.rpc("fn_guardar_datos_pago", {
      p_local: localId,
      p_yape: datos.yape,
      p_plin: datos.plin,
      p_titular: datos.titular,
    });
    if (error) throw traducir(error);
    return data as DatosPagoLocal;
  }
}
