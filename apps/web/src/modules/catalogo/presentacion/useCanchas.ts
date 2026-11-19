"use client";

// Capa: presentación (navegador). Llama a la API REST del catálogo.
// Para usar en las pantallas del navegador:
//   const { canchas, cargando, error, recargar } = useCanchas();
//   const r = await proponerCancha({ nombre, distrito, lat, lng, ... });
//   await editarPropuesta(id, datos)  /  await quitarPropuesta(id)   (solo canchas en revisión)

import { useCallback, useEffect, useState } from "react";
import type { CanchaBD, NuevaCancha } from "../dominio/cancha";

type Estado = { canchas: CanchaBD[]; cargando: boolean; error: string | null };

async function pedirCanchas(): Promise<CanchaBD[]> {
  const res = await fetch("/api/canchas", { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "No se pudieron cargar las canchas.");
  return json.canchas as CanchaBD[];
}

export function useCanchas() {
  const [estado, setEstado] = useState<Estado>({ canchas: [], cargando: true, error: null });

  const cargar = useCallback(async () => {
    try {
      const canchas = await pedirCanchas();
      setEstado({ canchas, cargando: false, error: null });
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false, error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    // La primera carga ocurre al abrir la pantalla
    cargar();
  }, [cargar]);

  const recargar = useCallback(() => {
    setEstado((s) => ({ ...s, cargando: true }));
    return cargar();
  }, [cargar]);

  return { ...estado, recargar };
}

export type ResultadoPropuesta =
  { ok: true; id: string; slug: string; estado: string } | { ok: false; error: string; codigo: string };

export type ResultadoSimple = { ok: true } | { ok: false; error: string; codigo: string };

async function llamar<T>(url: string, metodo: "POST" | "PUT" | "DELETE", cuerpo?: unknown): Promise<T> {
  try {
    const res = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!json) return { ok: false, error: "Respuesta inválida del servidor.", codigo: "DESCONOCIDO" } as T;
    return json as T;
  } catch {
    return {
      ok: false,
      error: "Sin conexión con el servidor. ¿Está corriendo npm run dev?",
      codigo: "SIN_CONEXION",
    } as T;
  }
}

// Envía una cancha nueva a Supabase. Queda en revisión hasta que el admin la apruebe.
export function proponerCancha(c: NuevaCancha): Promise<ResultadoPropuesta> {
  return llamar<ResultadoPropuesta>("/api/canchas", "POST", c);
}

// Corrige una cancha que sigue en revisión. Devuelve un id nuevo.
export function editarPropuesta(id: string, c: NuevaCancha): Promise<ResultadoPropuesta> {
  return llamar<ResultadoPropuesta>(`/api/canchas/${encodeURIComponent(id)}`, "PUT", c);
}

// Quita una cancha que sigue en revisión.
export function quitarPropuesta(id: string): Promise<ResultadoSimple> {
  return llamar<ResultadoSimple>(`/api/canchas/${encodeURIComponent(id)}`, "DELETE");
}
