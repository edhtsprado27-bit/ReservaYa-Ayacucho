// Supabase falso para las pruebas: responde a rpc(), storage y auth con datos
// fijos y guarda cada llamada para revisarla después. No usa la red.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RespuestaRpc = { data?: unknown; error?: { message?: string; code?: string } | null };

export function crearSupabaseFalso(respuestas: Record<string, RespuestaRpc | ((params: Record<string, unknown>) => RespuestaRpc)> = {}) {
  const rpc = jest.fn(async (fn: string, params: Record<string, unknown> = {}) => {
    const r = respuestas[fn];
    const valor = typeof r === "function" ? r(params) : r;
    return { data: valor?.data ?? null, error: valor?.error ?? null };
  });

  const upload = jest.fn(async () => ({ error: null as null | { message: string } }));
  const createSignedUrls = jest.fn(async (rutas: string[]) => ({
    data: rutas.map((path) => ({ path, signedUrl: `https://firmado.test/${path}` })),
  }));
  const storage = { from: jest.fn(() => ({ upload, createSignedUrls })) };

  const getUser = jest.fn(async () => ({ data: { user: { id: "55555555-5555-4555-8555-555555555555" } } }));

  // Consulta encadenada db.from("tabla").select().eq().eq().order()
  const filasTabla: unknown[] = [];
  type Consulta = { select: jest.Mock; eq: jest.Mock; order: jest.Mock };
  const consulta: Consulta = {
    select: jest.fn((): Consulta => consulta),
    eq: jest.fn((): Consulta => consulta),
    order: jest.fn(async () => ({ data: filasTabla, error: null })),
  };
  const from = jest.fn(() => consulta);

  const db = { rpc, storage, auth: { getUser }, from } as unknown as SupabaseClient;
  return { db, rpc, upload, createSignedUrls, getUser, from, consulta, filasTabla };
}

// Imagen PNG mínima (cabecera válida)
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

export const ID_LOCAL = "11111111-1111-4111-8111-111111111111";
export const ID_CANCHA = "22222222-2222-4222-8222-222222222222";
export const ID_RESERVA = "33333333-3333-4333-8333-333333333333";
export const ID_PAGO = "44444444-4444-4444-8444-444444444444";
