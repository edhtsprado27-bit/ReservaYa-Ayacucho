// Después de cambiar precios, canchas o el estado de un local, sus vistas
// públicas guardadas en caché se renuevan al instante:
//  - la ficha del local ("use cache" con la etiqueta local-<slug>)
//  - el catálogo del mapa (caché en memoria de 30 s)
// El CDN de /api/canchas (60 s) y de la grilla (5 s) vence solo.

import { revalidateTag } from "next/cache";
import { olvidarCatalogoPublico } from "@/modules/catalogo/infraestructura/composicion";

export function refrescarVistasPublicas(slug: string) {
  // expire: 0 -> la siguiente visita ya ve los datos nuevos (no la copia anterior)
  revalidateTag(`local-${slug}`, { expire: 0 });
  olvidarCatalogoPublico();
}
