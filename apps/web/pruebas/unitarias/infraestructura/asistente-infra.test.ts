// Infraestructura del asistente: intérprete de OpenRouter (fetch simulado),
// cupo y registro en Supabase (falso) y límite de mensajes por IP.
import { SIN_FILTROS } from "@/modules/asistente/dominio/asistente";
import { OpenRouterInterprete } from "@/modules/asistente/infraestructura/openrouter-interprete";
import { aCupo, leerUsoIAHoy, SupabaseControlIA } from "@/modules/asistente/infraestructura/supabase-control-ia";
import type { ConfigIA } from "@/modules/compartido/dominio/ia";
import { crearLimite, ipDe } from "@/modules/compartido/infraestructura/limite-por-clave";
import { pedirJSON } from "@/modules/compartido/infraestructura/openrouter";
import { crearSupabaseFalso } from "../../apoyo/supabase-falso";

const CONFIG: ConfigIA = {
  modelo: "google/gemma-4-31b-it:free",
  respaldo: ["nvidia/nemotron-3.5-super-vl:free", "openrouter/free"],
  temperatura: 0.2,
  maxTokens: 1500,
  prompt: null,
  version: "asistente-v1",
};

const respuesta = (cuerpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => cuerpo }) as unknown as Response;
const exito = (contenido: unknown, modelo = CONFIG.modelo) =>
  respuesta({ id: "gen-9", model: modelo, choices: [{ message: { content: contenido } }], usage: { prompt_tokens: 1200, completion_tokens: 80, cost: 0 } });

const pedido = {
  mensaje: "algo para el sábado en la noche, somos 10",
  historial: [
    { rol: "persona" as const, texto: "hola" },
    { rol: "asistente" as const, texto: "¡Hola! ¿Qué quieres jugar?" },
  ],
  filtrosPrevios: { ...SIN_FILTROS, deporte: "Fútbol" as const },
  hoy: "2026-11-22",
  horaAhora: "10:30",
  config: CONFIG,
};

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

describe("OpenRouterInterprete", () => {
  const salidaIA = { intencion: "buscar", respuesta: null, filtros: { distrito: null, deporte: "Fútbol", fecha: "2026-11-28", hora: null, franja: "noche", servicios: [], techada: null, precio_max: null, nombre: null } };

  it("manda instrucciones, historial y mensaje; valida lo que responde", async () => {
    fetchFalso.mockResolvedValueOnce(exito(JSON.stringify(salidaIA)));
    const r = await new OpenRouterInterprete().interpretar(pedido);
    expect(r.interpretacion).toEqual({ intencion: "buscar", respuesta: null, seguro: true, filtros: { ...SIN_FILTROS, deporte: "Fútbol", fecha: "2026-11-28", franja: "noche" } });
    expect(r.ia).toEqual(expect.objectContaining({ estado: "success", tokens_entrada: 1200, generacion: "gen-9" }));

    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(cuerpo.model).toBe(CONFIG.modelo);
    expect(cuerpo.temperature).toBe(0.2);
    expect(cuerpo.response_format.json_schema).toEqual(expect.objectContaining({ name: "interpretacion", strict: true }));
    expect(cuerpo.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(cuerpo.messages[0].content).toContain("Hoy es domingo 22 de noviembre");
    expect(cuerpo.messages[0].content).toContain('"deporte":"Fútbol"');
    expect(cuerpo.messages[3].content).toMatch(/^algo para el sábado en la noche, somos 10\n\n\(Responde SOLO con JSON/);
  });

  it("usa las instrucciones propias de la configuración", async () => {
    fetchFalso.mockResolvedValueOnce(exito(JSON.stringify(salidaIA)));
    await new OpenRouterInterprete().interpretar({ ...pedido, config: { ...CONFIG, prompt: "Instrucciones del admin." } });
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).messages[0].content.startsWith("Instrucciones del admin.")).toBe(true);
  });

  it("prueba como máximo 2 modelos (un chat no puede esperar mucho)", async () => {
    fetchFalso.mockResolvedValue(respuesta({ error: { message: "Rate limit" } }, 429));
    const r = await new OpenRouterInterprete().interpretar(pedido);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(r.interpretacion).toBeNull();
    expect(r.ia).toEqual(expect.objectContaining({ estado: "error", modelo_usado: null }));
    expect(r.ia?.error).toContain("Rate limit");
  });

  it("si el principal responde sin formato, usa el de respaldo", async () => {
    fetchFalso
      .mockResolvedValueOnce(exito("no sé"))
      .mockResolvedValueOnce(exito("```json\n" + JSON.stringify({ intencion: "duda", respuesta: "Por Yape.", filtros: {} }) + "\n```", "nvidia/nemotron-3.5-super-vl:free"));
    const r = await new OpenRouterInterprete().interpretar(pedido);
    expect(r.interpretacion?.respuesta).toBe("Por Yape.");
    expect(r.ia).toEqual(expect.objectContaining({ estado: "fallback_used", modelo_usado: "nvidia/nemotron-3.5-super-vl:free" }));
    expect(r.ia?.error).toContain("respuesta sin el formato esperado");
  });

  it("sin clave no llama a nadie", async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(await new OpenRouterInterprete().interpretar(pedido)).toEqual({ interpretacion: null, ia: null });
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("pedirJSON", () => {
  const base = { mensajes: [], esquema: { nombre: "x", schema: {} }, validar: (j: unknown) => j, tiempoPorModeloMs: 1000, etiqueta: "prueba" };

  it("no repite modelos y marca el tiempo agotado", async () => {
    fetchFalso.mockImplementation(async () => {
      const e = new Error("abortado");
      e.name = "AbortError";
      throw e;
    });
    const r = await pedirJSON({ ...base, config: { ...CONFIG, respaldo: [CONFIG.modelo, "otro:free"] } });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(r?.ia).toEqual(expect.objectContaining({ estado: "timeout" }));
    expect(r?.ia.error).toContain("tardó más de 1 s");
  });

  it("modelos de pago: solo proveedores que no guardan datos", async () => {
    fetchFalso.mockResolvedValueOnce(exito({ ok: true }, "openai/gpt-x"));
    const r = await pedirJSON({ ...base, config: { ...CONFIG, modelo: "openai/gpt-x", respaldo: [] } });
    expect(r?.datos).toEqual({ ok: true }); // contenido que ya viene como objeto
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).provider).toEqual({ require_parameters: true, data_collection: "deny" });
  });

  it("una respuesta que no es JSON cuenta como error", async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new Error("html")) } as unknown as Response);
    const r = await pedirJSON({ ...base, config: { ...CONFIG, respaldo: [] } });
    expect(r?.datos).toBeNull();
    expect(r?.ia.error).toContain("HTTP 200");
  });
});

describe("SupabaseControlIA", () => {
  it("lee el cupo, la configuración y registra cada llamada", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_cupo_asistente: { data: { permitido: true, motivo: null, usados_cuenta: 2, limite_cuenta: 10 } },
      fn_config_ia: { data: { modelo: "m:free", respaldo: ["r:free"], temperatura: 0.2, max_tokens: 1500, prompt: null, version: "asistente-v1" } },
    });
    const control = new SupabaseControlIA(db);
    expect(await control.cupo()).toEqual({ permitido: true, motivo: null, limiteCuenta: 10 });
    expect(await control.config()).toEqual({ modelo: "m:free", respaldo: ["r:free"], temperatura: 0.2, maxTokens: 1500, prompt: null, version: "asistente-v1" });
    expect(rpc).toHaveBeenCalledWith("fn_config_ia", { p_funcion: "chat_assistant" });
    const registro = { modelo_pedido: "m:free", modelo_usado: null, generacion: null, tokens_entrada: null, tokens_salida: null, costo_usd: null, latencia_ms: 10, estado: "error" as const, error: "x" };
    await control.registrar(registro);
    expect(rpc).toHaveBeenCalledWith("fn_registrar_ia_asistente", { p_ia: registro });
  });

  it("errores: el cupo y el registro avisan; la configuración devuelve null", async () => {
    const err = { error: { message: "falta la función" } };
    const control = new SupabaseControlIA(crearSupabaseFalso({ fn_cupo_asistente: err, fn_config_ia: err, fn_registrar_ia_asistente: err }).db);
    await expect(control.cupo()).rejects.toThrow("falta la función");
    expect(await control.config()).toBeNull();
    await expect(control.registrar({} as never)).rejects.toThrow("falta la función");
  });

  it("aCupo entiende solo motivos conocidos", () => {
    expect(aCupo({ permitido: false, motivo: "CUPO_DIA", limite_cuenta: 10 })).toEqual({ permitido: false, motivo: "CUPO_DIA", limiteCuenta: 10 });
    expect(aCupo({ permitido: "true", motivo: "OTRO" })).toEqual({ permitido: false, motivo: null, limiteCuenta: 0 });
    expect(aCupo(null)).toEqual({ permitido: false, motivo: null, limiteCuenta: 0 });
  });

  it("leerUsoIAHoy (panel del admin)", async () => {
    const { db } = crearSupabaseFalso({ fn_uso_ia_hoy: { data: { asistente: 7, asistente_fallidos: 1, comprobantes: 3, limite_asistente: 30, limite_openrouter: 50 } } });
    expect(await leerUsoIAHoy(db)).toEqual({ asistente: 7, asistenteFallidos: 1, comprobantes: 3, limiteAsistente: 30, limiteOpenRouter: 50 });
    expect(await leerUsoIAHoy(crearSupabaseFalso({ fn_uso_ia_hoy: { error: { message: "SOLO_ADMIN" } } }).db)).toBeNull();
    expect(await leerUsoIAHoy(crearSupabaseFalso({ fn_uso_ia_hoy: { data: {} } }).db)).toEqual({ asistente: 0, asistenteFallidos: 0, comprobantes: 0, limiteAsistente: 0, limiteOpenRouter: 0 });
  });
});

describe("límite de mensajes por IP", () => {
  it("permite hasta el máximo en la ventana y luego vuelve a empezar", () => {
    const permitir = crearLimite({ maximo: 3, ventanaMs: 60_000 });
    expect([1, 2, 3, 4].map(() => permitir("1.1.1.1", 1000))).toEqual([true, true, true, false]);
    expect(permitir("2.2.2.2", 1000)).toBe(true); // cada IP lleva su cuenta
    expect(permitir("1.1.1.1", 61_000)).toBe(true); // ventana nueva
  });

  it("limpia las cuentas vencidas cuando hay muchas", () => {
    const permitir = crearLimite({ maximo: 1, ventanaMs: 10 });
    for (let i = 0; i <= 5001; i++) permitir(`ip-${i}`, 0);
    expect(permitir("ip-0", 100)).toBe(true);
  });

  it("ipDe toma la primera IP de x-forwarded-for", () => {
    expect(ipDe(new Request("http://x", { headers: { "x-forwarded-for": "200.1.1.1, 10.0.0.1" } }))).toBe("200.1.1.1");
    expect(ipDe(new Request("http://x", { headers: { "x-real-ip": "200.2.2.2" } }))).toBe("200.2.2.2");
    expect(ipDe(new Request("http://x"))).toBe("desconocida");
  });
});
