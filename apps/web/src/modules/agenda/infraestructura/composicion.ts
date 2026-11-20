// Raíz de composición de la agenda: elige la implementación concreta.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaRepositorio } from "../dominio/agenda.repositorio";
import { SupabaseAgendaRepositorio } from "./supabase-agenda.repositorio";

/** Siempre con la sesión de quien pide (dueño o admin) */
export const agendaConSesion = (db: SupabaseClient): AgendaRepositorio => new SupabaseAgendaRepositorio(db);
