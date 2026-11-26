// Intérprete del asistente con IA (OpenRouter): adaptador del puerto
// InterpreteIA (patrón Adapter). Capa: infraestructura. SOLO en el servidor.
// Le da a la IA la fecha, los distritos, los servicios, las preguntas
// frecuentes y la conversación; la IA devuelve un JSON con la intención y
// los filtros, que se valida antes de usarlo (nunca se confía a ciegas).

import "server-only";
import { pedirJSON, type MensajeIA } from "@/modules/compartido/infraestructura/openrouter";
import { validarInterpretacionIA } from "../dominio/asistente";
import type { InterpreteIA, PedidoInterprete, ResultadoInterprete } from "../dominio/asistente.puertos";
import { construirInstrucciones, ESQUEMA_INTERPRETACION, RECORDATORIO_FORMATO } from "../dominio/instrucciones-ia";

// Un chat no puede hacer esperar mucho: 12 s por modelo y solo 2 modelos
const TIEMPO_POR_MODELO_MS = 12_000;

export class OpenRouterInterprete implements InterpreteIA {
  async interpretar(p: PedidoInterprete): Promise<ResultadoInterprete> {
    const mensajes: MensajeIA[] = [
      { role: "system", content: construirInstrucciones({ ...p, base: p.config.prompt }) },
      ...p.historial.map((m): MensajeIA => ({ role: m.rol === "persona" ? "user" : "assistant", content: m.texto })),
      { role: "user", content: `${p.mensaje}\n\n(${RECORDATORIO_FORMATO})` },
    ];
    const r = await pedirJSON({
      config: { ...p.config, respaldo: p.config.respaldo.slice(0, 1) },
      mensajes,
      esquema: { nombre: "interpretacion", schema: ESQUEMA_INTERPRETACION },
      validar: (json) => validarInterpretacionIA(json, p.hoy),
      tiempoPorModeloMs: TIEMPO_POR_MODELO_MS,
      etiqueta: "asistente",
    });
    return r ? { interpretacion: r.datos, ia: r.ia } : { interpretacion: null, ia: null };
  }
}
