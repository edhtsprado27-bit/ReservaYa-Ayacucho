// Reglas de la captura y textos de los pagos (módulo pagos, dominio).
import { MAX_BYTES, tipoDeImagen } from "@/modules/pagos/dominio/imagen";
import { celularTexto, RESULTADO_CORTO, resultadoParaJugador } from "@/modules/pagos/dominio/pago";
import { PNG } from "../../apoyo/supabase-falso";

describe("tipoDeImagen (revisa el contenido real del archivo)", () => {
  it("reconoce JPG, PNG y WEBP", () => {
    expect(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(tipoDeImagen(PNG)).toEqual({ mime: "image/png", ext: "png" });
    const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0]);
    expect(tipoDeImagen(webp)).toEqual({ mime: "image/webp", ext: "webp" });
  });
  it("rechaza otros archivos aunque se llamen .png", () => {
    expect(tipoDeImagen(new TextEncoder().encode("hola mundo, no soy imagen"))).toBeNull();
    expect(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });
  it("el límite es 3 MB", () => {
    expect(MAX_BYTES).toBe(3 * 1024 * 1024);
  });
});

describe("textos del pago", () => {
  it("explica al jugador cada resultado de la lectura", () => {
    expect(resultadoParaJugador("match", null, 50)).toMatch(/Solo falta que el local lo confirme/);
    expect(resultadoParaJugador("amount_mismatch", { app: null, monto: 30, operacion: null, fecha: null, destinatario: null }, 50)).toBe(
      "El monto que leímos (S/ 30) es menor que el adelanto (S/ 50). El local lo revisará.",
    );
    for (const r of ["recipient_mismatch", "date_out_of_range", "duplicate_operation", "unreadable"] as const) {
      expect(resultadoParaJugador(r, null, 50)).toMatch(/local/);
    }
    expect(resultadoParaJugador(null, null, 50)).toBe("El local revisará tu comprobante.");
    expect(Object.keys(RESULTADO_CORTO)).toHaveLength(6);
  });
  it("formatea el celular", () => {
    expect(celularTexto("966123456")).toBe("966 123 456");
    expect(celularTexto(null)).toBe("");
  });
});
