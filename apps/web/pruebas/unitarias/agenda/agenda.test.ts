// Módulo agenda (panel del dueño): reglas puras (dominio), validación de lo que
// llega del navegador y casos de uso (aplicación) con un repositorio falso.
import {
  anotarReserva,
  bloquearHorario,
  gestionarReserva,
  quitarBloqueo,
  verAgenda,
  verLocalesConAgenda,
} from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import {
  accionesPosibles,
  enlaceWhatsApp,
  filasDeCancha,
  precioDeTurnos,
  resumenDelDia,
  saldo,
  turnosSeguidosLibres,
  type AgendaDia,
  type ReservaAgenda,
} from "@/modules/agenda/dominio/agenda";
import type { AgendaRepositorio } from "@/modules/agenda/dominio/agenda.repositorio";
import { validarAccion, validarBloqueo, validarIdBloqueo, validarReservaManual } from "@/modules/agenda/dominio/pedidos-agenda";
import { ID_CANCHA, ID_LOCAL, ID_RESERVA } from "../../apoyo/supabase-falso";

const OTRA_CANCHA = "66666666-6666-4666-8666-666666666666";

// Turnos de 1 hora del 1 de diciembre (hora de Lima = UTC-5)
const hora = (h: number) => `2026-12-01T${String(h).padStart(2, "0")}:00:00-05:00`;
const turno = (h: number, precio: number | null = 60) => ({ inicio: hora(h), fin: hora(h + 1), precio });
const ms = (h: number) => new Date(hora(h)).getTime();

function reserva(cambios: Partial<ReservaAgenda> = {}): ReservaAgenda {
  return {
    id: ID_RESERVA,
    codigo: "RY-ABC123",
    canchaId: ID_CANCHA,
    inicio: hora(18),
    fin: hora(20),
    estado: "confirmed",
    origen: "web",
    jugador: "Ana",
    telefono: "966123456",
    total: 140,
    adelanto: 70,
    pagado: 70,
    vence: null,
    nota: null,
    ...cambios,
  };
}

function agenda(cambios: Partial<AgendaDia> = {}): AgendaDia {
  return {
    local: { id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", estado: "approved", adelantoPct: 50 },
    fecha: "2026-12-01",
    ahora: hora(17),
    canchas: [
      { id: ID_CANCHA, nombre: "Cancha 1", deporte: "Fútbol", minutosTurno: 60, turnos: [16, 17, 18, 19, 20, 21, 22].map((h) => turno(h, h >= 18 ? 80 : 60)) },
      { id: OTRA_CANCHA, nombre: "Cancha 2", deporte: "Vóley", minutosTurno: 60, turnos: [18, 19].map((h) => turno(h, null)) },
    ],
    reservas: [reserva()],
    bloqueos: [{ id: 7, canchaId: ID_CANCHA, inicio: hora(21), fin: hora(23), motivo: "Torneo" }],
    ...cambios,
  };
}

describe("saldo y acciones posibles", () => {
  it("saldo es lo que falta pagar (nunca negativo)", () => {
    expect(saldo({ total: 140, pagado: 70 })).toBe(70);
    expect(saldo({ total: 100, pagado: 120 })).toBe(0);
    expect(saldo({ total: 10.1, pagado: 0.2 })).toBe(9.9);
  });

  it("antes de empezar: cobrar y cancelar", () => {
    expect(accionesPosibles(reserva(), ms(17))).toEqual(["cobrar", "cancelar"]);
  });

  it("mientras se juega: cobrar, jugó, no vino y cancelar", () => {
    expect(accionesPosibles(reserva(), ms(19))).toEqual(["cobrar", "jugo", "no_vino", "cancelar"]);
  });

  it("después de terminar ya no se puede cancelar", () => {
    expect(accionesPosibles(reserva(), ms(21))).toEqual(["cobrar", "jugo", "no_vino"]);
  });

  it("pagada completa: no aparece cobrar", () => {
    expect(accionesPosibles(reserva({ pagado: 140 }), ms(17))).toEqual(["cancelar"]);
  });

  it("jugada con saldo: solo cobrar; no vino: nada", () => {
    expect(accionesPosibles(reserva({ estado: "completed" }), ms(21))).toEqual(["cobrar"]);
    expect(accionesPosibles(reserva({ estado: "no_show" }), ms(21))).toEqual([]);
  });
});

describe("filasDeCancha", () => {
  it("una reserva o un bloqueo de varias horas se muestra una sola vez", () => {
    const filas = filasDeCancha(agenda(), ID_CANCHA, ms(17));
    expect(filas.map((f) => f.tipo)).toEqual(["libre", "libre", "reserva", "libre", "bloqueo"]);
    expect(filas[0]).toEqual({ tipo: "libre", turno: turno(16), pasado: true });
    expect(filas[1]).toEqual(expect.objectContaining({ tipo: "libre", pasado: true }));
    expect(filas[3]).toEqual({ tipo: "libre", turno: turno(20, 80), pasado: false });
  });

  it("una reserva fuera del horario de la cancha también aparece, en su hora", () => {
    const fuera = reserva({ id: "otra", inicio: hora(6), fin: hora(7) });
    const filas = filasDeCancha(agenda({ reservas: [reserva(), fuera] }), ID_CANCHA, ms(17));
    expect(filas[0]).toEqual({ tipo: "reserva", reserva: fuera });
  });

  it("una cancha que no existe no tiene filas", () => {
    expect(filasDeCancha(agenda({ reservas: [] }), "no-existe", 0)).toEqual([]);
  });
});

describe("turnosSeguidosLibres y precio", () => {
  it("se detiene en la primera reserva", () => {
    const lista = turnosSeguidosLibres(agenda(), ID_CANCHA, hora(16));
    expect(lista.map((t) => t.inicio)).toEqual([hora(16), hora(17)]);
    expect(precioDeTurnos(lista, 60)).toBe(120);
  });

  it("se detiene en un bloqueo y respeta el máximo de minutos", () => {
    expect(turnosSeguidosLibres(agenda(), ID_CANCHA, hora(20)).map((t) => t.inicio)).toEqual([hora(20)]);
    const libre = agenda({ reservas: [], bloqueos: [] });
    expect(turnosSeguidosLibres(libre, ID_CANCHA, hora(16))).toHaveLength(4);
    expect(turnosSeguidosLibres(libre, ID_CANCHA, hora(16), 120)).toHaveLength(2);
  });

  it("se detiene si hay un hueco entre turnos", () => {
    const conHueco = agenda({ reservas: [], bloqueos: [] });
    conHueco.canchas[0].turnos = [turno(16), turno(18)];
    expect(turnosSeguidosLibres(conHueco, ID_CANCHA, hora(16))).toHaveLength(1);
  });

  it("devuelve vacío si la cancha o el turno no existen", () => {
    expect(turnosSeguidosLibres(agenda(), "no-existe", hora(16))).toEqual([]);
    expect(turnosSeguidosLibres(agenda(), ID_CANCHA, hora(5))).toEqual([]);
  });

  it("los turnos sin precio cuentan 0 y turnos de 30 min cuestan la mitad", () => {
    expect(precioDeTurnos([turno(18, null), turno(19, null)], 60)).toBe(0);
    expect(precioDeTurnos([turno(18, 80)], 30)).toBe(40);
  });
});

describe("resumenDelDia", () => {
  it("cuenta las reservas en pie o jugadas; no las de quien no vino", () => {
    const a = agenda({
      reservas: [
        reserva(),
        reserva({ id: "b", estado: "pending_payment", pagado: 0, total: 60 }),
        reserva({ id: "c", estado: "payment_review", pagado: 0, total: 60 }),
        reserva({ id: "d", estado: "completed", pagado: 80, total: 80 }),
        reserva({ id: "e", estado: "no_show", pagado: 0, total: 80 }),
      ],
    });
    expect(resumenDelDia(a)).toEqual({ reservas: 4, porConfirmar: 2, total: 340, cobrado: 150, porCobrar: 190 });
  });
});

describe("enlaceWhatsApp", () => {
  it("arma el enlace con 51 y el texto", () => {
    expect(enlaceWhatsApp("966 123 456")).toBe("https://wa.me/51966123456");
    expect(enlaceWhatsApp("+51966123456", "Hola Ana")).toBe("https://wa.me/51966123456?text=Hola%20Ana");
  });

  it("devuelve null si no parece un celular peruano", () => {
    expect(enlaceWhatsApp(null)).toBeNull();
    expect(enlaceWhatsApp("066312345")).toBeNull();
    expect(enlaceWhatsApp("96612345")).toBeNull();
  });
});

describe("validación de pedidos de la agenda", () => {
  const base = { canchaId: ID_CANCHA, inicio: hora(18), fin: hora(19) };

  it("reserva manual: pasa a UTC, recorta textos y redondea el pago", () => {
    expect(validarReservaManual({ ...base, nombre: "  Carlos  ", telefono: " 966123456 ", pagado: "30,5", nota: "  " })).toEqual({
      canchaId: ID_CANCHA,
      inicio: "2026-12-01T23:00:00.000Z",
      fin: "2026-12-02T00:00:00.000Z",
      nombre: "Carlos",
      telefono: "966123456",
      pagado: 30.5,
      nota: null,
    });
    expect(validarReservaManual({ ...base, nombre: 5 })).toEqual(expect.objectContaining({ nombre: "", pagado: 0, telefono: null }));
  });

  it.each([
    ["sin datos", null],
    ["cancha que no es UUID", { ...base, canchaId: "x" }],
    ["fecha inválida", { ...base, inicio: "mañana" }],
    ["fin antes del inicio", { ...base, fin: hora(17) }],
    ["pago negativo", { ...base, pagado: -1 }],
    ["pago que no es número", { ...base, pagado: "mucho" }],
  ])("reserva manual rechaza %s", (_caso, datos) => {
    expect(() => validarReservaManual(datos)).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_AGENDA", status: 400 }));
  });

  it("bloqueo: motivo opcional", () => {
    expect(validarBloqueo({ ...base, motivo: " Torneo " }).motivo).toBe("Torneo");
    expect(validarBloqueo(base).motivo).toBeNull();
    expect(() => validarBloqueo({ ...base, fin: base.inicio })).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("acción: solo las 4 conocidas", () => {
    expect(validarAccion({ accion: "cobrar", monto: 20 })).toEqual({ accion: "cobrar", monto: 20, motivo: null });
    expect(validarAccion({ accion: "cancelar", motivo: "Lluvia" })).toEqual({ accion: "cancelar", monto: null, motivo: "Lluvia" });
    expect(() => validarAccion({ accion: "borrar" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => validarAccion("cobrar")).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("id de bloqueo: entero positivo", () => {
    expect(validarIdBloqueo("12")).toBe(12);
    for (const malo of ["0", "-1", "1.5", "abc", ""]) expect(() => validarIdBloqueo(malo)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("casos de uso de la agenda", () => {
  function repoFalso() {
    const repo = {
      misLocales: jest.fn(async () => [
        { id: ID_LOCAL, nombre: "La Bombonera", estado: "approved" },
        { id: "otro", nombre: "En revisión", estado: "pending_review" },
        { id: "susp", nombre: "Suspendido", estado: "suspended" },
      ]),
      agenda: jest.fn(async () => agenda()),
      reservaManual: jest.fn(async () => ({ id: ID_RESERVA, codigo: "RY-1", total: 80, pagado: 0, estado: "confirmed" })),
      gestionar: jest.fn(async () => ({ id: ID_RESERVA, estado: "completed", pagado: 140, total: 140 })),
      bloquear: jest.fn(async () => ({ id: 3 })),
      quitarBloqueo: jest.fn(async () => undefined),
    };
    return repo as unknown as jest.Mocked<AgendaRepositorio>;
  }

  it("muestra la agenda de los locales publicados y de los suspendidos (no de los que están en revisión)", async () => {
    expect((await verLocalesConAgenda(repoFalso())).map((l) => l.estado)).toEqual(["approved", "suspended"]);
  });

  it("verAgenda valida el local y la fecha antes de ir a la base", async () => {
    const repo = repoFalso();
    await verAgenda(repo, ID_LOCAL, "2026-12-01");
    expect(repo.agenda).toHaveBeenCalledWith(ID_LOCAL, "2026-12-01");
    expect(() => verAgenda(repo, "x", "2026-12-01")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => verAgenda(repo, ID_LOCAL, "01/12/2026")).toThrow(expect.objectContaining({ status: 400 }));
    expect(repo.agenda).toHaveBeenCalledTimes(1);
  });

  it("anotar, gestionar, bloquear y quitar bloqueo pasan datos ya validados", async () => {
    const repo = repoFalso();
    await anotarReserva(repo, { canchaId: ID_CANCHA, inicio: hora(18), fin: hora(19), nombre: "Luis" });
    expect(repo.reservaManual).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Luis", pagado: 0 }));

    await gestionarReserva(repo, ID_RESERVA, { accion: "jugo" });
    expect(repo.gestionar).toHaveBeenCalledWith(ID_RESERVA, { accion: "jugo", motivo: null, monto: null });
    expect(() => gestionarReserva(repo, "123", { accion: "jugo" })).toThrow(expect.objectContaining({ status: 400 }));

    await bloquearHorario(repo, { canchaId: ID_CANCHA, inicio: hora(18), fin: hora(20) });
    expect(repo.bloquear).toHaveBeenCalledWith(expect.objectContaining({ canchaId: ID_CANCHA, motivo: null }));

    await quitarBloqueo(repo, "3");
    expect(repo.quitarBloqueo).toHaveBeenCalledWith(3);
  });
});
