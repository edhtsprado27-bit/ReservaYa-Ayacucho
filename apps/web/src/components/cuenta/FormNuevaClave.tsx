"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clienteNavegador } from "@/lib/auth/cliente";

export default function FormNuevaClave() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
    if (clave !== repetir) return setMsg("Las dos contraseñas no coinciden.");
    setEnviando(true);
    setMsg("Guardando…");
    const { error } = await clienteNavegador().auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) {
      return setMsg(
        error.code === "same_password"
          ? "Usa una contraseña distinta a la anterior."
          : "No se pudo cambiar. Pide un enlace nuevo desde “¿Olvidaste tu contraseña?”.",
      );
    }
    setMsg("¡Contraseña actualizada!");
    router.replace("/mi-cuenta");
    router.refresh();
  }

  return (
    <form className="panel formulario-cuenta" onSubmit={guardar} noValidate>
      <label>
        Nueva contraseña
        <input className="campo" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </label>
      <label>
        Repite la contraseña
        <input className="campo" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      </label>
      <button className="boton boton--naranja" type="submit" disabled={enviando}>
        Guardar contraseña
      </button>
      <p className="meta" role="status">{msg}</p>
    </form>
  );
}
