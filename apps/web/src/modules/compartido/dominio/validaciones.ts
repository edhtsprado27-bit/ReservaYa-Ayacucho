// Validaciones de formato que usan varios módulos. Funciones puras.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,140}$/;

/** ¿Es un identificador UUID (el formato de los id de la base de datos)? */
export const esUUID = (id: string) => UUID.test(id);

/** ¿Es un slug de local válido? (minúsculas, números y guiones) */
export const esSlug = (slug: string) => SLUG.test(slug);
