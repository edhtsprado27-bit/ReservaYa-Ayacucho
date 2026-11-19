// A dónde volver después de iniciar sesión.
// Solo se aceptan rutas de esta misma web (evita redirecciones a otros sitios).

export function destinoSeguro(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login") || next.startsWith("/auth")) return "/";
  return next;
}
