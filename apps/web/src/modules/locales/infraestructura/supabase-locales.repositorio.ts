// Gestión de locales con Supabase (patrón Repository). Siempre con la sesión
// de quien pide: las funciones de PostgreSQL (011_configuracion_local.sql)
// comprueban que sea el dueño del local o el admin, y dejan cada cambio en audit_logs.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import type { EstadoLocal, LocalAdmin } from "../dominio/configuracion";
import type { Cambio, LocalesRepositorio, LocalPropio } from "../dominio/locales.repositorio";
import { datosLocalInvalidos, type PedidoAjustes, type PedidoCancha, type PedidoNuevaCancha } from "../dominio/pedidos-locales";
import { aConfig, aLocalAdmin } from "./mapeo-locales";

type Json = Record<string, unknown>;

const traducir = (e: { message?: string; code?: string }) =>
  e.message === "DATOS_INVALIDOS" ? datosLocalInvalidos() : aErrorAplicacion(Object.assign(new Error(e.message ?? ""), { code: e.code }));

const cambio = (d: Json): Cambio => ({ id: String(d.id), slug: String(d.slug) });

export class SupabaseLocalesRepositorio implements LocalesRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  private async llamar(fn: string, params?: Json): Promise<Json> {
    const { data, error } = await this.db.rpc(fn, params);
    if (error) throw traducir(error);
    return (data ?? {}) as Json;
  }

  async misLocales(): Promise<LocalPropio[]> {
    const { data, error } = await this.db.rpc("fn_mis_locales_pago");
    if (error) throw traducir(error);
    return ((data ?? []) as Json[]).map((f) => ({ id: String(f.id), nombre: String(f.nombre), estado: String(f.estado) as EstadoLocal }));
  }

  async config(localId: string) {
    return aConfig(await this.llamar("fn_config_local", { p_local: localId }));
  }

  async guardarAjustes(localId: string, p: PedidoAjustes) {
    return cambio(
      await this.llamar("fn_guardar_local", {
        p_local: localId,
        p_direccion: p.direccion,
        p_referencia: p.referencia,
        p_whatsapp: p.whatsapp,
        p_adelanto: p.adelantoPct,
        p_apartado: p.minutosApartado,
        p_cancelacion: p.horasCancelacion,
      }),
    );
  }

  async guardarCancha(canchaId: string, p: PedidoCancha) {
    const d = await this.llamar("fn_guardar_cancha", {
      p_cancha: canchaId,
      p_nombre: p.nombre,
      p_deporte: p.deporte,
      p_techada: p.techada,
      p_max_minutos: p.maxMinutos,
      p_horario: p.horario,
      p_precio: p.precio,
      p_precio_punta: p.precioPunta,
      p_punta_desde: p.puntaDesde,
    });
    return { ...cambio(d), fueraDeHorario: Number(d.fuera_de_horario ?? 0) };
  }

  async agregarCancha(localId: string, p: PedidoNuevaCancha) {
    return cambio(
      await this.llamar("fn_agregar_cancha", { p_local: localId, p_nombre: p.nombre, p_deporte: p.deporte, p_precio: p.precio }),
    );
  }

  async quitarCancha(canchaId: string) {
    return cambio(await this.llamar("fn_quitar_cancha", { p_cancha: canchaId }));
  }

  async localesAdmin(): Promise<LocalAdmin[]> {
    const { data, error } = await this.db.rpc("fn_locales_admin");
    if (error) throw traducir(error);
    return ((data ?? []) as Json[]).map(aLocalAdmin);
  }

  async asignarDueno(localId: string, correo: string) {
    const d = await this.llamar("fn_asignar_dueno", { p_local: localId, p_correo: correo });
    return {
      ...cambio(d),
      estado: String(d.estado) as EstadoLocal,
      dueno: String(d.dueno),
      correo: String(d.correo),
      ahoraEsDueno: Boolean(d.ahora_es_dueno),
    };
  }

  async cambiarEstado(localId: string, accion: "suspender" | "reactivar", motivo: string | null) {
    const d = await this.llamar("fn_cambiar_estado_local", { p_local: localId, p_accion: accion, p_motivo: motivo });
    return { ...cambio(d), estado: String(d.estado) as EstadoLocal, reservasFuturas: Number(d.reservas_futuras ?? 0) };
  }
}
