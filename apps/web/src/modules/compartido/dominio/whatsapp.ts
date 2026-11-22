// Enlaces de WhatsApp (RF15). Son enlaces wa.me: abren el chat en el celular o
// en WhatsApp Web con el mensaje ya escrito. No usan la API de WhatsApp, no
// necesitan cuenta de empresa y no cuestan nada.
// Capa: dominio (funciones puras, se usan en el navegador y en el servidor).

/** Celular peruano en 9 dígitos (acepta espacios, guiones y +51), o null */
export function celularPeruano(telefono: string | null | undefined): string | null {
  const d = (telefono ?? "").replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, "");
  return /^9\d{8}$/.test(d) ? d : null;
}

/** https://wa.me/51<celular>?text=<mensaje>, o null si no parece un celular peruano */
export function enlaceWhatsApp(telefono: string | null | undefined, texto?: string): string | null {
  const d = celularPeruano(telefono);
  if (!d) return null;
  return `https://wa.me/51${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

// Mensajes que ya van escritos al abrir el chat (la persona puede cambiarlos)
export const MENSAJES_WHATSAPP = {
  /** Jugador -> local, desde la ficha del local */
  consultaLocal: (local: string) => `Hola, vi ${local} en ReservaYa Ayacucho y quiero hacer una consulta.`,
  /** Jugador -> local, desde su reserva */
  sobreReserva: (codigo: string, cancha: string, cuando: string) =>
    `Hola, tengo la reserva ${codigo} (${cancha}, ${cuando}) hecha en ReservaYa Ayacucho. Quería consultar:`,
  /** Cualquier persona -> soporte de la plataforma */
  ayuda: (pagina?: string) => `Hola, necesito ayuda con ReservaYa Ayacucho${pagina ? ` (estoy en ${pagina})` : ""}.`,
  /** Cuenta suspendida -> soporte */
  cuentaSuspendida: (nombre?: string | null) =>
    `Hola, mi cuenta de ReservaYa Ayacucho${nombre ? ` (${nombre})` : ""} aparece suspendida y quisiera revisarlo.`,
  /** Local suspendido -> soporte */
  localSuspendido: (local: string) => `Hola, mi local ${local} aparece suspendido en ReservaYa Ayacucho y quisiera revisarlo.`,
  /** Dueño -> jugador, por un pago en revisión */
  pagoAlJugador: (jugador: string | null, local: string, codigo: string) =>
    `Hola${jugador ? ` ${jugador.split(" ")[0]}` : ""}, te escribimos de ${local} por el pago de tu reserva ${codigo}.`,
  /** Admin -> dueño de un local */
  adminAlDueno: (dueno: string | null, local: string) =>
    `Hola${dueno ? ` ${dueno.split(" ")[0]}` : ""}, te escribimos del equipo de ReservaYa Ayacucho por tu local ${local}.`,
  /** Admin -> cualquier cuenta */
  adminAUsuario: (nombre: string) => `Hola ${nombre.split(" ")[0]}, te escribimos del equipo de ReservaYa Ayacucho.`,
};
