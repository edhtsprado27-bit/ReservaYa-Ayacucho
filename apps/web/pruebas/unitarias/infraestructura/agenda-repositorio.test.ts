// Agenda del dueño con Supabase (infraestructura): qué funciones de la base
// llama, con qué parámetros, cómo convierte las respuestas y los errores.
import { aAgenda } from "@/modules/agenda/infraestructura/mapeo-agenda";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { aReserva } from "@/modules/reservas/infraestructura/mapeo-reservas";
import { crearSupabaseFalso, ID_CANCHA, ID_LOCAL, ID_RESERVA } from "../../apoyo/supabase-falso";

const agendaDeLaBase = {
  local: { id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", estado: "approved", adelanto_pct: "30" },
  fecha: "2026-12-01",
  ahora: "2026-12-01T22:00:00+00:00",
  canchas: [
    {
      id: ID_CANCHA, nombre: "Cancha 1", deporte: "futbol", minutos_turno: 60,
      turnos: [{ inicio: "2026-12-01T23:00:00+00:00", fin: "2026-12-02T00:00:00+00:00", precio: "80.00" }],
    },
  ],
  reservas: [
    {
      id: ID_RESERVA, codigo: "RY-ABC123", cancha_id: ID_CANCHA, inicio: "2026-12-01T23:00:00+00:00", fin: "2026-12-02T00:00:00+00:00",
      estado: "confirmed", origen: "owner_manual", jugador: "Luis", telefono: "", total: "80.00", adelanto: "0", pagado: "20", vence: null, nota: "Paga al llegar",
    },
  ],
  bloqueos: [{ id: 5, cancha_id: ID_CANCHA, inicio: "2026-12-02T00:00:00+00:00", fin: "2026-12-02T02:00:00+00:00", motivo: null }],
};

describe("mapeo de la agenda", () => {
  it("convierte números, deportes y textos vacíos", () => {
    const a = aAgenda(agendaDeLaBase);
    expect(a.local).toEqual({ id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", estado: "approved", adelantoPct: 30 });
    expect(a.ahora).toBe("2026-12-01T22:00:00+00:00");
    expect(a.canchas[0]).toEqual(expect.objectContaining({ deporte: "Fútbol", minutosTurno: 60 }));
    expect(a.canchas[0].turnos[0].precio).toBe(80);
    expect(a.reservas[0]).toEqual(expect.objectContaining({ canchaId: ID_CANCHA, origen: "owner_manual", telefono: null, total: 80, pagado: 20, nota: "Paga al llegar" }));
    expect(a.bloqueos[0]).toEqual({ id: 5, canchaId: ID_CANCHA, inicio: "2026-12-02T00:00:00+00:00", fin: "2026-12-02T02:00:00+00:00", motivo: null });
  });

  it("usa valores por defecto si faltan datos", () => {
    const a = aAgenda({ local: { id: ID_LOCAL, nombre: "L", slug: "l", estado: "approved" }, fecha: "2026-12-01", canchas: [{ id: ID_CANCHA, nombre: "C", deporte: "otro", turnos: [{ inicio: "a", fin: "b", precio: null }] }], reservas: [{ id: "r", codigo: "c", cancha_id: ID_CANCHA, inicio: "a", fin: "b", estado: "confirmed", origen: "web" }] });
    expect(a.local.adelantoPct).toBe(50);
    expect(a.ahora).toBe(new Date(0).toISOString());
    expect(a.canchas[0]).toEqual(expect.objectContaining({ deporte: "Multideporte", minutosTurno: 60 }));
    expect(a.canchas[0].turnos[0].precio).toBeNull();
    expect(a.reservas[0]).toEqual(expect.objectContaining({ total: 0, adelanto: 0, pagado: 0, jugador: null, vence: null }));
    expect(a.bloqueos).toEqual([]);
  });
});

describe("SupabaseAgendaRepositorio", () => {
  it("llama a las funciones de la base con los parámetros correctos", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_mis_locales_pago: { data: [{ id: ID_LOCAL, nombre: "La Bombonera", estado: "approved", yape: "966123456" }] },
      fn_agenda_local: { data: agendaDeLaBase },
      fn_reserva_manual: { data: { id: ID_RESERVA, codigo: "RY-1", total: "140", pagado: "30", estado: "confirmed" } },
      fn_gestionar_reserva: { data: { id: ID_RESERVA, estado: "completed", pagado: "140", total: "140" } },
      fn_bloquear_horario: { data: { id: "9" } },
      fn_quitar_bloqueo: { data: null },
    });
    const repo = agendaConSesion(db);

    expect(await repo.misLocales()).toEqual([{ id: ID_LOCAL, nombre: "La Bombonera", estado: "approved" }]);
    expect((await repo.agenda(ID_LOCAL, "2026-12-01")).reservas).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("fn_agenda_local", { p_local: ID_LOCAL, p_fecha: "2026-12-01" });

    const pedido = { canchaId: ID_CANCHA, inicio: "i", fin: "f", nombre: "Luis", telefono: null, pagado: 30, nota: null };
    expect(await repo.reservaManual(pedido)).toEqual({ id: ID_RESERVA, codigo: "RY-1", total: 140, pagado: 30, estado: "confirmed" });
    expect(rpc).toHaveBeenCalledWith("fn_reserva_manual", {
      p_cancha: ID_CANCHA, p_inicio: "i", p_fin: "f", p_nombre: "Luis", p_telefono: null, p_pagado: 30, p_nota: null,
    });

    expect(await repo.gestionar(ID_RESERVA, { accion: "cobrar", monto: 70, motivo: null })).toEqual({ id: ID_RESERVA, estado: "completed", pagado: 140, total: 140 });
    expect(rpc).toHaveBeenCalledWith("fn_gestionar_reserva", { p_reserva: ID_RESERVA, p_accion: "cobrar", p_motivo: null, p_monto: 70 });

    expect(await repo.bloquear({ canchaId: ID_CANCHA, inicio: "i", fin: "f", motivo: "Torneo" })).toEqual({ id: 9 });
    expect(rpc).toHaveBeenCalledWith("fn_bloquear_horario", { p_cancha: ID_CANCHA, p_inicio: "i", p_fin: "f", p_motivo: "Torneo" });

    await repo.quitarBloqueo(9);
    expect(rpc).toHaveBeenCalledWith("fn_quitar_bloqueo", { p_bloqueo: 9 });
  });

  it("sin datos devuelve listas vacías y la reserva manual queda confirmada", async () => {
    const { db } = crearSupabaseFalso({
      fn_mis_locales_pago: { data: null },
      fn_reserva_manual: { data: { id: ID_RESERVA, codigo: "RY-1", total: 0, pagado: 0 } },
    });
    const repo = agendaConSesion(db);
    expect(await repo.misLocales()).toEqual([]);
    expect((await repo.reservaManual({ canchaId: ID_CANCHA, inicio: "i", fin: "f", nombre: "Luis", telefono: null, pagado: 0, nota: null })).estado).toBe("confirmed");
  });

  it.each([
    ["fn_mis_locales_pago", "SIN_SESION", 401, (r: ReturnType<typeof agendaConSesion>) => r.misLocales()],
    ["fn_agenda_local", "LOCAL_AJENO", 403, (r: ReturnType<typeof agendaConSesion>) => r.agenda(ID_LOCAL, "2026-12-01")],
    ["fn_reserva_manual", "HORARIO_OCUPADO", 409, (r: ReturnType<typeof agendaConSesion>) => r.reservaManual({ canchaId: ID_CANCHA, inicio: "i", fin: "f", nombre: "L", telefono: null, pagado: 0, nota: null })],
    ["fn_reserva_manual", "COURT_BLACKOUT", 409, (r: ReturnType<typeof agendaConSesion>) => r.reservaManual({ canchaId: ID_CANCHA, inicio: "i", fin: "f", nombre: "L", telefono: null, pagado: 0, nota: null })],
    ["fn_gestionar_reserva", "ACCION_NO_PERMITIDA", 409, (r: ReturnType<typeof agendaConSesion>) => r.gestionar(ID_RESERVA, { accion: "jugo", monto: null, motivo: null })],
    ["fn_bloquear_horario", "HAY_RESERVAS", 409, (r: ReturnType<typeof agendaConSesion>) => r.bloquear({ canchaId: ID_CANCHA, inicio: "i", fin: "f", motivo: null })],
    ["fn_bloquear_horario", "DATOS_INVALIDOS", 400, (r: ReturnType<typeof agendaConSesion>) => r.bloquear({ canchaId: ID_CANCHA, inicio: "i", fin: "f", motivo: null })],
    ["fn_quitar_bloqueo", "BLOQUEO_NO_ENCONTRADO", 404, (r: ReturnType<typeof agendaConSesion>) => r.quitarBloqueo(1)],
  ])("%s con error %s responde %i", async (fn, mensaje, status, llamar) => {
    const { db } = crearSupabaseFalso({ [fn]: { error: { code: "P0001", message: mensaje } } });
    await expect(llamar(agendaConSesion(db))).rejects.toEqual(expect.objectContaining({ status }));
  });

  it("los datos inválidos de la base se muestran como error del formulario de la agenda", async () => {
    const { db } = crearSupabaseFalso({ fn_bloquear_horario: { error: { code: "P0001", message: "DATOS_INVALIDOS" } } });
    await expect(agendaConSesion(db).bloquear({ canchaId: ID_CANCHA, inicio: "i", fin: "f", motivo: null })).rejects.toEqual(
      expect.objectContaining({ codigo: "DATOS_INVALIDOS_AGENDA" }),
    );
  });
});

describe("mis reservas: cancelación hecha por el local", () => {
  const fila = { id: ID_RESERVA, codigo: "RY", estado: "cancelled", inicio: "a", fin: "b", total: "100", adelanto: "50", cancha: "C", deporte: "futbol", local: "L", slug: "s", distrito: "D" };

  it("el jugador ve el motivo que escribió el local", () => {
    expect(aReserva({ ...fila, cancelada_por_local: true, motivo_cancelacion: "Lluvia" })).toEqual(
      expect.objectContaining({ canceladaPorLocal: true, motivoCancelacion: "Lluvia" }),
    );
  });

  it("si canceló el mismo jugador (o la base es antigua) no hay motivo del local", () => {
    expect(aReserva(fila)).toEqual(expect.objectContaining({ canceladaPorLocal: false, motivoCancelacion: null }));
  });
});
