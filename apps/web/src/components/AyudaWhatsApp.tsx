// Botón flotante "Ayuda" en todas las páginas (RF15): abre un chat de WhatsApp
// con el número de ayuda que el admin configura en /admin. Si todavía no hay
// número, no se muestra. Es un enlace wa.me: no usa la API de WhatsApp.

import { connection } from "next/server";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { ajustesPublicos } from "@/modules/soporte/infraestructura/composicion";

export default async function AyudaWhatsApp() {
  // Se arma en cada visita (el número se lee de la caché "use cache", no de la base)
  await connection();
  const { whatsappSoporte } = await ajustesPublicos();
  const href = enlaceWhatsApp(whatsappSoporte, MENSAJES_WHATSAPP.ayuda());
  if (!href) return null;
  return (
    <a className="ayuda-wsp" href={href} target="_blank" rel="noopener noreferrer" aria-label="Ayuda por WhatsApp" title="Ayuda por WhatsApp">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5z" />
        <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2.1-2.4 3.3" />
        <path d="M12 16.2h.01" />
      </svg>
      <span>Ayuda</span>
    </a>
  );
}
