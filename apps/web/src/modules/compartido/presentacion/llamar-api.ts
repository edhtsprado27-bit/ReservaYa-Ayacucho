// Llamada a la API desde el navegador con el mismo manejo de errores en
// todas las pantallas: { ok: true, datos } o { ok: false, error } con un
// mensaje listo para mostrar (el que manda el servidor o uno de conexión).

export type RespuestaApi<T = Record<string, unknown>> = { ok: true; datos: T } | { ok: false; error: string };

export async function llamarApi<T = Record<string, unknown>>(url: string, metodo: string, cuerpo?: unknown): Promise<RespuestaApi<T>> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  if (res?.ok && json?.ok) return { ok: true, datos: json as T };
  return { ok: false, error: json?.error ?? "Sin conexión con el servidor. Inténtalo otra vez." };
}
