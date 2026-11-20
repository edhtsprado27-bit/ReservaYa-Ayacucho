// Raíz de composición de la gestión de locales: elige la implementación
// concreta y le agrega la renovación de las vistas públicas (patrón Decorator).

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cambio, LocalesRepositorio } from "../dominio/locales.repositorio";
import type { PedidoAjustes, PedidoCancha, PedidoNuevaCancha } from "../dominio/pedidos-locales";
import { SupabaseLocalesRepositorio } from "./supabase-locales.repositorio";
import { refrescarVistasPublicas } from "./vistas-publicas";

/** Siempre con la sesión de quien pide (dueño o admin) */
export const localesConSesion = (db: SupabaseClient, refrescar: (slug: string) => void = refrescarVistasPublicas): LocalesRepositorio =>
  new LocalesConVistasFrescas(new SupabaseLocalesRepositorio(db), refrescar);

// Igual que el repositorio, pero después de cada cambio renueva la ficha del
// local y el catálogo del mapa para que los jugadores vean los datos nuevos.
export class LocalesConVistasFrescas implements LocalesRepositorio {
  constructor(
    private readonly repo: LocalesRepositorio,
    private readonly refrescar: (slug: string) => void,
  ) {}

  private async yRefrescar<T extends Cambio>(cambio: Promise<T>): Promise<T> {
    const r = await cambio;
    this.refrescar(r.slug);
    return r;
  }

  misLocales() {
    return this.repo.misLocales();
  }
  config(localId: string) {
    return this.repo.config(localId);
  }
  localesAdmin() {
    return this.repo.localesAdmin();
  }
  guardarAjustes(localId: string, p: PedidoAjustes) {
    return this.yRefrescar(this.repo.guardarAjustes(localId, p));
  }
  guardarCancha(canchaId: string, p: PedidoCancha) {
    return this.yRefrescar(this.repo.guardarCancha(canchaId, p));
  }
  agregarCancha(localId: string, p: PedidoNuevaCancha) {
    return this.yRefrescar(this.repo.agregarCancha(localId, p));
  }
  quitarCancha(canchaId: string) {
    return this.yRefrescar(this.repo.quitarCancha(canchaId));
  }
  asignarDueno(localId: string, correo: string) {
    return this.repo.asignarDueno(localId, correo);
  }
  cambiarEstado(localId: string, accion: "suspender" | "reactivar", motivo: string | null) {
    return this.yRefrescar(this.repo.cambiarEstado(localId, accion, motivo));
  }
}
