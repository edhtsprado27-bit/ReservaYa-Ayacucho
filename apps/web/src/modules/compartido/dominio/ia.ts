// Tipos comunes de la IA (OpenRouter): configuración del modelo y registro
// de cada llamada. Los usan la lectura de comprobantes (pagos) y el
// asistente. Capa: dominio (solo tipos).

/** Fila de ai_model_configs (sin la clave: esa vive solo en el servidor) */
export type ConfigIA = {
  modelo: string;
  respaldo: string[];
  temperatura: number;
  maxTokens: number;
  prompt: string | null;
  version: string | null;
};

/** Lo que se guarda de cada llamada a la IA (tabla ai_requests) */
export type RegistroIA = {
  modelo_pedido: string;
  modelo_usado: string | null;
  generacion: string | null;
  tokens_entrada: number | null;
  tokens_salida: number | null;
  costo_usd: number | null;
  latencia_ms: number;
  estado: "success" | "fallback_used" | "error" | "timeout";
  error: string | null;
};

/** Convierte la respuesta de fn_config_ia (o null si no hay configuración) */
export function aConfigIA(data: unknown): ConfigIA | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!d.modelo) return null;
  return {
    modelo: String(d.modelo),
    respaldo: Array.isArray(d.respaldo) ? d.respaldo.map(String) : [],
    temperatura: Number(d.temperatura ?? 0),
    maxTokens: Number(d.max_tokens ?? 1000),
    prompt: typeof d.prompt === "string" && d.prompt.trim() ? d.prompt : null,
    version: typeof d.version === "string" ? d.version : null,
  };
}

/** Texto de la IA -> objeto. Algunos modelos envuelven el JSON en ```json ... ``` */
export function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(limpio);
  } catch {
    const i = limpio.indexOf("{");
    const j = limpio.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(limpio.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
