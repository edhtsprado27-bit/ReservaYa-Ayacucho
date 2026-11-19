// Reglas de la captura del comprobante. Capa: dominio (funciones puras).

export const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

export type TipoImagen = { mime: string; ext: "jpg" | "png" | "webp" };

const empiezaCon = (b: Uint8Array, firma: number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);
const texto = (b: Uint8Array, desde: number, hasta: number) => String.fromCharCode(...b.subarray(desde, hasta));

/** Revisa el contenido real del archivo (no solo su nombre): JPG, PNG o WEBP */
export function tipoDeImagen(b: Uint8Array): TipoImagen | null {
  if (b.length > 3 && empiezaCon(b, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (b.length > 12 && texto(b, 0, 4) === "RIFF" && texto(b, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
