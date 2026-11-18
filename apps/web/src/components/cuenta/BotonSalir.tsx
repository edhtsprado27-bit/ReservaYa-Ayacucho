"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clienteNavegador } from "@/lib/auth/cliente";

export default function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await clienteNavegador().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" className="boton boton--claro" onClick={salir} disabled={saliendo}>
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
