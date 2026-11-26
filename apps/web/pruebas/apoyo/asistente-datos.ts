// Datos de prueba del asistente: catálogo, locales y grilla de horarios.
import type { CanchaBD } from "@/modules/catalogo/dominio/cancha";
import type { LocalPublico, Turno } from "@/modules/reservas/dominio/reserva";

export const cancha = (x: Partial<CanchaBD> & Pick<CanchaBD, "slug" | "nombre">): CanchaBD => ({
  id: `id-${x.slug}`,
  distrito: "Carmen Alto",
  direccion: "Jr. Prueba 123",
  lat: -13.17,
  lng: -74.22,
  deportes: ["Fútbol"],
  techada: false,
  precioDesde: 50,
  servicios: [],
  ...x,
});

export const CATALOGO: CanchaBD[] = [
  cancha({ slug: "los-andes", nombre: "Complejo Los Andes", precioDesde: 50, servicios: ["vestuarios", "duchas"] }),
  cancha({ slug: "la-canchita", nombre: "La Canchita del Barrio", precioDesde: 40, deportes: ["Fútbol", "Vóley"] }),
  cancha({ slug: "grass-sjb", nombre: "Grass San Juan", distrito: "San Juan Bautista", deportes: ["Futsal"], techada: true, precioDesde: 60, servicios: ["estacionamiento"] }),
];

export const local = (slug: string, canchas: Partial<LocalPublico["canchas"][number]>[] = [{}]): LocalPublico => ({
  id: `local-${slug}`,
  slug,
  nombre: slug,
  distrito: "Carmen Alto",
  direccion: "Jr. Prueba 123",
  referencia: null,
  lat: -13.17,
  lng: -74.22,
  telefono: null,
  adelantoPct: 50,
  minutosApartado: 15,
  horasCancelacion: 6,
  servicios: [],
  canchas: canchas.map((c, i) => ({
    id: `${slug}-c${i + 1}`,
    nombre: `Cancha ${i + 1}`,
    deporte: "Fútbol",
    techada: false,
    minutosTurno: 60,
    minMinutos: 60,
    maxMinutos: 180,
    precioDesde: 50,
    ...c,
  })),
});

/** Turno de esa cancha ese día a esa hora de Ayacucho */
export function turno(canchaId: string, fecha: string, hora: string, estado: Turno["estado"] = "libre", precio: number | null = 50, minutos = 60): Turno {
  const inicio = new Date(`${fecha}T${hora}:00-05:00`);
  return { cancha: canchaId, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + minutos * 60_000).toISOString(), estado, precio };
}

/** Todos los turnos de 06:00 a 22:00 de una cancha; `ocupadas` quedan reservadas */
export function grilla(canchaId: string, fecha: string, ocupadas: string[] = [], precio = 50): Turno[] {
  return Array.from({ length: 17 }, (_, i) => {
    const hora = `${String(6 + i).padStart(2, "0")}:00`;
    return turno(canchaId, fecha, hora, ocupadas.includes(hora) ? "ocupado" : "libre", precio);
  });
}
