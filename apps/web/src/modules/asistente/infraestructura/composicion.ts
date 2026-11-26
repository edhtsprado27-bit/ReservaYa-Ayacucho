// Raíz de composición del asistente: arma lo que necesita el caso de uso.
// - Datos: el mismo catálogo con caché del mapa, la ficha "use cache" y la grilla.
// - IA: solo si hay OPENROUTER_API_KEY; el cupo se revisa con la sesión de quien pregunta.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verCatalogo } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoPublico } from "@/modules/catalogo/infraestructura/composicion";
import { iaConfigurada } from "@/modules/compartido/infraestructura/openrouter";
import { reservasPublicas } from "@/modules/reservas/infraestructura/composicion";
import { leerLocalEnCache } from "@/modules/reservas/infraestructura/local-publico-en-cache";
import type { DepsAsistente } from "../aplicacion/asistente.casos-de-uso";
import type { FuenteCanchas } from "../dominio/asistente.puertos";
import { OpenRouterInterprete } from "./openrouter-interprete";
import { SupabaseControlIA } from "./supabase-control-ia";

export const fuentePublica = (): FuenteCanchas => ({
  publicadas: async () => (await verCatalogo(catalogoPublico())).canchas,
  local: (slug) => leerLocalEnCache(slug),
  turnos: (localId, fecha) => reservasPublicas().disponibilidad(localId, fecha),
});

export const asistenteConSesion = (db: SupabaseClient): DepsAsistente => ({
  fuente: fuentePublica(),
  ia: iaConfigurada() ? { interprete: new OpenRouterInterprete(), control: new SupabaseControlIA(db) } : null,
  ahora: new Date(),
});
