"use client";

// Gestión de usuarios del administrador (RF08): buscar por nombre, correo o
// celular, filtrar por tipo, cambiar entre jugador y dueño, suspender con
// motivo (la persona lo ve al ingresar) y reactivar. Lo valida la base.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { llamarApi } from "@/modules/compartido/presentacion/llamar-api";
import { ROL_TEXTO } from "@/modules/cuentas/dominio/roles";
import { celularTexto } from "@/modules/pagos/dominio/pago";
import {
  ESTADO_USUARIO_TEXTO,
  fechaRegistro,
  FILTROS_USUARIOS,
  haceCuanto,
  MOTIVOS_SUSPENSION,
  type BusquedaUsuarios,
  type FiltroUsuarios,
  type UsuarioAdmin,
} from "@/modules/usuarios/dominio/usuarios";

type Aviso = { id: string; error: boolean; texto: string } | null;
type Props = { usuarios: UsuarioAdmin[]; busqueda: BusquedaUsuarios; ahora: string; error: string | null };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function UsuariosAdmin({ usuarios, busqueda, ahora, error }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState(busqueda.buscar ?? "");
  const [suspendiendo, setSuspendiendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const ir = (buscar: string, filtro: FiltroUsuarios) => {
    const p = new URLSearchParams();
    if (buscar.trim()) p.set("buscar", buscar.trim());
    if (filtro !== "todos") p.set("filtro", filtro);
    setAviso(null);
    router.push(`/admin/usuarios${p.size ? `?${p}` : ""}`);
  };

  async function patch(u: UsuarioAdmin, cuerpo: Record<string, string>, exito: (d: Record<string, unknown>) => string) {
    setEnviando(true);
    setAviso(null);
    const r = await llamarApi<{ usuario: Record<string, unknown> }>(`/api/admin/usuarios/${u.id}`, "PATCH", cuerpo);
    setEnviando(false);
    if (!r.ok) return setAviso({ id: u.id, error: true, texto: r.error });
    setSuspendiendo(null);
    setAviso({ id: u.id, error: false, texto: exito(r.datos.usuario) });
    router.refresh();
  }

  return (
    <>
      <form
        className="usuarios-busqueda"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          ir(texto, busqueda.filtro);
        }}
      >
        <input
          className="campo"
          type="search"
          aria-label="Buscar cuentas"
          placeholder="Nombre, correo o celular"
          value={texto}
          maxLength={80}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="boton">
          Buscar
        </button>
      </form>
      <div className="chips" role="group" aria-label="Tipo de cuenta">
        {FILTROS_USUARIOS.map((f) => (
          <button key={f.codigo} type="button" className="chip" aria-pressed={busqueda.filtro === f.codigo} onClick={() => ir(texto, f.codigo)}>
            {f.nombre}
          </button>
        ))}
      </div>

      {error ? (
        <p className="aviso aviso--error">{error}</p>
      ) : (
        <>
          {/* Si la cuenta ya no entra en el filtro (p. ej. se reactivó una "suspendida"), el aviso queda aquí */}
          {aviso && !usuarios.some((u) => u.id === aviso.id) && (
            <p className={`aviso ${aviso.error ? "aviso--error" : "aviso--ok"}`} role={aviso.error ? "alert" : "status"}>
              {aviso.texto}
            </p>
          )}
          <p className="resumen">
            {usuarios.length === 0
              ? "No hay cuentas con esa búsqueda."
              : `${plural(usuarios.length, "cuenta", "cuentas")}${usuarios.length === 100 ? " (las 100 más recientes: afina la búsqueda)" : ""}`}
          </p>
          <ul className="lista-revision">
            {usuarios.map((u) => {
              const gestionable = u.rol !== "admin" && !u.soyYo;
              const wsp = enlaceWhatsApp(u.telefono, MENSAJES_WHATSAPP.adminAUsuario(u.nombre));
              return (
                <li key={u.id} className={`usuario-admin${u.estado === "suspended" ? " usuario-admin--suspendido" : ""}`}>
                  <div className="usuario-admin-cabeza">
                    <strong>
                      {u.nombre}
                      {u.soyYo ? " (tú)" : ""}
                    </strong>
                    <span className="chips">
                      <span className="etiqueta-rol">{ROL_TEXTO[u.rol]}</span>
                      <span className={`estado estado--usuario-${u.estado}`}>{ESTADO_USUARIO_TEXTO[u.estado]}</span>
                    </span>
                  </div>
                  <span className="meta">
                    {u.correo ?? "Sin correo"}
                    {u.telefono ? ` · ${celularTexto(u.telefono)}` : ""}
                    {wsp && (
                      <>
                        {" · "}
                        <a className="enlace-wsp" href={wsp} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      </>
                    )}
                  </span>
                  <span className="meta">
                    Desde el {fechaRegistro(u.creado)} · último ingreso: {haceCuanto(u.ultimoIngreso, new Date(ahora))} ·{" "}
                    {plural(u.reservas, "reserva", "reservas")}
                    {u.rol === "dueno" ? ` · ${plural(u.locales, "local", "locales")}` : ""}
                  </span>
                  {u.estado === "suspended" && <span className="aviso aviso--error">Suspendida: {u.motivo ?? "sin motivo"}</span>}
                  {aviso?.id === u.id && (
                    <p className={`aviso ${aviso.error ? "aviso--error" : "aviso--ok"}`} role={aviso.error ? "alert" : "status"}>
                      {aviso.texto}
                    </p>
                  )}

                  {gestionable && suspendiendo !== u.id && (
                    <div className="revision-botones">
                      {u.rol === "jugador" && (
                        <button
                          type="button"
                          className="boton boton--claro boton--chico"
                          disabled={enviando}
                          onClick={() =>
                            patch(u, { accion: "cambiar_rol", rol: "dueno" }, () => `${u.nombre} ahora es dueño de cancha: ya puede registrar su local.`)
                          }
                        >
                          Hacer dueño
                        </button>
                      )}
                      {u.rol === "dueno" && u.locales === 0 && (
                        <button
                          type="button"
                          className="boton boton--claro boton--chico"
                          disabled={enviando}
                          onClick={() => patch(u, { accion: "cambiar_rol", rol: "jugador" }, () => `${u.nombre} ahora es jugador.`)}
                        >
                          Pasar a jugador
                        </button>
                      )}
                      {u.estado === "active" ? (
                        <button
                          type="button"
                          className="boton boton--claro boton--chico"
                          onClick={() => {
                            setSuspendiendo(u.id);
                            setMotivo("");
                            setAviso(null);
                          }}
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="boton boton--naranja boton--chico"
                          disabled={enviando}
                          onClick={() => patch(u, { accion: "reactivar" }, () => `${u.nombre} puede volver a ingresar y reservar.`)}
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  )}
                  {gestionable && u.rol === "dueno" && u.locales > 0 && suspendiendo !== u.id && (
                    <span className="meta">Para pasarlo a jugador, primero asigna sus locales a otra cuenta en el panel.</span>
                  )}

                  {suspendiendo === u.id && (
                    <form
                      className="form-agenda"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        void patch(u, { accion: "suspender", motivo }, (d) => {
                          const pendientes = Number(d.reservasFuturas);
                          const locales = Number(d.localesPublicados);
                          return `${u.nombre} quedó suspendida: ya no puede ingresar ni reservar.${
                            pendientes > 0 ? ` Tiene ${plural(pendientes, "reserva pendiente", "reservas pendientes")} que siguen en pie.` : ""
                          }${locales > 0 ? ` Sus ${plural(locales, "local sigue", "locales siguen")} publicados: suspéndelos aparte si hace falta.` : ""}`;
                        });
                      }}
                    >
                      <div className="chips form-agenda-ancho">
                        {MOTIVOS_SUSPENSION.map((m) => (
                          <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                            {m}
                          </button>
                        ))}
                      </div>
                      <label className="form-agenda-ancho">
                        Motivo (la persona lo verá al ingresar)
                        <input className="campo" required minLength={3} maxLength={300} value={motivo} autoFocus onChange={(e) => setMotivo(e.target.value)} />
                      </label>
                      <div className="revision-botones form-agenda-ancho">
                        <button type="submit" className="boton boton--peligro" disabled={enviando || motivo.trim().length < 3}>
                          {enviando ? "Guardando…" : "Suspender cuenta"}
                        </button>
                        <button type="button" className="boton boton--claro" onClick={() => setSuspendiendo(null)}>
                          Volver
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
