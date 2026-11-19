// Lista de "Mis reservas" (en Mi cuenta). Cada una abre su detalle.

import Link from "next/link";
import { ESTADO_TEXTO, type Reserva } from "@/modules/reservas/dominio/reserva";
import { fechaLarga, horaLima, soles } from "@/modules/reservas/dominio/tiempo";

export default function ListaReservas({ reservas }: { reservas: Reserva[] }) {
  return (
    <ul className="lista-reservas">
      {reservas.map((r) => (
        <li key={r.id}>
          <Link href={`/reservas/${r.id}`} className="item-reserva">
            <span className="item-reserva-fecha">
              <strong>{fechaLarga(r.inicio)}</strong>
              <span>
                {horaLima(r.inicio)} – {horaLima(r.fin)}
              </span>
            </span>
            <span className="item-reserva-lugar">
              <strong>{r.local}</strong>
              <span className="meta">
                {r.cancha} · {r.codigo} · {soles(r.total)}
              </span>
            </span>
            <span className={`estado estado--${r.estado}`}>{ESTADO_TEXTO[r.estado]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
