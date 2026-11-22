// Conversión de lo que devuelven las funciones de PostgreSQL (011 y 012) a las
// entidades del dominio. Capa: infraestructura.

import { ordenarServicios } from "@/modules/catalogo/dominio/servicios";
import type { CanchaConfig, ConfigLocal, DiaHorario, EstadoLocal, LocalAdmin } from "../dominio/configuracion";

type Json = Record<string, unknown>;
const lista = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const txt = (v: unknown) => (v == null || v === "" ? null : String(v));

const aDia = (d: Json): DiaHorario => ({ dia: Number(d.dia), abre: String(d.abre), cierra: String(d.cierra) });

/** Un rango por día (si la base tuviera dos, se toma desde la primera apertura hasta el último cierre) */
function unoPorDia(horario: DiaHorario[]): DiaHorario[] {
  const porDia = new Map<number, DiaHorario>();
  for (const h of horario) {
    const previo = porDia.get(h.dia);
    porDia.set(h.dia, previo ? { dia: h.dia, abre: previo.abre < h.abre ? previo.abre : h.abre, cierra: previo.cierra > h.cierra ? previo.cierra : h.cierra } : h);
  }
  return [...porDia.values()].sort((a, b) => a.dia - b.dia);
}

const aCancha = (c: Json): CanchaConfig => ({
  id: String(c.id),
  nombre: String(c.nombre),
  deporte: String(c.deporte),
  techada: Boolean(c.techada),
  minutosTurno: Number(c.minutos_turno ?? 60),
  maxMinutos: Number(c.max_minutos ?? 180),
  horario: unoPorDia(lista(c.horario).map(aDia)),
  precio: num(c.precio),
  precioPunta: num(c.precio_punta),
  puntaDesde: txt(c.punta_desde),
  reservasFuturas: Number(c.reservas_futuras ?? 0),
});

export function aConfig(j: Json): ConfigLocal {
  const l = (j.local ?? {}) as Json;
  return {
    local: {
      id: String(l.id),
      nombre: String(l.nombre),
      slug: String(l.slug),
      distrito: String(l.distrito ?? ""),
      estado: String(l.estado) as EstadoLocal,
      motivoEstado: txt(l.motivo_estado),
      direccion: String(l.direccion ?? ""),
      referencia: txt(l.referencia),
      whatsapp: txt(l.whatsapp),
      adelantoPct: Number(l.adelanto_pct ?? 50),
      minutosApartado: Number(l.minutos_apartado ?? 15),
      horasCancelacion: Number(l.horas_cancelacion ?? 6),
      servicios: ordenarServicios(Array.isArray(l.servicios) ? l.servicios : []),
    },
    canchas: lista(j.canchas).map(aCancha),
  };
}

export const aLocalAdmin = (f: Json): LocalAdmin => ({
  id: String(f.id),
  nombre: String(f.nombre),
  slug: String(f.slug),
  distrito: String(f.distrito ?? ""),
  estado: String(f.estado) as EstadoLocal,
  motivo: txt(f.motivo),
  sinDueno: Boolean(f.sin_dueno),
  duenoNombre: txt(f.dueno_nombre),
  duenoCorreo: txt(f.dueno_correo),
  canchas: Number(f.canchas ?? 0),
  reservasFuturas: Number(f.reservas_futuras ?? 0),
  duenoTelefono: txt(f.dueno_telefono),
  whatsapp: txt(f.whatsapp),
});
