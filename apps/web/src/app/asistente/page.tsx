// Asistente de canchas (RF09, HU08): busca canchas libres y responde dudas.
// Cualquiera puede usarlo; con sesión, la IA entiende preguntas más libres.

import type { Metadata } from "next";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import AsistenteCliente from "@/components/asistente/AsistenteCliente";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";

export const metadata: Metadata = {
  title: "Asistente · ReservaYa Ayacucho",
  description: "Pregunta en tus palabras y encuentra una cancha libre en Huamanga.",
};

async function Chat() {
  const perfil = await obtenerPerfil();
  return <AsistenteCliente conSesion={Boolean(perfil)} />;
}

export default function AsistentePage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <div className="titulo">
          <h1>Asistente de canchas</h1>
          <p>Dime qué quieres jugar, dónde y cuándo. Te muestro las canchas libres y respondo tus dudas.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando el asistente…</p>}>
          <Chat />
        </Suspense>
      </main>
    </>
  );
}
