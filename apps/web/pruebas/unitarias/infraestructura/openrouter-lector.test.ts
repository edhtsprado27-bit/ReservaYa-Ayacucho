// Adaptador de OpenRouter (infraestructura), con fetch simulado: no se llama a la IA real.
import { esGratis, iaConfigurada, leerComprobante, OpenRouterLectorComprobantes } from "@/modules/pagos/infraestructura/openrouter-lector";
import type { ConfigIA } from "@/modules/pagos/dominio/pagos.puertos";
import { PNG } from "../../apoyo/supabase-falso";

const config: ConfigIA = {
  modelo: "google/gemma-4-31b-it:free",
  respaldo: ["nvidia/nemotron:free", "google/gemma-4-31b-it:free"],
  temperatura: 0,
  maxTokens: 800,
  prompt: null,
  version: "ocr-v1",
};

const lecturaIA = { es_comprobante: true, app: "yape", monto: 50, numero_operacion: "123456", fecha_hora: "2026-11-18T19:15", destinatario: "Juan", confianza: 0.9 };

const respuesta = (cuerpo: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => cuerpo }) as unknown as Response;

const exito = (contenido: unknown, modelo = "google/gemma-4-31b-it:free") =>
  respuesta({ id: "gen-1", model: modelo, choices: [{ message: { content: contenido } }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0 } });

let fetchFalso: jest.Mock;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "clave-de-prueba";
  fetchFalso = jest.fn();
  global.fetch = fetchFalso as unknown as typeof fetch;
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe("leerComprobante", () => {
  it("sin clave o sin modelo no llama a la IA", async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(iaConfigurada()).toBe(false);
    expect(await leerComprobante(PNG, "image/png", config)).toEqual({ lectura: null, ia: null });
    process.env.OPENROUTER_API_KEY = "x";
    expect(await leerComprobante(PNG, "image/png", null)).toEqual({ lectura: null, ia: null });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("lee el comprobante con el modelo principal y registra el uso", async () => {
    fetchFalso.mockResolvedValueOnce(exito(JSON.stringify(lecturaIA)));
    const r = await leerComprobante(PNG, "image/png", config);
    expect(r.lectura).toEqual(expect.objectContaining({ monto: 50, app: "yape" }));
    expect(r.ia).toEqual(expect.objectContaining({ estado: "success", modelo_usado: "google/gemma-4-31b-it:free", tokens_entrada: 100, tokens_salida: 20, generacion: "gen-1" }));

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/chat\/completions$/);
    const cuerpo = JSON.parse(opciones.body);
    expect(opciones.headers.Authorization).toBe("Bearer clave-de-prueba");
    expect(cuerpo.provider).toEqual({ require_parameters: false }); // modelo gratis: sin filtros de privacidad
    expect(cuerpo.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
  });

  it("acepta JSON envuelto en ```json y usa el modelo de respaldo si el principal falla", async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta({ error: { message: "Rate limit" } }, 429))
      .mockResolvedValueOnce(exito("```json\n" + JSON.stringify(lecturaIA) + "\n```", "nvidia/nemotron:free"));
    const r = await leerComprobante(PNG, "image/png", config);
    expect(fetchFalso).toHaveBeenCalledTimes(2); // el respaldo repetido no se vuelve a intentar
    expect(r.ia).toEqual(expect.objectContaining({ estado: "fallback_used", modelo_usado: "nvidia/nemotron:free" }));
    expect(r.ia?.error).toMatch(/Rate limit/);
  });

  it("si todos los modelos fallan, devuelve lectura null y el error", async () => {
    fetchFalso.mockResolvedValue(exito("no es json"));
    const r = await leerComprobante(PNG, "image/png", config);
    expect(r.lectura).toBeNull();
    expect(r.ia).toEqual(expect.objectContaining({ estado: "error", modelo_usado: null }));
    expect(r.ia?.error).toMatch(/formato esperado/);
  });

  it("marca timeout si la IA tarda demasiado", async () => {
    fetchFalso.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const r = await leerComprobante(PNG, "image/png", { ...config, respaldo: [] });
    expect(r.ia?.estado).toBe("timeout");
  });

  it("con un modelo de pago exige proveedores que no guardan los datos", async () => {
    fetchFalso.mockResolvedValueOnce(exito(lecturaIA));
    await new OpenRouterLectorComprobantes().leer(PNG, "image/png", { ...config, modelo: "google/gemini-2.5-flash-lite", respaldo: [] });
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).provider).toEqual({ require_parameters: true, data_collection: "deny" });
    expect(esGratis("openrouter/free")).toBe(true);
    expect(esGratis("google/gemini-2.5-flash-lite")).toBe(false);
  });
});
