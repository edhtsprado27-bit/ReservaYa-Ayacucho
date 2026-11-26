// Límite de pedidos por clave (por ejemplo, la IP) en una ventana de tiempo,
// guardado en la memoria del servidor. Sirve para frenar abusos de rutas
// públicas sin Redis (ADR-013): cada instancia lleva su propia cuenta, así que
// es un freno aproximado, no una garantía. Capa: infraestructura.

export function crearLimite({ maximo, ventanaMs }: { maximo: number; ventanaMs: number }) {
  const cuentas = new Map<string, { n: number; vence: number }>();
  return function permitir(clave: string, ahora = Date.now()): boolean {
    if (cuentas.size > 5000) for (const [k, v] of cuentas) if (v.vence <= ahora) cuentas.delete(k);
    const c = cuentas.get(clave);
    if (!c || c.vence <= ahora) {
      cuentas.set(clave, { n: 1, vence: ahora + ventanaMs });
      return true;
    }
    c.n += 1;
    return c.n <= maximo;
  };
}

/** IP de quien pide (Vercel la pone primero en x-forwarded-for) */
export const ipDe = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconocida";
