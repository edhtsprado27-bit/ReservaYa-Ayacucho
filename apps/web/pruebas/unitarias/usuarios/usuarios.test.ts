// Gestión de usuarios del admin (RF08): validación, casos de uso y repositorio
// de Supabase con un Supabase falso.
import { gestionarUsuario, verUsuarios } from "@/modules/usuarios/aplicacion/usuarios.casos-de-uso";
import {
  fechaRegistro,
  haceCuanto,
  instanteActual,
  leerBusqueda,
  validarPedidoUsuario,
} from "@/modules/usuarios/dominio/usuarios";
import type { UsuariosRepositorio } from "@/modules/usuarios/dominio/usuarios.repositorio";
import { usuariosConSesion } from "@/modules/usuarios/infraestructura/composicion";
import { aUsuarioAdmin } from "@/modules/usuarios/infraestructura/supabase-usuarios.repositorio";
import { crearSupabaseFalso } from "../../apoyo/supabase-falso";

const ID = "66666666-6666-4666-8666-666666666666";
const invalido = expect.objectContaining({ codigo: "DATOS_INVALIDOS_USUARIO", status: 400 });

describe("dominio de usuarios", () => {
  it("lee la búsqueda de la URL (filtro desconocido -> todos)", () => {
    expect(leerBusqueda("  rosa ", "duenos")).toEqual({ buscar: "rosa", filtro: "duenos" });
    expect(leerBusqueda("", "todo")).toEqual({ buscar: null, filtro: "todos" });
    expect(leerBusqueda(undefined, undefined)).toEqual({ buscar: null, filtro: "todos" });
    expect(leerBusqueda("x".repeat(120), "suspendidos").buscar).toHaveLength(80);
  });

  it("valida los pedidos del admin", () => {
    expect(validarPedidoUsuario({ accion: "cambiar_rol", rol: "dueno" })).toEqual({ accion: "cambiar_rol", rol: "dueno" });
    expect(validarPedidoUsuario({ accion: "suspender", motivo: "  Reservas falsas  " })).toEqual({ accion: "suspender", motivo: "Reservas falsas" });
    expect(validarPedidoUsuario({ accion: "suspender" })).toEqual({ accion: "suspender", motivo: "" });
    expect(validarPedidoUsuario({ accion: "reactivar", motivo: "x" })).toEqual({ accion: "reactivar" });
    expect(() => validarPedidoUsuario({ accion: "cambiar_rol", rol: "admin" })).toThrow(invalido);
    expect(() => validarPedidoUsuario({ accion: "borrar" })).toThrow(invalido);
    expect(() => validarPedidoUsuario(null)).toThrow(invalido);
    expect(() => validarPedidoUsuario([])).toThrow(invalido);
  });

  it("textos de fechas", () => {
    const ahora = new Date("2026-11-21T15:00:00Z");
    expect(haceCuanto(null, ahora)).toBe("nunca");
    expect(haceCuanto("2026-11-21T10:00:00Z", ahora)).toBe("hoy");
    expect(haceCuanto("2026-11-20T10:00:00Z", ahora)).toBe("ayer");
    expect(haceCuanto("2026-11-11T10:00:00Z", ahora)).toBe("hace 10 días");
    expect(haceCuanto("2026-10-10T10:00:00Z", ahora)).toBe("hace 1 mes");
    expect(haceCuanto("2026-05-10T10:00:00Z", ahora)).toBe("hace 6 meses");
    expect(haceCuanto("2024-05-10T10:00:00Z", ahora)).toBe("hace más de un año");
    expect(haceCuanto("2026-11-21T10:00:00Z")).toBeTruthy();
    expect(fechaRegistro("2026-11-21T15:00:00Z")).toMatch(/^21 nov/);
    expect(Number.isNaN(Date.parse(instanteActual()))).toBe(false);
  });
});

describe("casos de uso de usuarios", () => {
  const repoFalso = () =>
    ({
      listar: jest.fn(async () => []),
      cambiarRol: jest.fn(async () => ({ id: ID, rol: "dueno", cambio: true })),
      cambiarEstado: jest.fn(async () => ({ id: ID, estado: "suspended", reservasFuturas: 0, localesPublicados: 0 })),
    }) as unknown as jest.Mocked<UsuariosRepositorio>;

  it("listar pasa la búsqueda ya limpia", async () => {
    const repo = repoFalso();
    await verUsuarios(repo, " ana ", "jugadores");
    expect(repo.listar).toHaveBeenCalledWith({ buscar: "ana", filtro: "jugadores" });
    await verUsuarios(repo);
    expect(repo.listar).toHaveBeenLastCalledWith({ buscar: null, filtro: "todos" });
  });

  it("valida el id antes de ir a la base", () => {
    const repo = repoFalso();
    expect(() => gestionarUsuario(repo, "x", { accion: "reactivar" })).toThrow(invalido);
    expect(repo.cambiarEstado).not.toHaveBeenCalled();
  });

  it("cambiar rol, suspender y reactivar", async () => {
    const repo = repoFalso();
    await gestionarUsuario(repo, ID, { accion: "cambiar_rol", rol: "jugador" });
    expect(repo.cambiarRol).toHaveBeenCalledWith(ID, "jugador");
    await gestionarUsuario(repo, ID, { accion: "suspender", motivo: "Comprobantes falsos" });
    expect(repo.cambiarEstado).toHaveBeenCalledWith(ID, "suspender", "Comprobantes falsos");
    await gestionarUsuario(repo, ID, { accion: "reactivar" });
    expect(repo.cambiarEstado).toHaveBeenLastCalledWith(ID, "reactivar", null);
  });
});

describe("SupabaseUsuariosRepositorio", () => {
  const filaBase = {
    id: ID, nombre: "Ana Torres", correo: "ana@x.pe", telefono: "+51966111222", rol: "player", estado: "suspended",
    motivo: "Reservas falsas", creado: "2026-11-01T10:00:00Z", ultimo_ingreso: null, locales: 0, reservas: "3", soy_yo: false,
  };

  it("convierte las filas de fn_usuarios_admin", () => {
    expect(aUsuarioAdmin(filaBase)).toEqual({
      id: ID, nombre: "Ana Torres", correo: "ana@x.pe", telefono: "+51966111222", rol: "jugador", estado: "suspended",
      motivo: "Reservas falsas", creado: "2026-11-01T10:00:00Z", ultimoIngreso: null, locales: 0, reservas: 3, soyYo: false,
    });
    expect(aUsuarioAdmin({ id: ID, rol: "owner", estado: "active", creado: "x" })).toEqual(
      expect.objectContaining({ nombre: "", rol: "dueno", estado: "active", correo: null, locales: 0, reservas: 0 }),
    );
    expect(aUsuarioAdmin({ id: ID, rol: "admin", soy_yo: true, creado: "x" })).toEqual(expect.objectContaining({ rol: "admin", soyYo: true }));
    expect(aUsuarioAdmin({ id: ID, rol: "raro", creado: "x" }).rol).toBe("jugador");
  });

  it("llama a las funciones de la base con los parámetros correctos", async () => {
    const { db, rpc } = crearSupabaseFalso({
      fn_usuarios_admin: { data: [filaBase] },
      fn_cambiar_rol: { data: { id: ID, rol: "dueno", cambio: true } },
      fn_cambiar_estado_usuario: { data: { id: ID, estado: "suspended", reservas_futuras: 2, locales_publicados: 1 } },
    });
    const repo = usuariosConSesion(db);
    expect(await repo.listar({ buscar: "ana", filtro: "suspendidos" })).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("fn_usuarios_admin", { p_buscar: "ana", p_filtro: "suspendidos" });
    expect(await repo.cambiarRol(ID, "dueno")).toEqual({ id: ID, rol: "dueno", cambio: true });
    expect(rpc).toHaveBeenCalledWith("fn_cambiar_rol", { p_usuario: ID, p_rol: "dueno" });
    expect(await repo.cambiarEstado(ID, "suspender", "Motivo")).toEqual({ id: ID, estado: "suspended", reservasFuturas: 2, localesPublicados: 1 });
    expect(rpc).toHaveBeenCalledWith("fn_cambiar_estado_usuario", { p_usuario: ID, p_accion: "suspender", p_motivo: "Motivo" });
  });

  it("respuestas vacías", async () => {
    const { db } = crearSupabaseFalso({ fn_usuarios_admin: { data: null }, fn_cambiar_rol: { data: null }, fn_cambiar_estado_usuario: { data: null } });
    const repo = usuariosConSesion(db);
    expect(await repo.listar({ buscar: null, filtro: "todos" })).toEqual([]);
    expect(await repo.cambiarRol(ID, "jugador")).toEqual(expect.objectContaining({ rol: "jugador", cambio: false }));
    expect(await repo.cambiarEstado(ID, "reactivar", null)).toEqual(expect.objectContaining({ estado: "active", reservasFuturas: 0 }));
  });

  it.each([
    ["fn_usuarios_admin", "SOLO_ADMIN", "SOLO_ADMIN", 403],
    ["fn_usuarios_admin", "FILTRO_INVALIDO", "FILTRO_INVALIDO", 400],
    ["fn_cambiar_rol", "USUARIO_ES_ADMIN", "USUARIO_ES_ADMIN", 403],
    ["fn_cambiar_rol", "DUENO_CON_LOCALES", "DUENO_CON_LOCALES", 409],
    ["fn_cambiar_rol", "ROL_INVALIDO", "ROL_INVALIDO", 400],
    // códigos compartidos con otras pantallas: aquí se muestran con un mensaje de cuentas
    ["fn_cambiar_rol", "USUARIO_NO_ENCONTRADO", "CUENTA_NO_ENCONTRADA", 404],
    ["fn_cambiar_estado_usuario", "ACCION_NO_PERMITIDA", "CUENTA_SIN_CAMBIO", 409],
    ["fn_cambiar_estado_usuario", "FALTA_MOTIVO", "FALTA_MOTIVO", 400],
  ])("%s con error %s -> %s (%i)", async (fn, mensaje, codigo, status) => {
    const { db } = crearSupabaseFalso({ [fn]: { error: { code: "P0001", message: mensaje } } });
    const repo = usuariosConSesion(db);
    const llamar =
      fn === "fn_usuarios_admin"
        ? repo.listar({ buscar: null, filtro: "todos" })
        : fn === "fn_cambiar_rol"
          ? repo.cambiarRol(ID, "jugador")
          : repo.cambiarEstado(ID, "suspender", "x");
    await expect(llamar).rejects.toEqual(expect.objectContaining({ codigo, status }));
  });

  it("sin la migración 012: mensaje claro", async () => {
    const { db } = crearSupabaseFalso({ fn_usuarios_admin: { error: { code: "PGRST202", message: "Could not find the function" } } });
    await expect(usuariosConSesion(db).listar({ buscar: null, filtro: "todos" })).rejects.toEqual(expect.objectContaining({ codigo: "FALTA_MIGRACION" }));
  });
});
