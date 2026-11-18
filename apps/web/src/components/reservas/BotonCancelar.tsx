"use client";

// Cancelar una reserva propia, con un paso de confirmación.

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { id: string; inicio: string; horasCancelacion: number; conPago: boolean };

export default function BotonCancelar({ id, inicio, horasCancelacion, conPago }: Props) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [tarde, setTarde] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    // ¿Faltan menos horas de las que pide el local para devolver el adelanto?
    setTarde(new Date(inicio).getTime() - Date.now() < horasCancelacion * 3_600_000);
    setConfirmando(true);
    setError(null);
  }

  async function cancelar() {
    setEnviando(true);
    const res = await fetch(`/api/reservas/${id}/cancelar`, { method: "POST" }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setEnviando(false);
    if (res?.ok && json?.ok) {
      setConfirmando(false);
      router.refresh();
      return;
    }
    setError(json?.error ?? "Sin conexión. Inténtalo de nuevo.");
    if (json?.codigo === "RESERVA_VENCIDA" || json?.codigo === "NO_SE_PUEDE_CANCELAR") router.refresh();
  }

  if (!confirmando) {
    return (
      <button type="button" className="boton boton--claro" onClick={abrir}>
        Cancelar reserva
      </button>
    );
  }
  return (
    <div className="confirmar-cancelar" role="alertdialog" aria-labelledby="t-cancelar">
      <p id="t-cancelar">
        <strong>¿Cancelar esta reserva?</strong> El horario quedará libre para otra persona.
      </p>
      {conPago && tarde && (
        <p className="aviso">
          Faltan menos de {horasCancelacion} horas: según las reglas del local, el adelanto no se devuelve.
        </p>
      )}
      {error && <p className="aviso aviso--error" role="alert">{error}</p>}
      <div className="acciones-cuenta">
        <button type="button" className="boton boton--peligro" onClick={cancelar} disabled={enviando}>
          {enviando ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button type="button" className="boton boton--claro" onClick={() => setConfirmando(false)} disabled={enviando}>
          No, mantener
        </button>
      </div>
    </div>
  );
}
