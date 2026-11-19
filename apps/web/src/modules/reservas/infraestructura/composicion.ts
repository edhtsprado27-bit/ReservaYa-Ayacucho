// Raíz de composición de las reservas: elige la implementación concreta.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/modules/compartido/infraestructura/supabase/cliente-publico";
import type { ReservasRepositorio } from "../dominio/reservas.repositorio";
import { SupabaseReservasRepositorio } from "./supabase-reservas.repositorio";

/** Lo público (ficha del local y grilla de horarios), sin sesión: se puede cachear */
export const reservasPublicas = (): ReservasRepositorio => new SupabaseReservasRepositorio(getSupabase());

/** Lo personal (reservar, mis reservas, cancelar), con la sesión de quien pide */
export const reservasConSesion = (db: SupabaseClient): ReservasRepositorio => new SupabaseReservasRepositorio(db);
