"use client";

import { useState } from "react";
import { clienteNavegador } from "@/modules/compartido/infraestructura/supabase/cliente-navegador";

export default function FormNuevaClave() {
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
    // La sesión cambió: carga completa para que ninguna parte quede con la sesión anterior
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/mi-cuenta");
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
