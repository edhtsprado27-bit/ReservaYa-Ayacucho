// Pruebas de integración de la API REST: se llaman las rutas reales de
// src/app/api (presentación) que usan los casos de uso (aplicación) y los
// repositorios (infraestructura). Solo Supabase se reemplaza por uno falso.
import { crearSupabaseFalso, ID_CANCHA, ID_LOCAL, ID_PAGO, ID_RESERVA, PNG, type RespuestaRpc } from "../apoyo/supabase-falso";

// Fuera de Next.js no existe el contexto del pedido: se simulan connection(), la caché y la sesión
jest.mock("next/server", () => ({ ...jest.requireActual("next/server"), connection: jest.fn(async () => undefined) }));
jest.mock("next/cache", () => ({ cacheLife: jest.fn(), cacheTag: jest.fn(), revalidateTag: jest.fn() }));

let supabase = crearSupabaseFalso();
jest.mock("@/modules/compartido/infraestructura/supabase/cliente-servidor", () => ({
  crearClienteServidor: jest.fn(async () => supabase.db),
}));
jest.mock("@/modules/compartido/infraestructura/supabase/cliente-publico", () => ({
  getSupabase: jest.fn(() => supabase.db),
}));

type Respuestas = Record<string, RespuestaRpc>;

/** Carga las rutas de nuevo (caché del catálogo vacía) con un Supabase que responde lo indicado */
function preparar(respuestas: Respuestas = {}) {
  supabase = crearSupabaseFalso(respuestas);
  let rutas!: ReturnType<typeof cargar>;
  jest.isolateModules(() => {
    rutas = cargar();
  });
  return rutas;
}
function cargar() {
  return {
    canchas: require("@/app/api/canchas/route"),
    canchaId: require("@/app/api/canchas/[id]/route"),
    mias: require("@/app/api/canchas/mias/route"),
    admin: require("@/app/api/admin/locales/[id]/route"),
    disponibilidad: require("@/app/api/disponibilidad/route"),
    reservas: require("@/app/api/reservas/route"),
    cancelar: require("@/app/api/reservas/[id]/cancelar/route"),
    pago: require("@/app/api/reservas/[id]/pago/route"),
    revisar: require("@/app/api/pagos/[id]/revisar/route"),
    datosPago: require("@/app/api/locales/[id]/pago/route"),
    agenda: require("@/app/api/dueno/agenda/route"),
    manual: require("@/app/api/dueno/reservas/route"),
    gestionar: require("@/app/api/dueno/reservas/[id]/route"),
    bloqueos: require("@/app/api/dueno/bloqueos/route"),
    bloqueoId: require("@/app/api/dueno/bloqueos/[id]/route"),
    configLocal: require("@/app/api/dueno/locales/[id]/route"),
    canchasLocal: require("@/app/api/dueno/locales/[id]/canchas/route"),
    cancha: require("@/app/api/dueno/canchas/[id]/route"),
    adminLocales: require("@/app/api/admin/locales/route"),
    docs: require("@/app/api-docs/route"),
  };
}

const json = (url: string, metodo: string, cuerpo?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const fila = {
  id: ID_LOCAL, slug: "cancha-demo", nombre: "Cancha Demo", distrito: "Ayacucho", direccion: "Jr. Demo 123", referencia: null,
  lat: "-13.16", lng: "-74.22", deportes: ["futbol"], techada: false, precio_desde: "50", telefono: null, rating: null, total_resenas: null,
};

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));

describe("GET /api/canchas", () => {
  it("responde las canchas publicadas con caché de CDN", async () => {
    const { canchas } = preparar({ fn_catalogo_canchas: { data: [fila] } });
    const res = await canchas.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
    const cuerpo = await res.json();
    expect(cuerpo.total).toBe(1);
    expect(cuerpo.canchas[0]).toEqual(expect.objectContaining({ nombre: "Cancha Demo", lat: -13.16, deportes: ["Fútbol"] }));
  });

  it("varias visitas seguidas usan la caché en memoria (una sola consulta)", async () => {
    const { canchas } = preparar({ fn_catalogo_canchas: { data: [fila] } });
    await canchas.GET();
    await canchas.GET();
    await canchas.GET();
    expect(supabase.rpc.mock.calls.filter(([fn]) => fn === "fn_catalogo_canchas")).toHaveLength(1);
  });

  it("si faltan las migraciones responde 502 con un mensaje claro y sin caché", async () => {
    const { canchas } = preparar({ fn_catalogo_canchas: { error: { code: "PGRST202", message: "Could not find the function" } } });
    const res = await canchas.GET();
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ codigo: "FALTA_MIGRACION", error: expect.stringMatching(/migraciones/) });
  });
});

describe("catálogo con sesión", () => {
  it("POST /api/canchas registra y valida", async () => {
    const { canchas } = preparar({ fn_proponer_local: { data: { id: ID_LOCAL, slug: "nueva", estado: "pending_review" } } });
    const malo = await canchas.POST(json("/api/canchas", "POST", "esto no es json"));
    expect(malo.status).toBe(400);
    expect((await malo.json()).codigo).toBe("DATOS_INVALIDOS");

    const ok = await canchas.POST(json("/api/canchas", "POST", { nombre: "Nueva", distrito: "Ayacucho", lat: -13.16, lng: -74.22 }));
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ ok: true, id: ID_LOCAL, slug: "nueva", estado: "pending_review" });
  });

  it("solo dueños o admin pueden registrar (403 desde la base)", async () => {
    const { canchas } = preparar({ fn_proponer_local: { error: { message: "SOLO_DUENOS" } } });
    const res = await canchas.POST(json("/api/canchas", "POST", { nombre: "Nueva", distrito: "Ayacucho", lat: -13.16, lng: -74.22 }));
    expect(res.status).toBe(403);
  });

  it("PUT y DELETE /api/canchas/{id} validan el id", async () => {
    const { canchaId } = preparar({ fn_reemplazar_propuesta: { data: { id: ID_LOCAL, slug: "x", estado: "pending_review" } } });
    expect((await canchaId.PUT(json("/api/canchas/x", "PUT", { nombre: "A", distrito: "B", lat: 1, lng: 2 }), ctx("x"))).status).toBe(404);
    expect((await canchaId.PUT(json(`/api/canchas/${ID_LOCAL}`, "PUT", { nombre: "A", distrito: "B", lat: 1, lng: 2 }), ctx(ID_LOCAL))).status).toBe(200);
    expect((await canchaId.DELETE(json("/api/canchas/x", "DELETE"), ctx("x"))).status).toBe(404);
    expect((await canchaId.DELETE(json(`/api/canchas/${ID_LOCAL}`, "DELETE"), ctx(ID_LOCAL))).status).toBe(200);
  });

  it("GET /api/canchas/mias sin sesión devuelve una lista vacía", async () => {
    const { mias } = preparar({ fn_mis_pendientes: { data: [fila] } });
    supabase.getUser.mockResolvedValueOnce({ data: { user: null } } as never);
    expect(await (await mias.GET()).json()).toEqual({ canchas: [] });
    const conSesion = await mias.GET();
    expect((await conSesion.json()).canchas).toHaveLength(1);
    expect(conSesion.headers.get("cache-control")).toBe("private, no-store");
  });

  it("al aprobar una cancha el catálogo público se renueva al instante", async () => {
    const { canchas, admin } = preparar({
      fn_catalogo_canchas: { data: [fila] },
      fn_revisar_local: { data: { id: ID_LOCAL, nombre: "Cancha Demo", estado: "approved" } },
    });
    await canchas.GET();
    expect((await admin.POST(json(`/api/admin/locales/${ID_LOCAL}`, "POST", { accion: "borrar" }), ctx(ID_LOCAL))).status).toBe(400);
    const r = await admin.POST(json(`/api/admin/locales/${ID_LOCAL}`, "POST", { accion: "aprobar" }), ctx(ID_LOCAL));
    expect(r.status).toBe(200);
    await canchas.GET();
    expect(supabase.rpc.mock.calls.filter(([fn]) => fn === "fn_catalogo_canchas")).toHaveLength(2);
  });
});

describe("GET /api/disponibilidad", () => {
  it("valida los parámetros", async () => {
    const { disponibilidad } = preparar();
    const { NextRequest } = jest.requireActual("next/server");
    const res = await disponibilidad.GET(new NextRequest(`http://localhost/api/disponibilidad?local=x&fecha=ayer`));
    expect(res.status).toBe(400);
    expect((await res.json()).codigo).toBe("DATOS_INVALIDOS_RESERVA");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("devuelve la grilla con 5 s de caché en el CDN", async () => {
    const { disponibilidad } = preparar({
      fn_disponibilidad_local: { data: [{ cancha_id: ID_CANCHA, inicio: "2026-12-01T19:00:00-05:00", fin: "2026-12-01T20:00:00-05:00", estado: "libre", precio: "50" }] },
    });
    const { NextRequest } = jest.requireActual("next/server");
    const res = await disponibilidad.GET(new NextRequest(`http://localhost/api/disponibilidad?local=${ID_LOCAL}&fecha=2026-12-01`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=5, stale-while-revalidate=15");
    expect((await res.json()).turnos[0]).toEqual(expect.objectContaining({ estado: "libre", precio: 50 }));
  });
});

describe("reservas", () => {
  const pedido = { canchaId: ID_CANCHA, inicio: "2026-12-01T19:00:00-05:00", fin: "2026-12-01T21:00:00-05:00", clave: "clave-de-prueba-123" };

  it("POST /api/reservas aparta el horario (201)", async () => {
    const { reservas } = preparar({
      fn_reservar: { data: { id: ID_RESERVA, codigo: "RY-ABCD", estado: "pending_payment", inicio: "a", fin: "b", total: 100, adelanto: 50, vence: "v" } },
    });
    const res = await reservas.POST(json("/api/reservas", "POST", pedido));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).reserva.codigo).toBe("RY-ABCD");
    expect(supabase.rpc).toHaveBeenCalledWith("fn_reservar", expect.objectContaining({ p_clave: "clave-de-prueba-123", p_inicio: "2026-12-02T00:00:00.000Z" }));
  });

  it.each([
    ["HORARIO_OCUPADO", 409, "HORARIO_OCUPADO"],
    ["BOOKING_IN_PAST", 400, "HORARIO_PASADO"],
    ["DEMASIADAS_PENDIENTES", 429, "DEMASIADAS_PENDIENTES"],
  ])("si la base responde %s -> %i %s", async (mensaje, status, codigo) => {
    const { reservas } = preparar({ fn_reservar: { error: { message: mensaje } } });
    const res = await reservas.POST(json("/api/reservas", "POST", pedido));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, codigo, error: expect.any(String) });
  });

  it("un pedido inválido no llega a la base (400)", async () => {
    const { reservas } = preparar();
    expect((await reservas.POST(json("/api/reservas", "POST", { canchaId: "x" }))).status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("GET /api/reservas sin sesión devuelve una lista vacía", async () => {
    const { reservas } = preparar({ fn_mis_reservas: { error: { code: "42501", message: "permission denied" } } });
    const res = await reservas.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reservas: [] });
  });

  it("POST /api/reservas/{id}/cancelar", async () => {
    const { cancelar } = preparar({ fn_cancelar_reserva: { data: { con_devolucion: false } } });
    const res = await cancelar.POST(json(`/api/reservas/${ID_RESERVA}/cancelar`, "POST", { motivo: "No puedo ir" }), ctx(ID_RESERVA));
    expect(await res.json()).toEqual({ ok: true, conDevolucion: false });
    expect((await cancelar.POST(json("/api/reservas/x/cancelar", "POST"), ctx("x"))).status).toBe(400);
  });
});

describe("pagos", () => {
  const formulario = (metodo: string, datos: Uint8Array = PNG) => {
    const f = new FormData();
    f.set("metodo", metodo);
    f.set("imagen", new Blob([new Uint8Array(datos)], { type: "image/png" }), "captura.png");
    return new Request(`http://localhost/api/reservas/${ID_RESERVA}/pago`, { method: "POST", body: f });
  };

  it("POST /api/reservas/{id}/pago sube la captura y registra el pago (sin IA configurada)", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { pago } = preparar({
      fn_estado_pago: { data: { estado: "pending_payment", adelanto: 50, titular: "Juan", pago: null } },
      fn_registrar_pago: { data: { pago: ID_PAGO, estado_pago: "submitted", resultado: null } },
    });
    const res = await pago.POST(formulario("yape"), ctx(ID_RESERVA));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, pago: ID_PAGO, estadoPago: "submitted", resultado: null });
    expect(supabase.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${ID_RESERVA}/[0-9a-f]{64}\\.png$`)), expect.any(Uint8Array), {
      contentType: "image/png",
      upsert: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_registrar_pago", expect.objectContaining({ p_metodo: "yape", p_lectura: null }));
  });

  it("rechaza un método inválido o un archivo que no es imagen", async () => {
    const { pago } = preparar({ fn_estado_pago: { data: { estado: "pending_payment", adelanto: 50, pago: null } } });
    expect((await pago.POST(formulario("bitcoin"), ctx(ID_RESERVA))).status).toBe(400);
    const res = await pago.POST(formulario("plin", new TextEncoder().encode("hola")), ctx(ID_RESERVA));
    expect((await res.json()).codigo).toBe("IMAGEN_INVALIDA");
  });

  it("POST /api/pagos/{id}/revisar", async () => {
    const { revisar } = preparar({ fn_revisar_pago: { data: { estado_reserva: "confirmed" } } });
    expect((await revisar.POST(json(`/api/pagos/${ID_PAGO}/revisar`, "POST", { accion: "otra" }), ctx(ID_PAGO))).status).toBe(400);
    const res = await revisar.POST(json(`/api/pagos/${ID_PAGO}/revisar`, "POST", { accion: "confirmar" }), ctx(ID_PAGO));
    expect(await res.json()).toEqual({ ok: true, estadoReserva: "confirmed" });
  });

  it("PUT /api/locales/{id}/pago", async () => {
    const { datosPago } = preparar({ fn_guardar_datos_pago: { data: { yape: "966123456", plin: null, titular: "Juan" } } });
    const res = await datosPago.PUT(json(`/api/locales/${ID_LOCAL}/pago`, "PUT", { yape: "966123456", titular: "Juan" }), ctx(ID_LOCAL));
    expect(await res.json()).toEqual({ ok: true, datos: { yape: "966123456", plin: null, titular: "Juan" } });
  });
});

describe("agenda del dueño", () => {
  const agendaDeLaBase = {
    local: { id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", estado: "approved", adelanto_pct: 50 },
    fecha: "2026-12-01",
    ahora: "2026-12-01T22:00:00+00:00",
    canchas: [],
    reservas: [],
    bloqueos: [],
  };
  const turno = { canchaId: ID_CANCHA, inicio: "2026-12-01T19:00:00-05:00", fin: "2026-12-01T21:00:00-05:00" };

  it("GET /api/dueno/agenda devuelve el día sin caché", async () => {
    const { NextRequest } = jest.requireActual("next/server");
    const { agenda } = preparar({ fn_agenda_local: { data: agendaDeLaBase } });
    const res = await agenda.GET(new NextRequest(`http://localhost/api/dueno/agenda?local=${ID_LOCAL}&fecha=2026-12-01`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).agenda.local).toEqual(expect.objectContaining({ nombre: "La Bombonera", adelantoPct: 50 }));
    expect(supabase.rpc).toHaveBeenCalledWith("fn_agenda_local", { p_local: ID_LOCAL, p_fecha: "2026-12-01" });
  });

  it("GET /api/dueno/agenda: parámetros inválidos (400) y local ajeno (403)", async () => {
    const { NextRequest } = jest.requireActual("next/server");
    const { agenda } = preparar({ fn_agenda_local: { error: { code: "P0001", message: "LOCAL_AJENO" } } });
    expect((await agenda.GET(new NextRequest("http://localhost/api/dueno/agenda?local=x"))).status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
    const res = await agenda.GET(new NextRequest(`http://localhost/api/dueno/agenda?local=${ID_LOCAL}&fecha=2026-12-01`));
    expect(res.status).toBe(403);
    expect((await res.json()).codigo).toBe("LOCAL_AJENO");
  });

  it("POST /api/dueno/reservas anota una reserva confirmada (201)", async () => {
    const { manual } = preparar({ fn_reserva_manual: { data: { id: ID_RESERVA, codigo: "RY-7K2M9P", total: 140, pagado: 30, estado: "confirmed" } } });
    const res = await manual.POST(json("/api/dueno/reservas", "POST", { ...turno, nombre: "Carlos", telefono: "966123456", pagado: 30 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, reserva: { id: ID_RESERVA, codigo: "RY-7K2M9P", total: 140, pagado: 30, estado: "confirmed" } });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_reserva_manual", expect.objectContaining({ p_nombre: "Carlos", p_pagado: 30, p_inicio: "2026-12-02T00:00:00.000Z" }));
  });

  it.each([
    ["HORARIO_OCUPADO", 409, "HORARIO_OCUPADO"],
    ["COURT_BLACKOUT", 409, "HORARIO_CERRADO"],
    ["NOMBRE_CLIENTE_INVALIDO", 400, "NOMBRE_CLIENTE_INVALIDO"],
    ["MONTO_INVALIDO", 400, "MONTO_INVALIDO"],
  ])("POST /api/dueno/reservas: si la base responde %s -> %i %s", async (mensaje, status, codigo) => {
    const { manual } = preparar({ fn_reserva_manual: { error: { code: "P0001", message: mensaje } } });
    const res = await manual.POST(json("/api/dueno/reservas", "POST", { ...turno, nombre: "Carlos" }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, codigo, error: expect.any(String) });
  });

  it("POST /api/dueno/reservas: un cuerpo inválido no llega a la base", async () => {
    const { manual } = preparar();
    expect((await manual.POST(json("/api/dueno/reservas", "POST", "esto no es json"))).status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("PATCH /api/dueno/reservas/{id} cobra, marca y cancela", async () => {
    const { gestionar } = preparar({ fn_gestionar_reserva: { data: { id: ID_RESERVA, estado: "confirmed", pagado: 140, total: 140 } } });
    const res = await gestionar.PATCH(json(`/api/dueno/reservas/${ID_RESERVA}`, "PATCH", { accion: "cobrar", monto: 70 }), ctx(ID_RESERVA));
    expect(await res.json()).toEqual({ ok: true, reserva: { id: ID_RESERVA, estado: "confirmed", pagado: 140, total: 140 } });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_gestionar_reserva", { p_reserva: ID_RESERVA, p_accion: "cobrar", p_monto: 70, p_motivo: null });
    expect((await gestionar.PATCH(json(`/api/dueno/reservas/${ID_RESERVA}`, "PATCH", { accion: "borrar" }), ctx(ID_RESERVA))).status).toBe(400);
    expect((await gestionar.PATCH(json("/api/dueno/reservas/x", "PATCH", { accion: "jugo" }), ctx("x"))).status).toBe(400);
  });

  it("PATCH /api/dueno/reservas/{id}: cancelar sin motivo o antes de tiempo", async () => {
    const { gestionar } = preparar({ fn_gestionar_reserva: { error: { code: "P0001", message: "FALTA_MOTIVO" } } });
    const res = await gestionar.PATCH(json(`/api/dueno/reservas/${ID_RESERVA}`, "PATCH", { accion: "cancelar" }), ctx(ID_RESERVA));
    expect(res.status).toBe(400);
    expect((await res.json()).codigo).toBe("FALTA_MOTIVO");
  });

  it("POST /api/dueno/bloqueos cierra horas (201) y avisa si hay reservas (409)", async () => {
    const { bloqueos } = preparar({ fn_bloquear_horario: { data: { id: 12 } } });
    const res = await bloqueos.POST(json("/api/dueno/bloqueos", "POST", { ...turno, motivo: "Torneo" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, bloqueo: { id: 12 } });

    const otra = preparar({ fn_bloquear_horario: { error: { code: "P0001", message: "HAY_RESERVAS" } } });
    const conflicto = await otra.bloqueos.POST(json("/api/dueno/bloqueos", "POST", turno));
    expect(conflicto.status).toBe(409);
    expect((await conflicto.json()).codigo).toBe("HAY_RESERVAS");
  });

  it("DELETE /api/dueno/bloqueos/{id}", async () => {
    const { bloqueoId } = preparar({ fn_quitar_bloqueo: { data: null } });
    const res = await bloqueoId.DELETE(json("/api/dueno/bloqueos/12", "DELETE"), ctx("12"));
    expect(await res.json()).toEqual({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_quitar_bloqueo", { p_bloqueo: 12 });
    expect((await bloqueoId.DELETE(json("/api/dueno/bloqueos/abc", "DELETE"), ctx("abc"))).status).toBe(400);
  });
});

describe("configuración del local", () => {
  const configDeLaBase = {
    local: { id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", distrito: "Ayacucho", estado: "approved", adelanto_pct: 50 },
    canchas: [{ id: ID_CANCHA, nombre: "Cancha 1", deporte: "futbol", precio: 60, horario: [{ dia: 1, abre: "08:00", cierra: "23:00" }] }],
  };
  const ajustes = { direccion: "Jr. Lima 123", whatsapp: "966123456", adelantoPct: 30, minutosApartado: 20, horasCancelacion: 12 };
  const cancha = { nombre: "Cancha 1", deporte: "futbol", techada: false, maxMinutos: 120, horario: [{ dia: 1, abre: "08:00", cierra: "23:00" }], precio: 70, precioPunta: 90, puntaDesde: "19:00" };

  it("GET /api/dueno/locales/{id} devuelve la configuración sin caché", async () => {
    const { configLocal } = preparar({ fn_config_local: { data: configDeLaBase } });
    const res = await configLocal.GET(json(`/api/dueno/locales/${ID_LOCAL}`, "GET"), ctx(ID_LOCAL));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const { config } = await res.json();
    expect(config.local).toEqual(expect.objectContaining({ nombre: "La Bombonera", adelantoPct: 50 }));
    expect(config.canchas[0]).toEqual(expect.objectContaining({ precio: 60, horario: [{ dia: 1, abre: "08:00", cierra: "23:00" }] }));
    expect((await configLocal.GET(json("/api/dueno/locales/x", "GET"), ctx("x"))).status).toBe(400);
  });

  it("GET /api/dueno/locales/{id} de otro dueño: 403", async () => {
    const { configLocal } = preparar({ fn_config_local: { error: { code: "P0001", message: "LOCAL_AJENO" } } });
    const res = await configLocal.GET(json(`/api/dueno/locales/${ID_LOCAL}`, "GET"), ctx(ID_LOCAL));
    expect(res.status).toBe(403);
  });

  it("PUT /api/dueno/locales/{id} guarda las reglas y renueva la ficha pública", async () => {
    const { revalidateTag } = jest.requireMock("next/cache");
    const { configLocal } = preparar({ fn_guardar_local: { data: { id: ID_LOCAL, slug: "la-bombonera" } } });
    const res = await configLocal.PUT(json(`/api/dueno/locales/${ID_LOCAL}`, "PUT", ajustes), ctx(ID_LOCAL));
    expect(await res.json()).toEqual({ ok: true, local: { id: ID_LOCAL, slug: "la-bombonera" } });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_guardar_local", expect.objectContaining({ p_adelanto: 30, p_apartado: 20, p_cancelacion: 12 }));
    expect(revalidateTag).toHaveBeenCalledWith("local-la-bombonera", { expire: 0 });
  });

  it.each([
    ["AJUSTES_INVALIDOS", 400],
    ["TELEFONO_INVALIDO", 400],
    ["LOCAL_AJENO", 403],
  ])("PUT /api/dueno/locales/{id}: si la base responde %s -> %i", async (mensaje, status) => {
    const { configLocal } = preparar({ fn_guardar_local: { error: { code: "P0001", message: mensaje } } });
    const res = await configLocal.PUT(json(`/api/dueno/locales/${ID_LOCAL}`, "PUT", ajustes), ctx(ID_LOCAL));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, codigo: mensaje, error: expect.any(String) });
  });

  it("PUT /api/dueno/canchas/{id} guarda horario y precios", async () => {
    const { cancha: ruta } = preparar({ fn_guardar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera", fuera_de_horario: 2 } } });
    const res = await ruta.PUT(json(`/api/dueno/canchas/${ID_CANCHA}`, "PUT", cancha), ctx(ID_CANCHA));
    expect(await res.json()).toEqual({ ok: true, cancha: { id: ID_CANCHA, slug: "la-bombonera", fueraDeHorario: 2 } });
    expect(supabase.rpc).toHaveBeenCalledWith("fn_guardar_cancha", expect.objectContaining({ p_precio: 70, p_precio_punta: 90, p_punta_desde: "19:00" }));
    expect((await ruta.PUT(json(`/api/dueno/canchas/${ID_CANCHA}`, "PUT", { ...cancha, deporte: "tenis" }), ctx(ID_CANCHA))).status).toBe(400);
  });

  it("PUT /api/dueno/canchas/{id}: horario vacío (400)", async () => {
    const { cancha: ruta } = preparar({ fn_guardar_cancha: { error: { code: "P0001", message: "HORARIO_VACIO" } } });
    const res = await ruta.PUT(json(`/api/dueno/canchas/${ID_CANCHA}`, "PUT", { ...cancha, horario: [] }), ctx(ID_CANCHA));
    expect(res.status).toBe(400);
    expect((await res.json()).codigo).toBe("HORARIO_VACIO");
  });

  it("POST /api/dueno/locales/{id}/canchas agrega una cancha (201)", async () => {
    const { canchasLocal } = preparar({ fn_agregar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera" } } });
    const res = await canchasLocal.POST(json(`/api/dueno/locales/${ID_LOCAL}/canchas`, "POST", { nombre: "Cancha 2", deporte: "voley", precio: 40 }), ctx(ID_LOCAL));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, cancha: { id: ID_CANCHA, slug: "la-bombonera" } });
    expect((await canchasLocal.POST(json(`/api/dueno/locales/${ID_LOCAL}/canchas`, "POST", "no es json"), ctx(ID_LOCAL))).status).toBe(400);
  });

  it("DELETE /api/dueno/canchas/{id}: con reservas pendientes no se quita (409)", async () => {
    const { cancha: ruta } = preparar({ fn_quitar_cancha: { error: { code: "P0001", message: "CANCHA_CON_RESERVAS" } } });
    const res = await ruta.DELETE(json(`/api/dueno/canchas/${ID_CANCHA}`, "DELETE"), ctx(ID_CANCHA));
    expect(res.status).toBe(409);
    const otra = preparar({ fn_quitar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera" } } });
    expect(await (await otra.cancha.DELETE(json(`/api/dueno/canchas/${ID_CANCHA}`, "DELETE"), ctx(ID_CANCHA))).json()).toEqual({ ok: true });
  });
});

describe("administración de locales", () => {
  it("GET /api/admin/locales: solo admin", async () => {
    const { adminLocales } = preparar({
      fn_locales_admin: { data: [{ id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", distrito: "Ayacucho", estado: "approved", sin_dueno: true, canchas: 2, reservas_futuras: 0 }] },
    });
    const res = await adminLocales.GET();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await res.json()).locales[0]).toEqual(expect.objectContaining({ nombre: "La Bombonera", sinDueno: true }));

    const otro = preparar({ fn_locales_admin: { error: { code: "P0001", message: "SOLO_ADMIN" } } });
    expect((await otro.adminLocales.GET()).status).toBe(403);
  });

  it("PATCH /api/admin/locales/{id} asigna el dueño real", async () => {
    const { admin } = preparar({
      fn_asignar_dueno: { data: { id: ID_LOCAL, slug: "la-bombonera", estado: "approved", dueno: "Juan", correo: "juan@gmail.com", ahora_es_dueno: true } },
    });
    const res = await admin.PATCH(json(`/api/admin/locales/${ID_LOCAL}`, "PATCH", { accion: "asignar_dueno", correo: "Juan@Gmail.com" }), ctx(ID_LOCAL));
    expect((await res.json()).local).toEqual(expect.objectContaining({ dueno: "Juan", ahoraEsDueno: true }));
    expect(supabase.rpc).toHaveBeenCalledWith("fn_asignar_dueno", { p_local: ID_LOCAL, p_correo: "juan@gmail.com" });
  });

  it("PATCH /api/admin/locales/{id}: correo mal escrito, sin cuenta o acción desconocida", async () => {
    const { admin } = preparar({ fn_asignar_dueno: { error: { code: "P0001", message: "USUARIO_NO_ENCONTRADO" } } });
    expect((await admin.PATCH(json(`/api/admin/locales/${ID_LOCAL}`, "PATCH", { accion: "asignar_dueno", correo: "juan" }), ctx(ID_LOCAL))).status).toBe(400);
    expect((await admin.PATCH(json(`/api/admin/locales/${ID_LOCAL}`, "PATCH", { accion: "asignar_dueno", correo: "nadie@x.pe" }), ctx(ID_LOCAL))).status).toBe(404);
    expect((await admin.PATCH(json(`/api/admin/locales/${ID_LOCAL}`, "PATCH", { accion: "borrar" }), ctx(ID_LOCAL))).status).toBe(400);
  });

  it("PATCH /api/admin/locales/{id} suspende y saca el local del mapa al instante", async () => {
    const { admin, canchas } = preparar({
      fn_catalogo_canchas: { data: [fila] },
      fn_cambiar_estado_local: { data: { id: ID_LOCAL, slug: "cancha-demo", estado: "suspended", reservas_futuras: 2 } },
    });
    await canchas.GET();
    const res = await admin.PATCH(json(`/api/admin/locales/${ID_LOCAL}`, "PATCH", { accion: "suspender", motivo: "Reclamos" }), ctx(ID_LOCAL));
    expect((await res.json()).local).toEqual(expect.objectContaining({ estado: "suspended", reservasFuturas: 2 }));
    await canchas.GET();
    // la caché en memoria del catálogo se borró: se volvió a consultar la base
    expect(supabase.rpc.mock.calls.filter(([fn]) => fn === "fn_catalogo_canchas")).toHaveLength(2);
  });
});

describe("GET /api-docs", () => {
  it("sirve la página de Swagger UI que lee /openapi.yaml", async () => {
    const { docs } = preparar();
    const res = docs.GET();
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("SwaggerUIBundle");
    expect(html).toContain("/swagger-ui/swagger-ui-bundle.js");
    expect(html).toContain('url: "/openapi.yaml"');
  });
});
