// Implementación del catálogo con Supabase (patrón Repository + Adapter).
// Llama a las funciones de PostgreSQL (fn_catalogo_canchas, fn_proponer_local...).
// Con el cliente sin sesión solo lee lo público; con el cliente CON sesión la
// base de datos sabe si quien pide es dueño o admin (auth.uid()).

import type { SupabaseClient } from "@supabase/supabase-js";
import { traducirErrorSupabase } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { deporteABD, deporteAWeb, distritoAWeb, type CanchaBD, type DeporteWeb, type NuevaCancha } from "../dominio/cancha";
import { ordenarServicios } from "../dominio/servicios";
import type {
  CanchaPublicada,
  Catalogo,
  CatalogoRepositorio,
  CanchaRevisada,
  RegistroCancha,
} from "../dominio/catalogo.repositorio";

// Fila que devuelve fn_catalogo_canchas() en Supabase
export type FilaCatalogo = {
  id: string;
  slug: string;
  nombre: string;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lat: number | string;
  lng: number | string;
  deportes: string[] | null;
  techada: boolean;
  precio_desde: number | string | null;
  telefono: string | null;
  rating: number | string | null;
  total_resenas: number | null;
  servicios?: string[] | null; // desde 012
};

/** Fila de la base de datos -> entidad del dominio */
export function filaACancha(f: FilaCatalogo): CanchaBD {
  const deportes = (f.deportes ?? []).map(deporteAWeb).filter((d): d is DeporteWeb => d !== null);
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    distrito: distritoAWeb(f.distrito),
    direccion: f.direccion,
    referencia: f.referencia ?? undefined,
    lat: Number(f.lat),
    lng: Number(f.lng),
    deportes: deportes.length ? deportes : ["Fútbol"],
    techada: Boolean(f.techada),
    precioDesde: f.precio_desde == null ? undefined : Number(f.precio_desde),
    telefono: f.telefono ?? undefined,
    rating: f.rating == null ? undefined : Number(f.rating),
    totalResenas: f.total_resenas ?? undefined,
    servicios: ordenarServicios(f.servicios),
  };
}

function parametrosRpc(c: NuevaCancha) {
  const deportes = (c.deportes ?? []).map((d) => deporteABD(d)).filter((d): d is string => d !== null);
  return {
    p_nombre: c.nombre,
    p_distrito: c.distrito,
    p_lat: c.lat,
    p_lng: c.lng,
    p_direccion: c.direccion ?? null,
    p_referencia: c.referencia ?? null,
    p_deportes: deportes.length ? deportes : ["futbol"],
    p_techada: c.techada ?? false,
    p_precio: c.precioDesde ?? null,
    p_telefono: c.telefono ?? null,
  };
}

export class SupabaseCatalogoRepositorio implements CatalogoRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  async leerPublicadas(): Promise<Catalogo> {
    const { data, error } = await this.db.rpc("fn_catalogo_canchas");
    if (error) throw traducirErrorSupabase(error);
    return { canchas: ((data ?? []) as FilaCatalogo[]).map(filaACancha), generado: new Date().toISOString() };
  }

  async proponer(c: NuevaCancha): Promise<RegistroCancha> {
    const { data, error } = await this.db.rpc("fn_proponer_local", parametrosRpc(c));
    if (error) throw traducirErrorSupabase(error);
    return data as RegistroCancha;
  }

  async reemplazar(id: string, c: NuevaCancha): Promise<RegistroCancha> {
    const { data, error } = await this.db.rpc("fn_reemplazar_propuesta", { p_id: id, ...parametrosRpc(c) });
    if (error) throw traducirErrorSupabase(error);
    return data as RegistroCancha;
  }

  async retirar(id: string): Promise<void> {
    const { error } = await this.db.rpc("fn_retirar_propuesta", { p_id: id });
    if (error) throw traducirErrorSupabase(error);
  }

  async listarPendientes(): Promise<CanchaBD[]> {
    const { data, error } = await this.db.rpc("fn_mis_pendientes");
    if (error) throw traducirErrorSupabase(error);
    return ((data ?? []) as FilaCatalogo[]).map(filaACancha);
  }

  async listarPublicadasDe(duenoId: string): Promise<CanchaPublicada[]> {
    const { data, error } = await this.db
      .from("venues")
      .select("id, name, address, districts(name)")
      .eq("owner_id", duenoId)
      .eq("status", "approved")
      .order("name");
    if (error) throw traducirErrorSupabase(error);
    type Fila = { id: string; name: string; address: string; districts: { name: string } | null };
    return ((data ?? []) as unknown as Fila[]).map((v) => ({
      id: v.id,
      nombre: v.name,
      direccion: v.address,
      distrito: v.districts?.name ?? null,
    }));
  }

  async revisar(id: string, aprobar: boolean, motivo?: string): Promise<CanchaRevisada> {
    const { data, error } = await this.db.rpc("fn_revisar_local", { p_id: id, p_aprobar: aprobar, p_motivo: motivo ?? null });
    if (error) throw traducirErrorSupabase(error);
    return data as CanchaRevisada;
  }
}
