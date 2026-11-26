// Cliente de OpenRouter compartido (lo usan la lectura de comprobantes y el
// asistente). Capa: infraestructura. SOLO en el servidor: la clave
// OPENROUTER_API_KEY nunca llega al navegador.
//
// - Prueba el modelo principal y hasta dos de respaldo (tabla ai_model_configs).
// - Pide la respuesta en JSON con un esquema fijo y la valida igual (algunos
//   modelos gratis ignoran el esquema o envuelven el JSON en ```json).
// - Modelos de pago: solo proveedores que no guardan ni entrenan con los datos
//   (data_collection: deny). Los gratis no aceptan ese filtro (009_ia_gratis.sql).
// - Devuelve también el registro de la llamada (modelo, tokens, costo, tiempo).

import "server-only";
import { extraerJSON, type ConfigIA, type RegistroIA } from "../dominio/ia";

const URL_BASE = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export const iaConfigurada = () => Boolean(process.env.OPENROUTER_API_KEY);

// Los modelos gratis tienen un solo proveedor y no aceptan filtros de privacidad
// ni siempre el JSON Schema: se piden sin esas exigencias y el JSON se valida igual.
export const esGratis = (modelo: string) => modelo.endsWith(":free") || modelo === "openrouter/free";

export type MensajeIA = { role: "system" | "user" | "assistant"; content: string | unknown[] };

export type PedidoJSON<T> = {
  config: ConfigIA;
  mensajes: MensajeIA[];
  esquema: { nombre: string; schema: Record<string, unknown> };
  /** Recibe el JSON ya leído; devuelve null si no tiene el formato esperado */
  validar: (json: unknown) => T | null;
  tiempoPorModeloMs: number;
  /** Para el registro del servidor: "ocr", "asistente"... */
  etiqueta: string;
};

export type ResultadoJSON<T> = { datos: T | null; ia: RegistroIA };

// Parte de la respuesta de OpenRouter que se usa
type RespuestaOpenRouter = {
  id?: string;
  model?: string;
  error?: { message?: string };
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** null si no hay clave configurada (no se llama a nadie) */
export async function pedirJSON<T>(p: PedidoJSON<T>): Promise<ResultadoJSON<T> | null> {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave || !p.config.modelo) return null;

  const { config } = p;
  const modelos = [config.modelo, ...config.respaldo.filter((m) => m && m !== config.modelo)].slice(0, 3);
  const inicio = Date.now();
  const errores: string[] = [];
  let huboTimeout = false;

  for (const [i, modelo] of modelos.entries()) {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), p.tiempoPorModeloMs);
    try {
      const res = await fetch(`${URL_BASE}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITIO_URL ?? "https://reservaya-ayacucho.vercel.app",
          "X-Title": "ReservaYa Ayacucho",
        },
        body: JSON.stringify({
          model: modelo,
          temperature: config.temperatura,
          max_tokens: config.maxTokens,
          messages: p.mensajes,
          response_format: { type: "json_schema", json_schema: { name: p.esquema.nombre, strict: true, schema: p.esquema.schema } },
          provider: esGratis(modelo) ? { require_parameters: false } : { require_parameters: true, data_collection: "deny" },
        }),
      });
      const json = (await res.json().catch(() => null)) as RespuestaOpenRouter | null;
      if (!res.ok || !json || json.error) {
        throw new Error(`${modelo}: ${json?.error?.message ?? `HTTP ${res.status}`}`);
      }
      const contenido = json.choices?.[0]?.message?.content;
      const datos = p.validar(typeof contenido === "string" ? extraerJSON(contenido) : contenido);
      if (datos === null) throw new Error(`${modelo}: respuesta sin el formato esperado`);

      return {
        datos,
        ia: {
          modelo_pedido: modelos[0],
          modelo_usado: typeof json.model === "string" ? json.model : modelo,
          generacion: typeof json.id === "string" ? json.id : null,
          tokens_entrada: numero(json.usage?.prompt_tokens),
          tokens_salida: numero(json.usage?.completion_tokens),
          costo_usd: numero(json.usage?.cost),
          latencia_ms: Date.now() - inicio,
          estado: i === 0 ? "success" : "fallback_used",
          error: errores.length ? errores.join(" | ").slice(0, 500) : null,
        },
      };
    } catch (e) {
      const abortado = (e as Error).name === "AbortError";
      huboTimeout ||= abortado;
      errores.push(abortado ? `${modelo}: tardó más de ${p.tiempoPorModeloMs / 1000} s` : (e as Error).message);
    } finally {
      clearTimeout(reloj);
    }
  }

  console.error(`[${p.etiqueta}] La IA no respondió:`, errores.join(" | "));
  return {
    datos: null,
    ia: {
      modelo_pedido: modelos[0],
      modelo_usado: null,
      generacion: null,
      tokens_entrada: null,
      tokens_salida: null,
      costo_usd: null,
      latencia_ms: Date.now() - inicio,
      estado: huboTimeout ? "timeout" : "error",
      error: errores.join(" | ").slice(0, 500),
    },
  };
}
