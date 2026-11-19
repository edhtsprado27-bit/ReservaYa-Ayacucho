"use client";

import { useState } from "react";
import { clienteNavegador } from "@/modules/compartido/infraestructura/supabase/cliente-navegador";

export default function BotonSalir() {
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await clienteNavegador().auth.signOut();
    // La sesión cambió: carga completa para que ninguna parte quede con la sesión anterior
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <button type="button" className="boton boton--claro" onClick={salir} disabled={saliendo}>
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
