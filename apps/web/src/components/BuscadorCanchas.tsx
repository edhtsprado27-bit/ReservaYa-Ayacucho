"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MapaCliente from "./MapaCliente";
import { CANCHAS } from "@/modules/catalogo/presentacion/canchas-ejemplo";
import {
  DISTRITOS,
  PLAZA_DE_ARMAS,
  dentroDeHuamanga,
  distanciaKm,
  enlaceGoogleMaps,
  type Cancha,
  type Distrito,
} from "@/modules/catalogo/dominio/ubicacion";
import type { CanchaBD, NuevaCancha } from "@/modules/catalogo/dominio/cancha";
import { nombreServicio, SERVICIOS, tieneServicios } from "@/modules/catalogo/dominio/servicios";
import { puedeRegistrarCanchas, type Perfil } from "@/modules/cuentas/dominio/roles";
import { editarPropuesta, proponerCancha, quitarPropuesta, useCanchas } from "@/modules/catalogo/presentacion/useCanchas";

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Punto = { lat: number; lng: number };
type Borrador = {
  nombre: string;
  distrito: Distrito;
  direccion: string;
  referencia: string;
  telefono: string;
  futbol: boolean;
  voley: boolean;
  techada: boolean;
  precio: string;
};
const borradorVacio: Borrador = {
  nombre: "", distrito: "Ayacucho", direccion: "", referencia: "", telefono: "",
  futbol: true, voley: false, techada: false, precio: "",
};

// Fila de Supabase -> formato que usan el mapa y la lista
function aCancha(c: CanchaBD): Cancha | null {
  if (!DISTRITOS.includes(c.distrito as Distrito)) return null;
  return {
    id: c.id,
    slug: c.slug,
    nombre: c.nombre,
    distrito: c.distrito as Distrito,
    direccion: c.direccion,
    referencia: c.referencia,
    lat: c.lat,
    lng: c.lng,
    deportes: c.deportes,
    techada: c.techada,
    precioDesde: c.precioDesde,
    telefono: c.telefono,
    servicios: c.servicios,
  };
}

// "+ Agregar cancha" solo para dueños y admin. Sin sesión, el botón lleva al login.
const LOGIN_PARA_AGREGAR = `/login?next=${encodeURIComponent("/?agregar=1")}`;

export default function BuscadorCanchas({ perfil, abrirAgregar = false }: { perfil: Perfil | null; abrirAgregar?: boolean }) {
  const puedeAgregar = puedeRegistrarCanchas(perfil?.rol);
  const [texto, setTexto] = useState("");
  const [distrito, setDistrito] = useState<Distrito | "Todos">("Todos");
  const [soloTechadas, setSoloTechadas] = useState(false);
  // Servicios pedidos: se muestran los locales que tienen TODOS los marcados
  const [conServicios, setConServicios] = useState<string[]>([]);
  const alternarServicio = (codigo: string) =>
    setConServicios((actual) => (actual.includes(codigo) ? actual.filter((s) => s !== codigo) : [...actual, codigo]));
  // null = automático: los ejemplos se muestran solo mientras no haya canchas reales
  const [verEjemplos, setVerEjemplos] = useState<boolean | null>(null);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [miUbicacion, setMiUbicacion] = useState<Punto | null>(null);
  const [aviso, setAviso] = useState("");

  // Canchas publicadas (aprobadas) desde Supabase
  const catalogo = useCanchas();
  const publicadas = useMemo(
    () => catalogo.canchas.map(aCancha).filter((c): c is Cancha => c !== null),
    [catalogo.canchas],
  );

  // Canchas en revisión que puedes ver y editar (dueño: las tuyas; admin: todas)
  const [enviadas, setEnviadas] = useState<Cancha[]>([]);
  const [modoAgregar, setModoAgregar] = useState(abrirAgregar && puedeAgregar);
  const [nuevoPunto, setNuevoPunto] = useState<Punto | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(borradorVacio);
  const [editando, setEditando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargarPendientes = useCallback(async () => {
    if (!puedeAgregar) return;
    try {
      const res = await fetch("/api/canchas/mias", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setEnviadas((json.canchas as CanchaBD[]).map(aCancha).filter((c): c is Cancha => c !== null));
    } catch {
      // sin conexión: se intenta de nuevo al recargar
    }
  }, [puedeAgregar]);

  useEffect(() => {
    // El estado cambia después de la respuesta del servidor, no de inmediato
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarPendientes();
  }, [cargarPendientes]);

  // Las que ya aprobaste aparecen en "publicadas" y dejan de estar en revisión
  const idsPublicadas = useMemo(() => new Set(publicadas.map((c) => c.id)), [publicadas]);
  const enRevision = useMemo(() => enviadas.filter((c) => !idsPublicadas.has(c.id)), [enviadas, idsPublicadas]);
  const idsRevision = useMemo(() => enRevision.map((c) => c.id), [enRevision]);

  const mostrarEjemplos = verEjemplos ?? (!catalogo.cargando && publicadas.length === 0);
  const origen = miUbicacion ?? PLAZA_DE_ARMAS;
  const todas = useMemo(
    () => [...enRevision, ...publicadas, ...(mostrarEjemplos ? CANCHAS : [])],
    [enRevision, publicadas, mostrarEjemplos],
  );

  const lista = useMemo(() => {
    const q = normalizar(texto.trim());
    return todas
      .filter((c) => distrito === "Todos" || c.distrito === distrito)
      .filter((c) => !soloTechadas || c.techada)
      .filter((c) => tieneServicios(c.servicios, conServicios))
      .filter((c) => !q || normalizar(`${c.nombre} ${c.distrito} ${c.direccion}`).includes(q))
      .map((c) => ({ ...c, km: distanciaKm(origen, c) }))
      .sort((a, b) => a.km - b.km);
  }, [todas, texto, distrito, soloTechadas, conServicios, origen]);

  const cercaDeMi = () => {
    if (!("geolocation" in navigator)) {
      setAviso("Tu navegador no permite ubicar tu posición. Mostramos las canchas desde la Plaza de Armas.");
      return;
    }
    setAviso("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
        if (dentroDeHuamanga(p)) {
          setMiUbicacion(p);
          setAviso("");
          if (modoAgregar) setNuevoPunto(p);
        } else {
          setMiUbicacion(null);
          setAviso("Estás fuera de Huamanga: ordenamos las canchas desde la Plaza de Armas.");
        }
      },
      () => setAviso("No diste permiso de ubicación. Mostramos las canchas desde la Plaza de Armas."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const abrirFormulario = () => {
    setModoAgregar(true); setEditando(null); setBorrador(borradorVacio); setNuevoPunto(null); setSeleccionada(null);
  };
  const editar = (c: Cancha) => {
    setModoAgregar(true); setEditando(c.id); setNuevoPunto({ lat: c.lat, lng: c.lng });
    setBorrador({
      nombre: c.nombre, distrito: c.distrito, direccion: c.direccion === "Por confirmar" ? "" : c.direccion,
      referencia: c.referencia ?? "", telefono: c.telefono ?? "", futbol: c.deportes.includes("Fútbol"),
      voley: c.deportes.includes("Vóley"), techada: c.techada, precio: c.precioDesde ? String(c.precioDesde) : "",
    });
  };
  const cerrarAgregar = () => { setModoAgregar(false); setNuevoPunto(null); setEditando(null); };

  const guardarCancha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoPunto) { setAviso("Primero toca el mapa en el lugar exacto de la cancha."); return; }
    const deportes = [borrador.futbol && "Fútbol", borrador.voley && "Vóley"].filter(Boolean) as Cancha["deportes"];
    const datos: NuevaCancha = {
      nombre: borrador.nombre.trim(),
      distrito: borrador.distrito,
      lat: nuevoPunto.lat,
      lng: nuevoPunto.lng,
      direccion: borrador.direccion.trim() || undefined,
      referencia: borrador.referencia.trim() || undefined,
      telefono: borrador.telefono.trim() || undefined,
      deportes: deportes.length ? deportes : ["Fútbol"],
      techada: borrador.techada,
      precioDesde: borrador.precio ? Number(borrador.precio) : undefined,
    };

    setEnviando(true);
    setAviso(editando ? "Guardando cambios…" : "Guardando en Supabase…");
    const r = editando ? await editarPropuesta(editando, datos) : await proponerCancha(datos);
    setEnviando(false);
    if (!r.ok) { setAviso(r.error); return; } // el formulario queda abierto para corregir

    const cancha: Cancha = {
      id: r.id,
      nombre: datos.nombre,
      distrito: borrador.distrito,
      direccion: datos.direccion ?? "Por confirmar",
      referencia: datos.referencia,
      telefono: datos.telefono,
      lat: datos.lat,
      lng: datos.lng,
      deportes: datos.deportes ?? ["Fútbol"],
      techada: borrador.techada,
      precioDesde: datos.precioDesde,
    };
    setEnviadas([cancha, ...enRevision.filter((m) => m.id !== editando)]);
    setAviso(`"${cancha.nombre}" ${editando ? "actualizada" : "guardada"}. ${textoRevision}`);
    cerrarAgregar();
    setSeleccionada(cancha.id);
  };

  const borrar = async (c: Cancha) => {
    setAviso(`Quitando "${c.nombre}"…`);
    const r = await quitarPropuesta(c.id);
    if (r.ok || r.codigo === "PROPUESTA_NO_ENCONTRADA") {
      setEnviadas(enRevision.filter((m) => m.id !== c.id));
      if (seleccionada === c.id) setSeleccionada(null);
      setAviso(r.ok ? `"${c.nombre}" se quitó.` : r.error);
    } else {
      setAviso(r.error);
    }
  };

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador((b) => ({ ...b, [k]: v }));
  const textoRevision =
    perfil?.rol === "admin"
      ? "Queda en revisión: apruébala en el Panel del administrador."
      : "Queda en revisión hasta que el administrador la apruebe.";

  return (
    <section className="buscador">
      <div className="filtros">
        <input
          className="campo"
          id="buscar"
          type="search"
          placeholder="Buscar por nombre, distrito o dirección"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar canchas"
        />
        <button className="boton" type="button" onClick={cercaDeMi}>Canchas cerca de mí</button>
        {puedeAgregar ? (
          <button className="boton boton--naranja" type="button" onClick={modoAgregar ? cerrarAgregar : abrirFormulario}>
            {modoAgregar ? "Cancelar" : "+ Agregar cancha"}
          </button>
        ) : !perfil ? (
          <Link className="boton boton--naranja" href={LOGIN_PARA_AGREGAR}>+ Agregar cancha</Link>
        ) : null}
      </div>

      <div className="chips" role="group" aria-label="Distrito">
        {(["Todos", ...DISTRITOS] as const).map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={distrito === d} onClick={() => setDistrito(d)}>
            {d}
          </button>
        ))}
        <label className="check">
          <input id="techadas" type="checkbox" checked={soloTechadas} onChange={(e) => setSoloTechadas(e.target.checked)} />
          Solo techadas
        </label>
        <label className="check">
          <input id="ejemplos" type="checkbox" checked={mostrarEjemplos} onChange={(e) => setVerEjemplos(e.target.checked)} />
          Mostrar canchas de ejemplo
        </label>
      </div>

      <div className="filtro-servicios" role="group" aria-label="Servicios del local">
        <span>Con:</span>
        {SERVICIOS.map((s) => (
          <button
            key={s.codigo}
            type="button"
            className="chip"
            aria-pressed={conServicios.includes(s.codigo)}
            onClick={() => alternarServicio(s.codigo)}
            title={s.nombre}
          >
            {s.corto}
          </button>
        ))}
        {conServicios.length > 0 && (
          <button type="button" className="enlace-boton" onClick={() => setConServicios([])}>
            Quitar filtros
          </button>
        )}
      </div>

      {catalogo.error && (
        <p className="aviso aviso--error" role="alert">
          No se pudieron cargar las canchas. {catalogo.error}{" "}
          <button type="button" className="enlace-boton" onClick={() => catalogo.recargar()}>Reintentar</button>
        </p>
      )}
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      <div className="contenido">
        <div className="contenedor-mapa">
          {modoAgregar && (
            <p className="banda">
              {nuevoPunto
                ? "Puedes arrastrar el pin verde para afinar la ubicación."
                : "Acerca el mapa y toca el lugar exacto de la cancha."}
            </p>
          )}
          <MapaCliente
            canchas={lista}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
            miUbicacion={miUbicacion}
            modoAgregar={modoAgregar}
            nuevoPunto={nuevoPunto}
            onElegirPunto={setNuevoPunto}
            enRevision={idsRevision}
          />
        </div>

        {modoAgregar ? (
          <form className="formulario" onSubmit={guardarCancha}>
            <h2>{editando ? "Editar cancha" : "Agregar cancha"}</h2>
            <p className="meta">
              Ubicación:{" "}
              {nuevoPunto ? <strong>{nuevoPunto.lat}, {nuevoPunto.lng}</strong> : "toca el mapa"}
            </p>
            <p className="meta">Si estás en la cancha, usa “Canchas cerca de mí” para tomar tu posición GPS.</p>
            <label>Nombre<input className="campo" id="f-nombre" required minLength={3} maxLength={120} value={borrador.nombre} onChange={(e) => set("nombre", e.target.value)} /></label>
            <label>Distrito
              <select className="campo" id="f-distrito" value={borrador.distrito} onChange={(e) => set("distrito", e.target.value as Distrito)}>
                {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>Dirección<input className="campo" id="f-direccion" maxLength={200} value={borrador.direccion} onChange={(e) => set("direccion", e.target.value)} /></label>
            <label>Referencia<input className="campo" id="f-referencia" maxLength={200} value={borrador.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="Ej. frente al colegio" /></label>
            <label>Teléfono<input className="campo" id="f-telefono" value={borrador.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="9XX XXX XXX" /></label>
            <label>Precio desde (S/ por hora, opcional)<input className="campo" id="f-precio" type="number" min="1" max="1000" value={borrador.precio} onChange={(e) => set("precio", e.target.value)} /></label>
            <div className="chips">
              <label className="check"><input type="checkbox" id="f-futbol" checked={borrador.futbol} onChange={(e) => set("futbol", e.target.checked)} /> Fútbol</label>
              <label className="check"><input type="checkbox" id="f-voley" checked={borrador.voley} onChange={(e) => set("voley", e.target.checked)} /> Vóley</label>
              <label className="check"><input type="checkbox" id="f-techada" checked={borrador.techada} onChange={(e) => set("techada", e.target.checked)} /> Techada</label>
            </div>
            <p className="meta">{textoRevision}</p>
            <button className="boton boton--naranja" type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar cancha"}
            </button>
          </form>
        ) : (
          <div className="lista">
            <div className="fila-resumen">
              <p className="resumen">
                {catalogo.cargando
                  ? "Cargando canchas…"
                  : `${lista.length} ${lista.length === 1 ? "cancha" : "canchas"} · ordenadas por cercanía ${miUbicacion ? "a ti" : "a la Plaza de Armas"}`}
              </p>
              {enRevision.length > 0 && (
                <span className="resumen">{enRevision.length} en revisión</span>
              )}
            </div>
            {!catalogo.cargando && lista.length === 0 && <p className="vacio">No hay canchas con esos filtros. Usa “+ Agregar cancha” para registrar una.</p>}
            {lista.map((c) => {
              const pendiente = idsRevision.includes(c.id);
              return (
                <article key={c.id} className={`tarjeta${c.id === seleccionada ? " tarjeta--activa" : ""}`}>
                  <button type="button" className="tarjeta-cuerpo" onClick={() => setSeleccionada(c.id)}>
                    <span className="tarjeta-titulo">
                      <strong>{c.nombre}</strong>
                      <span className="km">{c.km.toFixed(1)} km</span>
                    </span>
                    <span className="meta">{c.distrito} · {c.deportes.join(", ")}{c.techada ? " · techada" : ""}</span>
                    <span className="meta">{c.direccion}{c.telefono ? ` · ${c.telefono}` : ""}</span>
                    {c.precioDesde ? <span className="precio">Desde S/ {c.precioDesde}/h</span> : null}
                    {c.servicios && c.servicios.length > 0 && (
                      <span className="servicios servicios--chicos">
                        {c.servicios.map((s) => (
                          <span key={s}>{nombreServicio(s)}</span>
                        ))}
                      </span>
                    )}
                    {c.id.startsWith("ejemplo") && <span className="etiqueta">Ejemplo</span>}
                    {pendiente && <span className="etiqueta etiqueta--revision">En revisión</span>}
                  </button>
                  <div className="acciones">
                    {c.slug && !pendiente && (
                      <Link className="enlace enlace--reservar" href={`/cancha/${c.slug}`}>Reservar</Link>
                    )}
                    <a className="enlace" href={enlaceGoogleMaps(c)} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
                    {pendiente && (
                      <>
                        <button type="button" className="enlace-boton" onClick={() => editar(c)}>Editar</button>
                        <button type="button" className="enlace-boton enlace-boton--peligro" onClick={() => borrar(c)}>Quitar</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
