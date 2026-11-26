// Puertos (interfaces) del asistente: QUÉ necesita, sin decir CÓMO.
// Implementaciones en infraestructura/: catálogo y grilla de Supabase (con
// caché), intérprete de OpenRouter y control del cupo en la base.

import type { CanchaBD } from "@/modules/catalogo/dominio/cancha";
import type { ConfigIA, RegistroIA } from "@/modules/compartido/dominio/ia";
import type { LocalPublico, Turno } from "@/modules/reservas/dominio/reserva";
import type { Filtros, Interpretacion, MensajeHistorial } from "./asistente";

/** Datos reales que consulta el asistente (los mismos que ve el mapa y la grilla) */
export interface FuenteCanchas {
  publicadas(): Promise<CanchaBD[]>;
  local(slug: string): Promise<LocalPublico | null>;
  turnos(localId: string, fecha: string): Promise<Turno[]>;
}

export type PedidoInterprete = {
  mensaje: string;
  historial: MensajeHistorial[];
  filtrosPrevios: Filtros;
  hoy: string;
  horaAhora: string;
  config: ConfigIA;
};

export type ResultadoInterprete = { interpretacion: Interpretacion | null; ia: RegistroIA | null };

/** La IA que entiende lo que la persona escribe (patrón Adapter) */
export interface InterpreteIA {
  interpretar(p: PedidoInterprete): Promise<ResultadoInterprete>;
}

export type Cupo = {
  permitido: boolean;
  motivo: "SIN_SESION" | "CUPO_CUENTA" | "CUPO_DIA" | null;
  limiteCuenta: number;
};

/** Cupo diario, configuración del modelo y registro de cada llamada */
export interface ControlIA {
  cupo(): Promise<Cupo>;
  config(): Promise<ConfigIA | null>;
  registrar(ia: RegistroIA): Promise<void>;
}

export type ServicioIA = { interprete: InterpreteIA; control: ControlIA };
