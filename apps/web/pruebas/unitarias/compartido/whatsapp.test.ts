// Enlaces de WhatsApp (RF15): wa.me con el mensaje ya escrito, sin API ni costo.
import { celularPeruano, enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { enlaceWhatsApp as desdeAgenda } from "@/modules/agenda/dominio/agenda";

describe("enlaces de WhatsApp", () => {
  it("acepta el celular con espacios, guiones o +51", () => {
    expect(celularPeruano("966 123 456")).toBe("966123456");
    expect(celularPeruano("+51 966-123-456")).toBe("966123456");
    expect(celularPeruano("51966123456")).toBe("966123456");
    expect(celularPeruano("066312345")).toBeNull();
    expect(celularPeruano(undefined)).toBeNull();
  });

  it("arma el enlace wa.me con el texto codificado", () => {
    expect(enlaceWhatsApp("+51966123456")).toBe("https://wa.me/51966123456");
    expect(enlaceWhatsApp("966123456", "¿Hay cancha a las 7?")).toBe(
      "https://wa.me/51966123456?text=%C2%BFHay%20cancha%20a%20las%207%3F",
    );
    expect(enlaceWhatsApp(null, "hola")).toBeNull();
    expect(enlaceWhatsApp("123")).toBeNull();
  });

  it("la agenda usa el mismo enlace (se movió a compartido)", () => {
    expect(desdeAgenda).toBe(enlaceWhatsApp);
  });

  it("mensajes ya escritos", () => {
    const m = MENSAJES_WHATSAPP;
    expect(m.consultaLocal("Complejo Los Andes")).toBe("Hola, vi Complejo Los Andes en ReservaYa Ayacucho y quiero hacer una consulta.");
    expect(m.sobreReserva("RY-4K7P", "Cancha 1", "Jueves 20 de noviembre · 19:00 – 20:00")).toContain("RY-4K7P (Cancha 1, Jueves 20");
    expect(m.ayuda()).toBe("Hola, necesito ayuda con ReservaYa Ayacucho.");
    expect(m.ayuda("Mi cuenta")).toBe("Hola, necesito ayuda con ReservaYa Ayacucho (estoy en Mi cuenta).");
    expect(m.cuentaSuspendida("Ana Torres")).toContain("(Ana Torres) aparece suspendida");
    expect(m.cuentaSuspendida(null)).toContain("mi cuenta de ReservaYa Ayacucho aparece suspendida");
    expect(m.localSuspendido("La Bombonera")).toContain("mi local La Bombonera aparece suspendido");
    expect(m.pagoAlJugador("Luis Gamboa", "Los Andes", "RY-1")).toBe("Hola Luis, te escribimos de Los Andes por el pago de tu reserva RY-1.");
    expect(m.pagoAlJugador(null, "Los Andes", "RY-1")).toBe("Hola, te escribimos de Los Andes por el pago de tu reserva RY-1.");
    expect(m.adminAlDueno("Rosa Quispe", "Los Andes")).toBe("Hola Rosa, te escribimos del equipo de ReservaYa Ayacucho por tu local Los Andes.");
    expect(m.adminAlDueno(null, "Los Andes")).toMatch(/^Hola, te escribimos/);
    expect(m.adminAUsuario("Pedro Rojas")).toBe("Hola Pedro, te escribimos del equipo de ReservaYa Ayacucho.");
  });
});
