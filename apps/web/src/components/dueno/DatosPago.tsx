"use client";

// Yape, Plin y titular de cada local: es lo que ve el jugador para pagar el adelanto.

import { useState, type FormEvent } from "react";
import { celularTexto, type LocalPago } from "@/lib/pagos/pagos";

function FormLocal({ local }: { local: LocalPago }) {
  const [yape, setYape] = useState(celularTexto(local.yape));
  const [plin, setPlin] = useState(celularTexto(local.plin));
  const [titular, setTitular] = useState(local.titular ?? "");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const res = await fetch(`/api/locales/${local.id}/pago`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yape, plin, titular }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setGuardando(false);
    if (!json?.ok) {
      setAviso({ error: true, texto: json?.error ?? "Sin conexión con el servidor." });
      return;
    }
    setYape(celularTexto(json.datos.yape));
    setPlin(celularTexto(json.datos.plin));
    setTitular(json.datos.titular ?? "");
    setAviso({ error: false, texto: "Guardado. Los jugadores ya ven estos datos al pagar." });
  }

  const id = (campo: string) => `pago-${campo}-${local.id}`;
  return (
    <form className="form-pago" onSubmit={guardar}>
      <strong>
        {local.nombre}
        {local.estado === "pending_review" ? <span className="etiqueta etiqueta--revision">En revisión</span> : null}
      </strong>
      <div className="form-pago-campos">
        <label htmlFor={id("yape")}>
          Yape
          <input id={id("yape")} className="campo" inputMode="tel" placeholder="9XX XXX XXX" value={yape} onChange={(e) => setYape(e.target.value)} />
        </label>
        <label htmlFor={id("plin")}>
          Plin (opcional)
          <input id={id("plin")} className="campo" inputMode="tel" placeholder="9XX XXX XXX" value={plin} onChange={(e) => setPlin(e.target.value)} />
        </label>
        <label htmlFor={id("titular")}>
          Titular (como aparece en la app)
          <input id={id("titular")} className="campo" placeholder="Ej.: Juan Pérez Quispe" value={titular} maxLength={120} onChange={(e) => setTitular(e.target.value)} />
        </label>
      </div>
      <p className="meta letra-chica">Adelanto que pide este local: {local.adelantoPct}% del total.</p>
      {aviso && (
        <p className={`aviso${aviso.error ? " aviso--error" : ""}`} role="status">
          {aviso.texto}
        </p>
      )}
      <div>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function DatosPago({ locales }: { locales: LocalPago[] }) {
  if (!locales.length) return <p className="meta">Cuando tengas canchas registradas, aquí pondrás tu Yape o Plin.</p>;
  return (
    <div className="lista-form-pago">
      {locales.map((l) => (
        <FormLocal key={l.id} local={l} />
      ))}
    </div>
  );
}
