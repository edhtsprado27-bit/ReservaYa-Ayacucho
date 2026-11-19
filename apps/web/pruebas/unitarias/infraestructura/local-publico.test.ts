// Ficha pública del local con la caché de Next.js ("use cache").
import { crearSupabaseFalso, ID_CANCHA, ID_LOCAL } from "../../apoyo/supabase-falso";

const cacheLife = jest.fn();
const cacheTag = jest.fn();
jest.mock("next/cache", () => ({ cacheLife: (...a: unknown[]) => cacheLife(...a), cacheTag: (...a: unknown[]) => cacheTag(...a) }));

let supabase = crearSupabaseFalso();
jest.mock("@/modules/compartido/infraestructura/supabase/cliente-publico", () => ({ getSupabase: () => supabase.db }));

import { verLocal } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import { reservasPublicas } from "@/modules/reservas/infraestructura/composicion";

describe("ficha pública del local", () => {
  it("se guarda 1 minuto en caché con una etiqueta por local", async () => {
    supabase = crearSupabaseFalso({
      fn_local_publico: { data: { id: ID_LOCAL, slug: "cancha-demo", nombre: "Cancha Demo", distrito: "Ayacucho", lat: -13.16, lng: -74.22, canchas: [{ id: ID_CANCHA, nombre: "C1", deporte: "futbol" }] } },
    });
    const local = await verLocal(reservasPublicas(), "cancha-demo");
    expect(local?.nombre).toBe("Cancha Demo");
    expect(local?.canchas[0].deporte).toBe("Fútbol");
    expect(cacheLife).toHaveBeenCalledWith("minutes");
    expect(cacheTag).toHaveBeenCalledWith("local-cancha-demo");
    expect(supabase.rpc).toHaveBeenCalledWith("fn_local_publico", { p_slug: "cancha-demo" });
  });

  it("un local que no existe devuelve null y un error de la base se traduce", async () => {
    supabase = crearSupabaseFalso();
    expect(await verLocal(reservasPublicas(), "no-existe")).toBeNull();
    supabase = crearSupabaseFalso({ fn_local_publico: { error: { code: "PGRST202", message: "x" } } });
    await expect(verLocal(reservasPublicas(), "otro")).rejects.toMatchObject({ codigo: "FALTA_MIGRACION" });
  });
});
