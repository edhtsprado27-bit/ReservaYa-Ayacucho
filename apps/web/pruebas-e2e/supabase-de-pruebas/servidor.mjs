// Supabase de pruebas para las pruebas E2E (solo GitHub Actions o tu PC).
// Atiende las mismas direcciones que usa la web, con el mismo formato:
//   /auth/v1/*            registro, inicio de sesión (JWT), usuario, cerrar sesión
//   /rest/v1/rpc/<fn>     funciones de PostgreSQL (las reales del proyecto)
//   /rest/v1/venues       la única consulta a tabla que hace la web
//   /storage/v1/*         subir comprobantes y verlos con enlaces firmados
// Cada pedido se ejecuta en PostgreSQL con el rol "anon" o "authenticated" y el
// usuario del JWT (igual que PostgREST), así RLS, los permisos y las reglas de
// las funciones son las de verdad. Lo único simulado es el servidor HTTP.

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";
import { cifrarClave, claveCorrecta, firmarJWT, leerJWT, PUERTO, URL_BASE_DATOS } from "./comun.mjs";

const pool = new pg.Pool({ connectionString: URL_BASE_DATOS, max: 10 });
// Si se vuelve a crear la base con el servidor encendido, las conexiones viejas se descartan solas
pool.on("error", () => {});
const CARPETA = process.env.E2E_ARCHIVOS ?? join(tmpdir(), "reservaya-e2e-storage");
mkdirSync(CARPETA, { recursive: true });
const MOSTRAR = process.env.E2E_LOG === "1";

// ---------------------------------------------------------------- utilidades
function cors(req) {
  return {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "content-range, x-supabase-api-version",
  };
}
const responder = (req, res, estado, cuerpo) => {
  res.writeHead(estado, { "content-type": "application/json", ...cors(req) });
  res.end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
};
const json = (crudo) => {
  try {
    return crudo.length ? JSON.parse(crudo.toString()) : {};
  } catch {
    return null;
  }
};
const quien = (req) => leerJWT((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));

/** Ejecuta SQL con el rol de quien pide (como PostgREST) dentro de una transacción */
async function comoQuienPide(claims, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL ROLE ${claims ? "authenticated" : "anon"}`);
    if (claims) await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const r = await c.query(sql, params);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Error de PostgreSQL -> respuesta con el formato de PostgREST */
function errorPostgrest(req, res, e, claims) {
  const estado =
    e.code === "42501" ? (claims ? 403 : 401)
    : e.code === "23P01" || e.code === "23505" ? 409
    : e.code === "42883" ? 404
    : 400;
  const codigo = e.code === "42883" ? "PGRST202" : e.code;
  responder(req, res, estado, { code: codigo, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

// ---------------------------------------------------------------- Auth (GoTrue)
const refrescos = new Map(); // refresh_token -> id del usuario

function usuarioJSON(u) {
  const meta = { ...(u.raw_user_meta_data ?? {}), email: u.email, email_verified: true, sub: u.id };
  const fecha = new Date(u.created_at).toISOString();
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: fecha,
    phone: "",
    confirmed_at: fecha,
    last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : fecha,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: meta,
    identities: [
      {
        identity_id: u.id,
        id: u.id,
        user_id: u.id,
        identity_data: { email: u.email, email_verified: true, sub: u.id },
        provider: "email",
        email: u.email,
        created_at: fecha,
        updated_at: fecha,
        last_sign_in_at: fecha,
      },
    ],
    created_at: fecha,
    updated_at: new Date(u.updated_at).toISOString(),
    is_anonymous: false,
  };
}

function sesion(u) {
  const ahora = Math.floor(Date.now() / 1000);
  const exp = ahora + 3600;
  const usuario = usuarioJSON(u);
  const access_token = firmarJWT({
    aud: "authenticated",
    exp,
    iat: ahora,
    iss: `http://127.0.0.1:${PUERTO}/auth/v1`,
    sub: u.id,
    email: u.email,
    phone: "",
    app_metadata: usuario.app_metadata,
    user_metadata: usuario.user_metadata,
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "password", timestamp: ahora }],
    session_id: randomUUID(),
    is_anonymous: false,
  });
  const refresh_token = randomBytes(24).toString("hex");
  refrescos.set(refresh_token, u.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user: usuario };
}

const buscarPorCorreo = async (email) =>
  (await pool.query("SELECT * FROM auth.users WHERE lower(email) = lower($1)", [email])).rows[0];
const buscarPorId = async (id) => (await pool.query("SELECT * FROM auth.users WHERE id = $1", [id])).rows[0];

async function auth(req, res, url, crudo) {
  const ruta = url.pathname.replace(/^\/auth\/v1/, "");
  const cuerpo = json(crudo) ?? {};
  const errorAuth = (estado, codigo, mensaje) =>
    responder(req, res, estado, { code: estado, error_code: codigo, msg: mensaje, error: codigo, error_description: mensaje });

  if (ruta === "/signup" && req.method === "POST") {
    const email = String(cuerpo.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorAuth(400, "validation_failed", "Unable to validate email address: invalid format");
    if (String(cuerpo.password ?? "").length < 6) return errorAuth(422, "weak_password", "Password should be at least 6 characters.");
    if (await buscarPorCorreo(email)) return errorAuth(422, "user_already_exists", "User already registered");
    // El trigger del proyecto (006_auth_roles.sql) crea el perfil en public.users
    const { rows } = await pool.query(
      "INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, last_sign_in_at) VALUES ($1, $2, $3, now()) RETURNING *",
      [email, cifrarClave(String(cuerpo.password)), cuerpo.data ?? {}],
    );
    return responder(req, res, 200, sesion(rows[0]));
  }

  if (ruta === "/token" && req.method === "POST") {
    const tipo = url.searchParams.get("grant_type");
    if (tipo === "password") {
      const u = await buscarPorCorreo(String(cuerpo.email ?? ""));
      if (!u || !claveCorrecta(cuerpo.password, u.encrypted_password)) return errorAuth(400, "invalid_credentials", "Invalid login credentials");
      await pool.query("UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1", [u.id]);
      return responder(req, res, 200, sesion(u));
    }
    if (tipo === "refresh_token") {
      const id = refrescos.get(String(cuerpo.refresh_token ?? ""));
      const u = id && (await buscarPorId(id));
      if (!u) return errorAuth(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      refrescos.delete(String(cuerpo.refresh_token));
      return responder(req, res, 200, sesion(u));
    }
    return errorAuth(400, "unsupported_grant_type", "Unsupported grant type");
  }

  const claims = quien(req);
  if (ruta === "/user" && (req.method === "GET" || req.method === "PUT")) {
    const u = claims && (await buscarPorId(claims.sub));
    if (!u) return errorAuth(403, "bad_jwt", "invalid JWT: unable to parse or verify signature");
    if (req.method === "PUT" && cuerpo.password) {
      if (String(cuerpo.password).length < 6) return errorAuth(422, "weak_password", "Password should be at least 6 characters.");
      await pool.query("UPDATE auth.users SET encrypted_password = $2, updated_at = now() WHERE id = $1", [u.id, cifrarClave(String(cuerpo.password))]);
    }
    return responder(req, res, 200, usuarioJSON(await buscarPorId(u.id)));
  }
  if (ruta === "/logout" && req.method === "POST") {
    if (claims) for (const [token, id] of refrescos) if (id === claims.sub) refrescos.delete(token);
    res.writeHead(204, cors(req));
    return res.end();
  }
  if (ruta === "/recover" && req.method === "POST") return responder(req, res, 200, {});
  return errorAuth(404, "not_found", `${req.method} ${ruta}`);
}

// ---------------------------------------------------------------- REST (PostgREST)
const tiposDe = new Map();
async function parametrosDe(fn) {
  if (!tiposDe.has(fn)) {
    const { rows } = await pool.query(
      `SELECT p.proretset AS conjunto,
              coalesce((SELECT json_object_agg(a.nombre, a.tipo)
                          FROM unnest(p.proargnames, p.proargtypes::regtype[]::text[]) AS a(nombre, tipo)), '{}') AS tipos
         FROM pg_proc p WHERE p.proname = $1 AND p.pronamespace = 'public'::regnamespace LIMIT 1`,
      [fn],
    );
    tiposDe.set(fn, rows[0] ?? null);
  }
  return tiposDe.get(fn);
}

async function rest(req, res, url, crudo) {
  const claims = quien(req);
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
  if (rpc && req.method === "POST") {
    const fn = rpc[1];
    const info = await parametrosDe(fn);
    if (!info) return responder(req, res, 404, { code: "PGRST202", message: `Could not find the function public.${fn}`, details: null, hint: null });
    const entrada = json(crudo) ?? {};
    const claves = Object.keys(entrada).filter((k) => /^[a-z_0-9]+$/.test(k));
    const valores = claves.map((k) => (/^jsonb?$/.test(info.tipos[k] ?? "") ? JSON.stringify(entrada[k]) : entrada[k]));
    const args = claves.map((k, i) => `${k} => $${i + 1}`).join(", ");
    const sql = info.conjunto ? `SELECT * FROM public.${fn}(${args})` : `SELECT public.${fn}(${args}) AS r`;
    try {
      const r = await comoQuienPide(claims, sql, valores);
      return responder(req, res, 200, info.conjunto ? r.rows : r.rows[0]?.r ?? null);
    } catch (e) {
      return errorPostgrest(req, res, e, claims);
    }
  }

  // GET /rest/v1/venues?select=id,name,address,districts(name)&owner_id=eq.X&status=eq.approved&order=name.asc
  if (url.pathname === "/rest/v1/venues" && req.method === "GET") {
    const columnas = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
    const select = columnas.map((c) => {
      if (c === "districts(name)") return "(SELECT json_build_object('name', d.name) FROM districts d WHERE d.id = v.district_id) AS districts";
      if (/^[a-z_]+$/.test(c)) return `v.${c}`;
      throw new Error(`select no soportado: ${c}`);
    });
    const filtros = [];
    const valores = [];
    for (const [k, v] of url.searchParams) {
      if (k === "select" || k === "order") continue;
      const m = v.match(/^eq\.(.*)$/);
      if (!/^[a-z_]+$/.test(k) || !m) return responder(req, res, 400, { code: "PGRST100", message: `filtro no soportado: ${k}` });
      valores.push(m[1]);
      filtros.push(`v.${k} = $${valores.length}`);
    }
    const orden = (url.searchParams.get("order") ?? "").match(/^([a-z_]+)(?:\.(asc|desc))?$/);
    const sql = `SELECT ${select.join(", ")} FROM public.venues v${filtros.length ? ` WHERE ${filtros.join(" AND ")}` : ""}${
      orden ? ` ORDER BY v.${orden[1]} ${orden[2] ?? "asc"}` : ""
    }`;
    try {
      return responder(req, res, 200, (await comoQuienPide(claims, sql, valores)).rows);
    } catch (e) {
      return errorPostgrest(req, res, e, claims);
    }
  }
  return responder(req, res, 404, { code: "PGRST125", message: `Ruta no soportada en las pruebas: ${req.method} ${url.pathname}` });
}

// ---------------------------------------------------------------- Storage
async function storage(req, res, url, crudo) {
  const claims = quien(req);
  const errorStorage = (estado, error, mensaje) => responder(req, res, estado, { statusCode: String(estado), error, message: mensaje });

  // Subir: la política RLS real de storage.objects (008_pagos.sql) decide si se puede
  let m = url.pathname.match(/^\/storage\/v1\/object\/([a-z0-9_-]+)\/(.+)$/);
  if (m && req.method === "POST" && m[1] !== "sign") {
    const [, bucket, ruta] = m;
    const nombre = decodeURIComponent(ruta);
    if (!claims) return errorStorage(403, "Unauthorized", "new row violates row-level security policy");
    try {
      await comoQuienPide(claims, "INSERT INTO storage.objects (bucket_id, name, owner) VALUES ($1, $2, $3)", [bucket, nombre, claims.sub]);
    } catch (e) {
      if (e.code === "23505") return errorStorage(409, "Duplicate", "The resource already exists");
      return errorStorage(403, "Unauthorized", "new row violates row-level security policy");
    }
    const archivo = join(CARPETA, bucket, nombre);
    mkdirSync(dirname(archivo), { recursive: true });
    writeFileSync(archivo, crudo);
    return responder(req, res, 200, { Key: `${bucket}/${nombre}`, Id: randomUUID() });
  }

  // Enlaces firmados: solo para quien puede VER el archivo según RLS
  m = url.pathname.match(/^\/storage\/v1\/object\/sign\/([a-z0-9_-]+)\/?$/);
  if (m && req.method === "POST") {
    const bucket = m[1];
    const { paths = [], expiresIn = 60 } = json(crudo) ?? {};
    const salida = [];
    for (const ruta of paths) {
      const visible = claims
        ? (await comoQuienPide(claims, "SELECT 1 FROM storage.objects WHERE bucket_id = $1 AND name = $2", [bucket, ruta])).rowCount > 0
        : false;
      if (!visible) {
        salida.push({ error: "Either the object does not exist or you do not have access to it", path: ruta, signedURL: null });
        continue;
      }
      const token = firmarJWT({ url: `${bucket}/${ruta}`, exp: Math.floor(Date.now() / 1000) + Number(expiresIn) });
      salida.push({ error: null, path: ruta, signedURL: `/object/sign/${bucket}/${ruta}?token=${token}` });
    }
    return responder(req, res, 200, salida);
  }

  m = url.pathname.match(/^\/storage\/v1\/object\/sign\/([a-z0-9_-]+)\/(.+)$/);
  if (m && req.method === "GET") {
    const nombre = `${m[1]}/${decodeURIComponent(m[2])}`;
    const permiso = leerJWT(url.searchParams.get("token"));
    const archivo = join(CARPETA, nombre);
    if (!permiso || permiso.url !== nombre || !existsSync(archivo)) return errorStorage(400, "InvalidJWT", "invalid signature");
    const tipo = nombre.endsWith(".png") ? "image/png" : nombre.endsWith(".webp") ? "image/webp" : "image/jpeg";
    res.writeHead(200, { "content-type": tipo, ...cors(req) });
    return res.end(readFileSync(archivo));
  }
  return errorStorage(404, "not_found", `${req.method} ${url.pathname}`);
}

// ---------------------------------------------------------------- servidor
createServer(async (req, res) => {
  const partes = [];
  for await (const p of req) partes.push(p);
  const crudo = Buffer.concat(partes);
  const url = new URL(req.url ?? "/", "http://localhost");
  if (MOSTRAR) console.log(req.method, url.pathname);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors(req));
      return res.end();
    }
    if (url.pathname === "/salud") return responder(req, res, 200, { ok: true });
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url, crudo);
    if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, url, crudo);
    if (url.pathname.startsWith("/storage/v1/")) return await storage(req, res, url, crudo);
    return responder(req, res, 404, { message: "No existe" });
  } catch (e) {
    console.error("[supabase de pruebas]", req.method, url.pathname, e);
    return responder(req, res, 500, { message: e.message });
  }
}).listen(PUERTO, "127.0.0.1", () => console.log(`Supabase de pruebas listo en http://127.0.0.1:${PUERTO}`));
