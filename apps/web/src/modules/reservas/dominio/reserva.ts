// Entidades de las reservas: local, cancha, turno, reserva y sus estados.
// Capa: dominio. Sin nada del servidor: se usa en el navegador (grilla de
// horarios) y en las rutas /api.

export const DIAS_RESERVABLES = 14; // días que se muestran en la grilla (la base acepta hasta 30)

export type CanchaLocal = {
  id: string;
  nombre: string;
  deporte: string; // texto para la web: "Fútbol", "Vóley"...
  techada: boolean;
  minutosTurno: number;
  minMinutos: number;
  maxMinutos: number;
  precioDesde: number | null;
};

export type LocalPublico = {
  id: string;
  slug: string;
  nombre: string;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lat: number;
  lng: number;
  telefono: string | null;
  adelantoPct: number;
  minutosApartado: number;
  horasCancelacion: number;
  canchas: CanchaLocal[];
};

export type EstadoTurno = "libre" | "ocupado" | "pasado" | "cerrado";

export type Turno = {
  cancha: string;
  inicio: string; // ISO
  fin: string;
  estado: EstadoTurno;
  precio: number | null;
};

export type EstadoReserva =
  | "pending_payment"
  | "payment_review"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled"
  | "expired";

export type Reserva = {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  inicio: string;
  fin: string;
  total: number;
  adelanto: number;
  pagado: number;
  vence: string | null;
  cancha: string;
  deporte: string;
  local: string;
  slug: string;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  horasCancelacion: number;
  cancelable: boolean; // activa y todavía no empieza (lo decide la base)
};

// Lo que devuelve la base al reservar (y al pedir otra vez con la misma clave)
export type ReservaCreada = {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  inicio: string;
  fin: string;
  total: number;
  adelanto: number;
  vence: string | null;
};

export const ESTADO_TEXTO: Record<EstadoReserva, string> = {
  pending_payment: "Por pagar",
  payment_review: "Pago en revisión",
  confirmed: "Confirmada",
  completed: "Jugada",
  no_show: "No asistió",
  cancelled: "Cancelada",
  expired: "Vencida",
};

// Reserva que todavía ocupa el horario
export const esActiva = (e: EstadoReserva) => e === "pending_payment" || e === "payment_review" || e === "confirmed";
