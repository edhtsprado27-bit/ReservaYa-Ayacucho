// Puerto (interfaz) del catálogo: QUÉ necesita el módulo para guardar y leer
// canchas, sin decir CÓMO. La implementación con Supabase está en
// infraestructura/supabase-catalogo.repositorio.ts (patrón Repository).

import type { CanchaBD, NuevaCancha } from "./cancha";

export type RegistroCancha = { id: string; slug: string; estado: string };
export type CanchaRevisada = { id: string; nombre: string; estado: string };
export type Catalogo = { canchas: CanchaBD[]; generado: string };
export type CanchaPublicada = { id: string; nombre: string; direccion: string; distrito: string | null };

export interface CatalogoRepositorio {
  /** Canchas aprobadas (públicas) para el mapa y la lista */
  leerPublicadas(): Promise<Catalogo>;
  /** Registra una cancha nueva: queda en revisión */
  proponer(cancha: NuevaCancha): Promise<RegistroCancha>;
  /** Corrige una cancha que sigue en revisión (devuelve un id nuevo) */
  reemplazar(id: string, cancha: NuevaCancha): Promise<RegistroCancha>;
  /** Quita una cancha que sigue en revisión */
  retirar(id: string): Promise<void>;
  /** Canchas en revisión (dueño: las suyas; admin: todas) */
  listarPendientes(): Promise<CanchaBD[]>;
  /** Canchas ya aprobadas de un dueño (panel del dueño) */
  listarPublicadasDe(duenoId: string): Promise<CanchaPublicada[]>;
  /** Aprueba o rechaza una cancha (solo admin) */
  revisar(id: string, aprobar: boolean, motivo?: string): Promise<CanchaRevisada>;
}
