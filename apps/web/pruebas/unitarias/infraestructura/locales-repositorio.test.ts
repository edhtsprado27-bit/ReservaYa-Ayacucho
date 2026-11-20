// Gestión de locales con Supabase (infraestructura): funciones de la base que
// llama, conversión de respuestas y errores, renovación de cachés públicas y
// el helper del navegador para llamar a la API.
import { revalidateTag } from "next/cache";
import { llamarApi } from "@/modules/compartido/presentacion/llamar-api";
import { LocalesConVistasFrescas, localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { aConfig, aLocalAdmin } from "@/modules/locales/infraestructura/mapeo-locales";
import { refrescarVistasPublicas } from "@/modules/locales/infraestructura/vistas-publicas";
import type { LocalesRepositorio } from "@/modules/locales/dominio/locales.repositorio";
import { crearSupabaseFalso, ID_CANCHA, ID_LOCAL } from "../../apoyo/supabase-falso";

jest.mock("next/cache", () => ({ revalidateTag: jest.fn(), cacheLife: jest.fn(), cacheTag: jest.fn() }));
const olvidar = jest.fn();
jest.mock("@/modules/catalogo/infraestructura/composicion", () => ({ olvidarCatalogoPublico: () => olvidar() }));

const configDeLaBase = {
  local: {
    id: ID_LOCAL, nombre: "La Bombonera", slug: "la-bombonera", distrito: "Ayacucho", estado: "suspended",
    motivo_estado: "Reclamos", direccion: "Jr. Lima 123", referencia: "", whatsapp: "966123456",
    adelanto_pct: 30, minutos_apartado: 20, horas_cancelacion: 12,
  },
  canchas: [
    {
      id: ID_CANCHA, nombre: "Cancha 1", deporte: "futbol", techada: true, minutos_turno: 60, max_minutos: 120,
      horario: [
        { dia: 1, abre: "08:00", cierra: "12:00" },
        { dia: 1, abre: "14:00", cierra: "23:00" },
        { dia: 0, abre: "09:00", cierra: "20:00" },
      ],
      precio: "70.00", precio_punta: "90.00", punta_desde: "19:00", reservas_futuras: 2,
    },
  ],
};

const sinRefrescar = () => undefined;

describe("mapeo de la configuración", () => {
  it("convierte números y une dos rangos del mismo día", () => {
    const c = aConfig(configDeLaBase);
    expect(c.local).toEqual(expect.objectContaining({ estado: "suspended", motivoEstado: "Reclamos", referencia: null, adelantoPct: 30 }));
    expect(c.canchas[0]).toEqual(expect.objectContaining({ precio: 70, precioPunta: 90, puntaDesde: "19:00", reservasFuturas: 2, maxMinutos: 120 }));
    expect(c.canchas[0].horario).toEqual([
      { dia: 0, abre: "09:00", cierra: "20:00" },
      { dia: 1, abre: "08:00", cierra: "23:00" },
    ]);
  });

  it("usa valores por defecto si faltan datos", () => {
    const c = aConfig({ local: { id: ID_LOCAL, nombre: "L", slug: "l", estado: "approved" }, canchas: [{ id: ID_CANCHA, nombre: "C", deporte: "voley", techada: false }] });
    expect(c.local).toEqual(expect.objectContaining({ distrito: "", direccion: "", whatsapp: null, adelantoPct: 50, minutosApartado: 15, horasCancelacion: 6 }));
    expect(c.canchas[0]).toEqual(expect.objectContaining({ minutosTurno: 60, maxMinutos: 180, horario: [], precio: null, precioPunta: null, reservasFuturas: 0 }));
    expect(aConfig({}).canchas).toEqual([]);
  });

  it("fila del administrador", () => {
    expect(aLocalAdmin({ id: ID_LOCAL, nombre: "L", slug: "l", distrito: "D", estado: "approved", sin_dueno: true, canchas: 2, reservas_futuras: "3" })).toEqual({
      id: ID_LOCAL, nombre: "L", slug: "l", distrito: "D", estado: "approved", motivo: null, sinDueno: true,
      duenoNombre: null, duenoCorreo: null, canchas: 2, reservasFuturas: 3,
    });
  });
});

describe("SupabaseLocalesRepositorio", () => {
  it("llama a las funciones de la base con los parámetros correctos", async () => {
    const cambio = { data: { id: ID_LOCAL, slug: "la-bombonera" } };
    const { db, rpc } = crearSupabaseFalso({
      fn_mis_locales_pago: { data: [{ id: ID_LOCAL, nombre: "La Bombonera", estado: "approved", yape: "9" }] },
      fn_config_local: { data: configDeLaBase },
      fn_guardar_local: cambio,
      fn_guardar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera", fuera_de_horario: 1 } },
      fn_agregar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera" } },
      fn_quitar_cancha: { data: { id: ID_CANCHA, slug: "la-bombonera" } },
      fn_locales_admin: { data: [{ id: ID_LOCAL, nombre: "L", slug: "l", distrito: "D", estado: "approved", sin_dueno: false, dueno_nombre: "Juan", dueno_correo: "j@x.pe", canchas: 1, reservas_futuras: 0 }] },
      fn_asignar_dueno: { data: { id: ID_LOCAL, slug: "la-bombonera", estado: "approved", dueno: "Juan", correo: "j@x.pe", ahora_es_dueno: true } },
      fn_cambiar_estado_local: { data: { id: ID_LOCAL, slug: "la-bombonera", estado: "suspended", reservas_futuras: 4 } },
    });
    const repo = localesConSesion(db, sinRefrescar);

    expect(await repo.misLocales()).toEqual([{ id: ID_LOCAL, nombre: "La Bombonera", estado: "approved" }]);
    expect((await repo.config(ID_LOCAL)).canchas).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("fn_config_local", { p_local: ID_LOCAL });

    await repo.guardarAjustes(ID_LOCAL, { direccion: "Jr. Lima 123", referencia: null, whatsapp: "966123456", adelantoPct: 30, minutosApartado: 20, horasCancelacion: 12 });
    expect(rpc).toHaveBeenCalledWith("fn_guardar_local", {
      p_local: ID_LOCAL, p_direccion: "Jr. Lima 123", p_referencia: null, p_whatsapp: "966123456", p_adelanto: 30, p_apartado: 20, p_cancelacion: 12,
    });

    const horario = [{ dia: 1, abre: "08:00", cierra: "23:00" }];
    expect(
      await repo.guardarCancha(ID_CANCHA, { nombre: "C1", deporte: "futbol", techada: false, maxMinutos: 120, horario, precio: 70, precioPunta: 90, puntaDesde: "19:00" }),
    ).toEqual({ id: ID_CANCHA, slug: "la-bombonera", fueraDeHorario: 1 });
    expect(rpc).toHaveBeenCalledWith("fn_guardar_cancha", {
      p_cancha: ID_CANCHA, p_nombre: "C1", p_deporte: "futbol", p_techada: false, p_max_minutos: 120, p_horario: horario,
      p_precio: 70, p_precio_punta: 90, p_punta_desde: "19:00",
    });

    await repo.agregarCancha(ID_LOCAL, { nombre: "C2", deporte: "futsal", precio: 55 });
    expect(rpc).toHaveBeenCalledWith("fn_agregar_cancha", { p_local: ID_LOCAL, p_nombre: "C2", p_deporte: "futsal", p_precio: 55 });
    await repo.quitarCancha(ID_CANCHA);
    expect(rpc).toHaveBeenCalledWith("fn_quitar_cancha", { p_cancha: ID_CANCHA });

    expect((await repo.localesAdmin())[0]).toEqual(expect.objectContaining({ duenoNombre: "Juan", sinDueno: false }));
    expect(await repo.asignarDueno(ID_LOCAL, "j@x.pe")).toEqual({ id: ID_LOCAL, slug: "la-bombonera", estado: "approved", dueno: "Juan", correo: "j@x.pe", ahoraEsDueno: true });
    expect(await repo.cambiarEstado(ID_LOCAL, "suspender", "Reclamos")).toEqual({ id: ID_LOCAL, slug: "la-bombonera", estado: "suspended", reservasFuturas: 4 });
    expect(rpc).toHaveBeenCalledWith("fn_cambiar_estado_local", { p_local: ID_LOCAL, p_accion: "suspender", p_motivo: "Reclamos" });
  });

  it("sin datos devuelve listas vacías", async () => {
    const { db } = crearSupabaseFalso({ fn_mis_locales_pago: { data: null }, fn_locales_admin: { data: null } });
    const repo = localesConSesion(db, sinRefrescar);
    expect(await repo.misLocales()).toEqual([]);
    expect(await repo.localesAdmin()).toEqual([]);
  });

  it.each([
    ["fn_config_local", "LOCAL_AJENO", 403, (r: LocalesRepositorio) => r.config(ID_LOCAL)],
    ["fn_mis_locales_pago", "SIN_SESION", 401, (r: LocalesRepositorio) => r.misLocales()],
    ["fn_locales_admin", "SOLO_ADMIN", 403, (r: LocalesRepositorio) => r.localesAdmin()],
    ["fn_guardar_cancha", "HORARIO_VACIO", 400, (r: LocalesRepositorio) => r.guardarCancha(ID_CANCHA, {} as never)],
    ["fn_guardar_cancha", "CANCHA_DUPLICADA", 409, (r: LocalesRepositorio) => r.guardarCancha(ID_CANCHA, {} as never)],
    ["fn_quitar_cancha", "CANCHA_CON_RESERVAS", 409, (r: LocalesRepositorio) => r.quitarCancha(ID_CANCHA)],
    ["fn_asignar_dueno", "USUARIO_NO_ENCONTRADO", 404, (r: LocalesRepositorio) => r.asignarDueno(ID_LOCAL, "x@y.pe")],
    ["fn_cambiar_estado_local", "ACCION_NO_PERMITIDA", 409, (r: LocalesRepositorio) => r.cambiarEstado(ID_LOCAL, "reactivar", null)],
    ["fn_agregar_cancha", "DATOS_INVALIDOS", 400, (r: LocalesRepositorio) => r.agregarCancha(ID_LOCAL, {} as never)],
  ])("%s con error %s responde %i", async (fn, mensaje, status, llamar) => {
    const { db } = crearSupabaseFalso({ [fn]: { error: { code: "P0001", message: mensaje } } });
    await expect(llamar(localesConSesion(db, sinRefrescar))).rejects.toEqual(expect.objectContaining({ status }));
  });

  it("los datos inválidos de la base se muestran como error del formulario del local", async () => {
    const { db } = crearSupabaseFalso({ fn_agregar_cancha: { error: { code: "P0001", message: "DATOS_INVALIDOS" } } });
    await expect(localesConSesion(db, sinRefrescar).agregarCancha(ID_LOCAL, {} as never)).rejects.toEqual(
      expect.objectContaining({ codigo: "DATOS_INVALIDOS_LOCAL" }),
    );
  });
});

describe("renovación de las vistas públicas", () => {
  it("después de cada cambio se renueva la ficha y el catálogo de ese local", async () => {
    const cambio = { id: ID_LOCAL, slug: "la-bombonera" };
    const base = {
      misLocales: jest.fn(async () => []),
      config: jest.fn(async () => ({})),
      localesAdmin: jest.fn(async () => []),
      guardarAjustes: jest.fn(async () => cambio),
      guardarCancha: jest.fn(async () => ({ ...cambio, fueraDeHorario: 0 })),
      agregarCancha: jest.fn(async () => cambio),
      quitarCancha: jest.fn(async () => cambio),
      asignarDueno: jest.fn(async () => cambio),
      cambiarEstado: jest.fn(async () => ({ ...cambio, slug: "otro-local" })),
    } as unknown as LocalesRepositorio;
    const refrescar = jest.fn();
    const repo = new LocalesConVistasFrescas(base, refrescar);

    await repo.misLocales();
    await repo.config(ID_LOCAL);
    await repo.localesAdmin();
    await repo.asignarDueno(ID_LOCAL, "x@y.pe");
    expect(refrescar).not.toHaveBeenCalled(); // leer o cambiar de dueño no cambia lo que ven los jugadores

    await repo.guardarAjustes(ID_LOCAL, {} as never);
    await repo.guardarCancha(ID_CANCHA, {} as never);
    await repo.agregarCancha(ID_LOCAL, {} as never);
    await repo.quitarCancha(ID_CANCHA);
    await repo.cambiarEstado(ID_LOCAL, "suspender", "x");
    expect(refrescar.mock.calls).toEqual([["la-bombonera"], ["la-bombonera"], ["la-bombonera"], ["la-bombonera"], ["otro-local"]]);
  });

  it("si la base rechaza el cambio, no se renueva nada", async () => {
    const { db } = crearSupabaseFalso({ fn_quitar_cancha: { error: { message: "ULTIMA_CANCHA" } } });
    const refrescar = jest.fn();
    await expect(localesConSesion(db, refrescar).quitarCancha(ID_CANCHA)).rejects.toBeTruthy();
    expect(refrescar).not.toHaveBeenCalled();
  });

  it("refrescarVistasPublicas borra la ficha (sin copia vieja) y el catálogo en memoria", () => {
    refrescarVistasPublicas("la-bombonera");
    expect(revalidateTag).toHaveBeenCalledWith("local-la-bombonera", { expire: 0 });
    expect(olvidar).toHaveBeenCalled();
  });

  it("por defecto la composición usa refrescarVistasPublicas", async () => {
    const { db } = crearSupabaseFalso({ fn_quitar_cancha: { data: { id: ID_CANCHA, slug: "mi-local" } } });
    await localesConSesion(db).quitarCancha(ID_CANCHA);
    expect(revalidateTag).toHaveBeenCalledWith("local-mi-local", { expire: 0 });
  });
});

describe("llamarApi (navegador)", () => {
  const respuesta = (ok: boolean, cuerpo: unknown) => ({ ok, json: async () => cuerpo }) as Response;
  afterEach(() => jest.restoreAllMocks());

  it("envía JSON y devuelve los datos", async () => {
    const f = jest.spyOn(global, "fetch").mockResolvedValue(respuesta(true, { ok: true, local: { id: 1 } }));
    expect(await llamarApi("/api/x", "PUT", { a: 1 })).toEqual({ ok: true, datos: { ok: true, local: { id: 1 } } });
    expect(f).toHaveBeenCalledWith("/api/x", { method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"a":1}' });
  });

  it("sin cuerpo no manda cabeceras", async () => {
    const f = jest.spyOn(global, "fetch").mockResolvedValue(respuesta(true, { ok: true }));
    await llamarApi("/api/x", "DELETE");
    expect(f).toHaveBeenCalledWith("/api/x", { method: "DELETE", headers: undefined, body: undefined });
  });

  it("devuelve el mensaje del servidor o uno de conexión", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(respuesta(false, { ok: false, error: "Ya tienes una cancha con ese nombre." }));
    expect(await llamarApi("/api/x", "POST", {})).toEqual({ ok: false, error: "Ya tienes una cancha con ese nombre." });
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("red"));
    expect(await llamarApi("/api/x", "POST", {})).toEqual({ ok: false, error: expect.stringMatching(/Sin conexión/) });
    jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, json: async () => Promise.reject(new Error("no json")) } as unknown as Response);
    expect((await llamarApi("/api/x", "GET")).ok).toBe(false);
  });
});
