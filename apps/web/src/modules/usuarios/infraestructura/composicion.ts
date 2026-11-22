// Raíz de composición de la gestión de usuarios: elige la implementación concreta.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsuariosRepositorio } from "../dominio/usuarios.repositorio";
import { SupabaseUsuariosRepositorio } from "./supabase-usuarios.repositorio";

/** Siempre con la sesión de quien pide (la base exige que sea admin) */
export const usuariosConSesion = (db: SupabaseClient): UsuariosRepositorio => new SupabaseUsuariosRepositorio(db);
