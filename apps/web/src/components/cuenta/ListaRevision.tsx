"use client";

// Lista de canchas por aprobar (panel del administrador).

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CanchaBD } from "@/lib/canchas-db";

type Estado = { tipo: "listo" | "error"; texto: string };

export default function ListaRevision({ inicial }: { inicial: CanchaBD[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(inicial);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<Estado | null>(null);

  async function revisar(c: CanchaBD, accion: "aprobar" | "rechazar") {
    setTrabajando(c.id);
    setAviso(null);
    try {
      const res = await fetch(`/api/admin/locales/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, motivo: accion === "rechazar" ? motivo : undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setAviso({ tipo: "error", texto: json?.error ?? "No se pudo guardar. Inténtalo de nuevo." });
        return;
      }
      setLista((l) => l.filter((x) => x.id !== c.id));
      setRechazando(null);
      setMotivo("");
      setAviso({
        tipo: "listo",
        texto: accion === "aprobar" ? `"${c.nombre}" ya aparece en el mapa.` : `"${c.nombre}" fue rechazada.`,
      });
      router.refresh();
    } catch {
      setAviso({ tipo: "error", texto: "Sin conexión con el servidor." });
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <>
      {aviso && (
        <p className={`aviso${aviso.tipo === "error" ? " aviso--error" : ""}`} role="status">
          {aviso.texto}
        </p>
      )}
      {lista.length === 0 ? (
        <p className="meta">No hay canchas esperando aprobación.</p>
      ) : (
        <ul className="lista-revision">
          {lista.map((c) => (
            <li key={c.id} className="tarjeta-revision">
              <div>
                <strong>{c.nombre}</strong>
                <span className="meta">
                  {c.distrito} · {c.direccion}
                  {c.referencia ? ` · ${c.referencia}` : ""}
                </span>
                <span className="meta">
                  {c.deportes.join(", ")}
                  {c.techada ? " · techada" : ""}
                  {c.precioDesde ? ` · desde S/ ${c.precioDesde}/h` : ""}
                  {c.telefono ? ` · ${c.telefono}` : ""}
                </span>
                <a className="enlace-boton" href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=19/${c.lat}/${c.lng}`} target="_blank" rel="noopener noreferrer">
                  Ver ubicación en el mapa
                </a>
              </div>
              {rechazando === c.id ? (
                <div className="revision-rechazo">
                  <label>
                    Motivo (opcional)
                    <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. la ubicación no es correcta" />
                  </label>
                  <div className="revision-botones">
                    <button type="button" className="boton boton--peligro" disabled={trabajando === c.id} onClick={() => revisar(c, "rechazar")}>Rechazar</button>
                    <button type="button" className="boton boton--claro" onClick={() => setRechazando(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="revision-botones">
                  <button type="button" className="boton boton--naranja" disabled={trabajando === c.id} onClick={() => revisar(c, "aprobar")}>
                    {trabajando === c.id ? "Guardando…" : "Aprobar"}
                  </button>
                  <button type="button" className="boton boton--claro" disabled={trabajando === c.id} onClick={() => { setRechazando(c.id); setMotivo(""); }}>
                    Rechazar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
