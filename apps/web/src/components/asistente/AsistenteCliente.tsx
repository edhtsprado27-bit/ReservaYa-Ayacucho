"use client";

// El chat se dibuja solo en el navegador: lee la conversación guardada en
// esta pestaña (sessionStorage), que no existe en el servidor.

import dynamic from "next/dynamic";

const ChatAsistente = dynamic(() => import("./ChatAsistente"), {
  ssr: false,
  loading: () => <p className="meta">Cargando el asistente…</p>,
});

export default function AsistenteCliente({ conSesion }: { conSesion: boolean }) {
  return <ChatAsistente conSesion={conSesion} />;
}
