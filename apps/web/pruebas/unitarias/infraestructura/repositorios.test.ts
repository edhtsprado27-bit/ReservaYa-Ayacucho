// Repositorios y adaptadores de Supabase (infraestructura), con un Supabase falso:
// se comprueba qué función de PostgreSQL llaman, con qué parámetros y cómo
// convierten las filas y los errores.
jest.mock("next/cache", () => ({ cacheLife: jest.fn(), cacheTag: jest.fn() }));

import { createHash } from "node:crypto";
import { SupabaseCatalogoRepositorio, filaACancha } from "@/modules/catalogo/infraestructura/supabase-catalogo.repositorio";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { pagosConSesion } from "@/modules/pagos/infraestructura/composicion";
import { SupabaseAlmacenComprobantes } from "@/modules/pagos/infraestructura/supabase-almacen-comprobantes";
import { SupabasePagosRepositorio } from "@/modules/pagos/infraestructura/supabase-pagos.repositorio";
import { aLocal, aReserva, aTurno } from "@/modules/reservas/infraestructura/mapeo-reservas";
import { SupabaseReservasRepositorio } from "@/modules/reservas/infraestructura/supabase-reservas.repositorio";
import { crearSupabaseFalso, ID_CANCHA, ID_LOCAL, ID_PAGO, ID_RESERVA, PNG } from "../../apoyo/supabase-falso";

const fila = {
  id: ID_LOCAL,
  slug: "cancha-demo",
  nombre: "Cancha Demo",
  distrito: "Andrés Avelino Cáceres Dorregaray",
  direccion: "Jr. Demo 123",
  referencia: null,
  lat: "-13.16",
  lng: "-74.22",
  deportes: ["futbol", "polo"],
  techada: false,
  precio_desde: "50",
  telefono: null,
  rating: null,
  total_resenas: null,
};

describe("SupabaseCatalogoRepositorio", () => {
  it("convierte las filas de fn_catalogo_canchas en canchas del dominio", async () => {
    const { db, rpc } = crearSupabaseFalso({ fn_catalogo_canchas: { data: [fila] } });
    const { canchas, generado } = await new SupabaseCatalogoRepositorio(db).leerPublicadas();
    expect(rpc).toHaveBeenCalledWith("fn_catalogo_canchas");
    expect(canchas[0]).toEqual(
      expect.objectContaining({ distrito: "Andrés Avelino Cáceres D.", lat: -13.16, lng: -74.22, deportes: ["Fútbol"], precioDesde: 50 }),
    );
    expect(Number.isNaN(Date.parse(generado))).toBe(false);
  });

  it("si una cancha no tiene deportes conocidos se muestra como Fútbol", () => {
    expect(filaACancha({ ...fila, deportes: null, rating: "4.5", total_resenas: 3 }).deportes).toEqual(["Fútbol"]);
  });

  it("servicios del local: sin la columna (antes de 012) es una lista vacía; ordena y quita desconocidos", () => {
    expect(filaACancha(fila).servicios).toEqual([]);
    expect(filaACancha({ ...fila, servicios: ["tribuna", "sauna", "vestuarios", "tribuna"] }).servicios).toEqual(["vestuarios", "tribuna"]);
  });

  it("envía los deportes con los códigos de la base al proponer", async () => {
    const { db, rpc } = crearSupabaseFalso({ fn_proponer_local: { data: { id: ID_LOCAL, slug: "x", estado: "pending_review" } } });
    await new SupabaseCatalogoRepositorio(db).proponer({ nombre: "A", distrito: "Ayacucho", lat: 1, lng: 2, deportes: ["Vóley", "Fútbol"], precioDesde: 40 });
    expect(rpc).toHaveBeenCalledWith("fn_proponer_local", expect.objectContaining({ p_deportes: ["voley", "futbol"], p_precio: 40, p_techada: false, p_direccion: null }));
  });

  it("traduce los errores de la base", async () => {
    const { db } = crearSupabaseFalso({ fn_proponer_local: { error: { message: "LOCAL_DUPLICADO" } } });
    await expect(new SupabaseCatalogoRepositorio(db).proponer({ nombre: "A", distrito: "B", lat: 1, lng: 2 })).rejects.toMatchObject({
      codigo: "LOCAL_DUPLICADO",
      status: 409,
    });
  });

  it("llama a las funciones de revisión, retiro y pendientes", async () => {
    const { db, rpc } = crearSupabaseFalso({ fn_mis_pendientes: { data: [fila] }, fn_revisar_local: { data: { id: ID_LOCAL, nombre: "X", estado: "approved" } } });
    const repo = new SupabaseCatalogoRepositorio(db);
    await repo.reemplazar(ID_LOCAL, { nombre: "A", distrito: "B", lat: 1, lng: 2 });
    await repo.retirar(ID_LOCAL);
    expect(await repo.listarPendientes()).toHaveLength(1);
    await repo.revisar(ID_LOCAL, false, "duplicada");
    expect(rpc).toHaveBeenCalledWith("fn_reemplazar_propuesta", expect.objectContaining({ p_id: ID_LOCAL }));
    expect(rpc).toHaveBeenCalledWith("fn_retirar_propuesta", { p_id: ID_LOCAL });
    expect(rpc).toHaveBeenCalledWith("fn_revisar_local", { p_id: ID_LOCAL, p_aprobar: false, p_motivo: "duplicada" });
  });

  it("lista las canchas publicadas de un dueño", async () => {
    const falso = crearSupabaseFalso();
    falso.filasTabla.push({ id: ID_LOCAL, name: "Cancha Demo", address: "Jr. Demo", districts: { name: "Carmen Alto" } });
    const lista = await catalogoConSesion(falso.db).listarPublicadasDe("dueno-1");
    expect(falso.from).toHaveBeenCalledWith("venues");
    expect(falso.consulta.eq).toHaveBeenCalledWith("owner_id", "dueno-1");
    expect(falso.consulta.eq).toHaveBeenCalledWith("status", "approved");
    expect(lista).toEqual([{ id: ID_LOCAL, nombre: "Cancha Demo", direccion: "Jr. Demo", distrito: "Carmen Alto" }]);
  });
});

describe("SupabaseReservasRepositorio", () => {
  it("reserva con fn_reservar y la clave de idempotencia", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_reservar: { data: { id: ID_RESERVA, codigo: "RY-1", estado: "pending_payment", inicio: "a", fin: "b", total: "100", adelanto: "50", vence: null } },
    });
    const r = await new SupabaseReservasRepositorio(db).reservar({ canchaId: ID_CANCHA, inicio: "i", fin: "f", clave: "clave-123456" });
    expect(rpc).toHaveBeenCalledWith("fn_reservar", { p_cancha_id: ID_CANCHA, p_inicio: "i", p_fin: "f", p_clave: "clave-123456" });
    expect(r).toEqual(expect.objectContaining({ codigo: "RY-1", total: 100, adelanto: 50, vence: null }));
  });

  it("un choque en la base llega como HORARIO_OCUPADO (409)", async () => {
    const { db } = crearSupabaseFalso({ fn_reservar: { error: { message: "HORARIO_OCUPADO", code: "P0001" } } });
    await expect(new SupabaseReservasRepositorio(db).reservar({ canchaId: ID_CANCHA, inicio: "i", fin: "f", clave: "clave-123456" })).rejects.toMatchObject({
      codigo: "HORARIO_OCUPADO",
      status: 409,
    });
  });

  it("lee disponibilidad, mis reservas y cancela", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_disponibilidad_local: { data: [{ cancha_id: ID_CANCHA, inicio: "a", fin: "b", estado: "libre", precio: "50" }] },
      fn_mis_reservas: { data: [] },
      fn_cancelar_reserva: { data: { con_devolucion: true } },
    });
    const repo = new SupabaseReservasRepositorio(db);
    expect(await repo.disponibilidad(ID_LOCAL, "2026-12-01")).toEqual([{ cancha: ID_CANCHA, inicio: "a", fin: "b", estado: "libre", precio: 50 }]);
    await repo.misReservas();
    await repo.misReservas(ID_RESERVA);
    expect(await repo.cancelar(ID_RESERVA)).toEqual({ conDevolucion: true });
    expect(rpc).toHaveBeenCalledWith("fn_mis_reservas", {});
    expect(rpc).toHaveBeenCalledWith("fn_mis_reservas", { p_id: ID_RESERVA });
    expect(rpc).toHaveBeenCalledWith("fn_cancelar_reserva", { p_id: ID_RESERVA, p_motivo: null });
  });
});

describe("mapeo de reservas", () => {
  it("usa valores por defecto razonables", () => {
    const local = aLocal({ id: ID_LOCAL, slug: "s", nombre: "N", distrito: "D", lat: "-13", lng: "-74", canchas: [{ id: ID_CANCHA, nombre: "C1", deporte: "voley" }] });
    expect(local).toEqual(expect.objectContaining({ adelantoPct: 50, minutosApartado: 15, horasCancelacion: 6, direccion: "", referencia: null, servicios: [] }));
    expect(aLocal({ id: ID_LOCAL, servicios: ["duchas", "banos"] }).servicios).toEqual(["duchas", "banos"]);
    expect(local.canchas[0]).toEqual(expect.objectContaining({ deporte: "Vóley", minutosTurno: 60, minMinutos: 60, maxMinutos: 180, precioDesde: null }));
    expect(aTurno({ cancha_id: ID_CANCHA, inicio: "a", fin: "b", estado: "ocupado", precio: null }).precio).toBeNull();
    const r = aReserva({ id: ID_RESERVA, codigo: "RY", estado: "confirmed", inicio: "a", fin: "b", total: "100", adelanto: "50", cancha: "C", deporte: "x", local: "L", slug: "s", distrito: "D" });
    expect(r).toEqual(expect.objectContaining({ pagado: 0, deporte: "Multideporte", cancelable: false, lat: null, horasCancelacion: 6 }));
  });
});

describe("SupabasePagosRepositorio", () => {
  it("lee el estado del pago y la configuración de la IA", async () => {
    const { db } = crearSupabaseFalso({
      fn_estado_pago: {
        data: {
          estado: "payment_review", adelanto: "50", yape: "966123456", titular: "Juan",
          pago: { id: ID_PAGO, estado: "ai_verified", metodo: "yape", monto: "50", enviado: "t", resultado: "match", leido: { monto: "50", operacion: "123" } },
        },
      },
      fn_config_ia: { data: { modelo: "google/gemma", respaldo: ["a", "b"], temperatura: 0, max_tokens: 800, prompt: null, version: "ocr-v1" } },
    });
    const repo = new SupabasePagosRepositorio(db);
    const estado = await repo.estadoPago(ID_RESERVA);
    expect(estado?.pago?.leido).toEqual({ app: null, monto: 50, operacion: "123", fecha: null, destinatario: null });
    expect(estado?.plin).toBeNull();
    expect(await repo.configIA()).toEqual({ modelo: "google/gemma", respaldo: ["a", "b"], temperatura: 0, maxTokens: 800, prompt: null, version: "ocr-v1" });
  });

  it("sin configuración de IA devuelve null (revisión manual)", async () => {
    const { db } = crearSupabaseFalso({ fn_config_ia: { error: { message: "x" } } });
    expect(await new SupabasePagosRepositorio(db).configIA()).toBeNull();
  });

  it("registra, lista, revisa y guarda datos de pago con las funciones correctas", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_registrar_pago: { data: { pago: ID_PAGO, estado_pago: "ai_verified", resultado: "match" } },
      fn_pagos_por_revisar: { data: [{ pago_id: ID_PAGO, estado_pago: "ai_verified", metodo: "plin", monto: 50, ruta: "r.png", enviado: "t", reserva_id: ID_RESERVA, codigo: "RY", inicio: "a", fin: "b", total: 100, adelanto: 50, cancha: "C", local: "L", resultado: "match", leido_monto: "50" }] },
      fn_revisar_pago: { data: { estado_reserva: "confirmed" } },
      fn_mis_locales_pago: { data: [{ id: ID_LOCAL, nombre: "L", estado: "approved", yape: "966123456" }] },
      fn_guardar_datos_pago: { data: { yape: "966123456", plin: null, titular: "Juan" } },
    });
    const repo = new SupabasePagosRepositorio(db);
    expect(await repo.registrarPago({ reservaId: ID_RESERVA, metodo: "yape", ruta: "r", sha256: "h", lectura: null, ia: null })).toEqual({
      pago: ID_PAGO,
      estadoPago: "ai_verified",
      resultado: "match",
    });
    const [p] = await repo.pagosPorRevisar();
    expect(p).toEqual(expect.objectContaining({ pagoId: ID_PAGO, metodo: "plin", imagen: null, leido: expect.objectContaining({ monto: 50 }) }));
    expect(await repo.revisarPago(ID_PAGO, true)).toEqual({ estadoReserva: "confirmed" });
    expect((await repo.misLocalesPago())[0].adelantoPct).toBe(50);
    await repo.guardarDatosPago(ID_LOCAL, { yape: "966123456", plin: null, titular: "Juan" });
    expect(rpc).toHaveBeenCalledWith("fn_revisar_pago", { p_pago: ID_PAGO, p_aprobar: true, p_motivo: null });
    expect(rpc).toHaveBeenCalledWith("fn_guardar_datos_pago", { p_local: ID_LOCAL, p_yape: "966123456", p_plin: null, p_titular: "Juan" });
  });

  it("traduce los errores de la base", async () => {
    const { db } = crearSupabaseFalso({ fn_revisar_pago: { error: { message: "PAGO_YA_REVISADO" } } });
    await expect(new SupabasePagosRepositorio(db).revisarPago(ID_PAGO, true)).rejects.toMatchObject({ codigo: "PAGO_YA_REVISADO", status: 409 });
  });
});

describe("SupabaseAlmacenComprobantes", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));

  it("sube al bucket privado; la misma captura repetida no es error", async () => {
    const f = crearSupabaseFalso();
    const almacen = new SupabaseAlmacenComprobantes(f.db);
    expect(await almacen.subir("r.png", PNG, "image/png")).toEqual({ ok: true });
    expect(f.db.storage.from).toHaveBeenCalledWith("comprobantes");
    f.upload.mockResolvedValueOnce({ error: { message: "The resource already exists" } });
    expect(await almacen.subir("r.png", PNG, "image/png")).toEqual({ ok: true });
  });

  it("distingue falta de permiso de otros fallos", async () => {
    const f = crearSupabaseFalso();
    const almacen = new SupabaseAlmacenComprobantes(f.db);
    f.upload.mockResolvedValueOnce({ error: { message: "new row violates row-level security policy" } });
    expect(await almacen.subir("r.png", PNG, "image/png")).toEqual({ ok: false, motivo: "sin_permiso" });
    f.upload.mockResolvedValueOnce({ error: { message: "network down" } });
    expect(await almacen.subir("r.png", PNG, "image/png")).toEqual({ ok: false, motivo: "fallo" });
  });

  it("crea enlaces firmados", async () => {
    const f = crearSupabaseFalso();
    const enlaces = await new SupabaseAlmacenComprobantes(f.db).enlacesFirmados(["a.png"], 900);
    expect(f.createSignedUrls).toHaveBeenCalledWith(["a.png"], 900);
    expect(enlaces.get("a.png")).toBe("https://firmado.test/a.png");
  });
});

describe("composición de pagos", () => {
  it("une los puertos con sus implementaciones y calcula la huella SHA-256", () => {
    const { db } = crearSupabaseFalso();
    const deps = pagosConSesion(db);
    expect(deps.pagos).toBeInstanceOf(SupabasePagosRepositorio);
    expect(deps.almacen).toBeInstanceOf(SupabaseAlmacenComprobantes);
    expect(deps.huella(new TextEncoder().encode("abc"))).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});
