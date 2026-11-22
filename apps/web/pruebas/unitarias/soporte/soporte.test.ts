// WhatsApp de ayuda de la plataforma (RF15): validación, casos de uso,
// repositorio de Supabase y caché ("use cache" + etiqueta que se borra al guardar).
import { revalidateTag } from "next/cache";
import { guardarAjustesPlataforma, verAjustesPublicos } from "@/modules/soporte/aplicacion/soporte.casos-de-uso";
import { validarAjustes } from "@/modules/soporte/dominio/soporte";
import { ETIQUETA_AJUSTES, leerAjustesEnCache } from "@/modules/soporte/infraestructura/ajustes-en-cache";
import { ajustesConSesion, ajustesPublicos } from "@/modules/soporte/infraestructura/composicion";
import { aAjustes } from "@/modules/soporte/infraestructura/supabase-ajustes.repositorio";
import { getSupabase } from "@/modules/compartido/infraestructura/supabase/cliente-publico";
import { crearSupabaseFalso } from "../../apoyo/supabase-falso";

jest.mock("next/cache", () => ({ cacheLife: jest.fn(), cacheTag: jest.fn(), revalidateTag: jest.fn() }));
jest.mock("@/modules/compartido/infraestructura/supabase/cliente-publico", () => ({ getSupabase: jest.fn() }));

describe("validación del WhatsApp de ayuda", () => {
  it("acepta celulares peruanos y vacío (quita el botón)", () => {
    expect(validarAjustes({ whatsappSoporte: " 966 111 222 " })).toEqual({ whatsappSoporte: "966111222" });
    expect(validarAjustes({ whatsappSoporte: "+51966111222" })).toEqual({ whatsappSoporte: "966111222" });
    expect(validarAjustes({ whatsappSoporte: "" })).toEqual({ whatsappSoporte: null });
    expect(validarAjustes({ whatsappSoporte: null })).toEqual({ whatsappSoporte: null });
  });

  it("rechaza números malos y cuerpos sin el campo", () => {
    expect(() => validarAjustes({ whatsappSoporte: "12345" })).toThrow(expect.objectContaining({ codigo: "TELEFONO_INVALIDO", status: 400 }));
    expect(() => validarAjustes({})).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_AJUSTES" }));
    expect(() => validarAjustes({ whatsappSoporte: 966111222 })).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_AJUSTES" }));
    expect(() => validarAjustes(null)).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_AJUSTES" }));
  });

  it("convierte la respuesta de la base", () => {
    expect(aAjustes({ whatsapp_soporte: "+51966111222" })).toEqual({ whatsappSoporte: "+51966111222" });
    expect(aAjustes({ whatsapp_soporte: null })).toEqual({ whatsappSoporte: null });
    expect(aAjustes(null)).toEqual({ whatsappSoporte: null });
  });
});

describe("casos de uso y composición", () => {
  beforeEach(() => jest.mocked(revalidateTag).mockClear());

  it("guardar llama a fn_guardar_ajustes y renueva el botón de toda la web", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_guardar_ajustes: { data: { whatsapp_soporte: "+51966111222" } },
      fn_ajustes_publicos: { data: { whatsapp_soporte: "+51966111222" } },
    });
    const repo = ajustesConSesion(db);
    expect(await guardarAjustesPlataforma(repo, { whatsappSoporte: "966 111 222" })).toEqual({ whatsappSoporte: "+51966111222" });
    expect(rpc).toHaveBeenCalledWith("fn_guardar_ajustes", { p_whatsapp_soporte: "966111222" });
    expect(revalidateTag).toHaveBeenCalledWith(ETIQUETA_AJUSTES, { expire: 0 });

    await guardarAjustesPlataforma(repo, { whatsappSoporte: "" });
    expect(rpc).toHaveBeenLastCalledWith("fn_guardar_ajustes", { p_whatsapp_soporte: "" });
    expect(await verAjustesPublicos(repo)).toEqual({ whatsappSoporte: "+51966111222" });
  });

  it("si la base lo rechaza (no es admin) no se renueva nada", async () => {
    const { db } = crearSupabaseFalso({ fn_guardar_ajustes: { error: { code: "P0001", message: "SOLO_ADMIN" } } });
    await expect(guardarAjustesPlataforma(ajustesConSesion(db), { whatsappSoporte: "966111222" })).rejects.toEqual(
      expect.objectContaining({ codigo: "SOLO_ADMIN", status: 403 }),
    );
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("las páginas leen el número de la caché; si Supabase falla, la web sigue sin el botón", async () => {
    const { db } = crearSupabaseFalso({ fn_ajustes_publicos: { data: { whatsapp_soporte: "+51966111222" } } });
    jest.mocked(getSupabase).mockReturnValue(db);
    expect(await leerAjustesEnCache()).toEqual({ whatsappSoporte: "+51966111222" });
    expect(await ajustesPublicos()).toEqual({ whatsappSoporte: "+51966111222" });

    const roto = crearSupabaseFalso({ fn_ajustes_publicos: { error: { code: "PGRST202", message: "no existe" } } });
    jest.mocked(getSupabase).mockReturnValue(roto.db);
    await expect(leerAjustesEnCache()).rejects.toEqual(expect.objectContaining({ codigo: "FALTA_MIGRACION" }));
    expect(await ajustesPublicos()).toEqual({ whatsappSoporte: null });
  });
});
