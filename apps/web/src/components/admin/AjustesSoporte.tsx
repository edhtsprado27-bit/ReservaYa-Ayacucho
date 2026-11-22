"use client";

// WhatsApp de ayuda de la plataforma (RF15). El número que se guarda aquí sale
// en el botón "Ayuda" de todas las páginas, en la página de cuenta suspendida
// y en el aviso de local suspendido. Vacío = se oculta el botón.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { llamarApi } from "@/modules/compartido/presentacion/llamar-api";
import { celularTexto } from "@/modules/pagos/dominio/pago";

type Aviso = { error: boolean; texto: string } | null;

export default function AjustesSoporte({ whatsappSoporte }: { whatsappSoporte: string | null }) {
  const router = useRouter();
  const [numero, setNumero] = useState(celularTexto(whatsappSoporte?.replace(/^\+51/, "") ?? ""));
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const prueba = enlaceWhatsApp(whatsappSoporte, MENSAJES_WHATSAPP.ayuda());

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    const r = await llamarApi<{ ajustes: { whatsappSoporte: string | null } }>("/api/admin/ajustes", "PUT", { whatsappSoporte: numero });
    setEnviando(false);
    if (!r.ok) return setAviso({ error: true, texto: r.error });
    const nuevo = r.datos.ajustes.whatsappSoporte;
    setNumero(celularTexto(nuevo?.replace(/^\+51/, "") ?? ""));
    setAviso({
      error: false,
      texto: nuevo
        ? `Listo: el botón “Ayuda” de toda la web abre WhatsApp con el ${celularTexto(nuevo.replace(/^\+51/, ""))}.`
        : "Listo: se quitó el botón “Ayuda” de la web.",
    });
    router.refresh();
  }

  return (
    <form className="config-form" onSubmit={guardar}>
      <label className="config-campo">
        Celular de ayuda (WhatsApp)
        <input
          className="campo"
          id="whatsapp-soporte"
          inputMode="tel"
          placeholder="9XX XXX XXX"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <span className="meta">Déjalo vacío para quitar el botón. No usa la API de WhatsApp ni tiene costo.</span>
      </label>
      <div className="config-ancho config-pie">
        <button type="submit" className="boton boton--naranja" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        {prueba && (
          <a className="enlace-wsp" href={prueba} target="_blank" rel="noopener noreferrer">
            Probar el enlace
          </a>
        )}
        {aviso && (
          <p className={`aviso ${aviso.error ? "aviso--error" : "aviso--ok"}`} role={aviso.error ? "alert" : "status"}>
            {aviso.texto}
          </p>
        )}
      </div>
    </form>
  );
}
