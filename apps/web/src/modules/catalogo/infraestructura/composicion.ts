// Raíz de composición del catálogo: aquí se eligen las implementaciones
// concretas (Supabase + caché) que reciben los casos de uso.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/modules/compartido/infraestructura/supabase/cliente-publico";
import type { NuevaCancha } from "../dominio/cancha";
import type { CatalogoRepositorio } from "../dominio/catalogo.repositorio";
import { CatalogoEnCache } from "./catalogo-en-cache";
import { SupabaseCatalogoRepositorio } from "./supabase-catalogo.repositorio";

let publico: CatalogoEnCache | null = null;

/** Catálogo público (sin sesión), con caché en memoria compartida entre visitas */
export function catalogoPublico(): CatalogoEnCache {
  publico ??= new CatalogoEnCache(new SupabaseCatalogoRepositorio(getSupabase()));
  return publico;
}

/** Borra la copia en memoria del catálogo (otro módulo cambió precios, canchas o el estado de un local) */
export function olvidarCatalogoPublico() {
  publico?.invalidar();
}

/** Catálogo con la sesión de quien pide (registrar, editar, aprobar) */
export function catalogoConSesion(db: SupabaseClient): CatalogoRepositorio {
  return new CatalogoConSesion(new SupabaseCatalogoRepositorio(db));
}

// Igual que el repositorio de Supabase, pero al aprobar una cancha también
// borra la caché del catálogo público para que aparezca en el mapa al instante.
class CatalogoConSesion implements CatalogoRepositorio {
  constructor(private readonly repo: SupabaseCatalogoRepositorio) {}
  leerPublicadas() {
    return this.repo.leerPublicadas();
  }
  proponer(c: NuevaCancha) {
    return this.repo.proponer(c);
  }
  reemplazar(id: string, c: NuevaCancha) {
    return this.repo.reemplazar(id, c);
  }
  retirar(id: string) {
    return this.repo.retirar(id);
  }
  listarPendientes() {
    return this.repo.listarPendientes();
  }
  listarPublicadasDe(duenoId: string) {
    return this.repo.listarPublicadasDe(duenoId);
  }
  async revisar(id: string, aprobar: boolean, motivo?: string) {
    const r = await this.repo.revisar(id, aprobar, motivo);
    if (aprobar) publico?.invalidar();
    return r;
  }
}
