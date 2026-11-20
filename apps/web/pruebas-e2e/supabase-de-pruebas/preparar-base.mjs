// Crea desde cero la base de las pruebas E2E:
//   1. lo mínimo de Supabase (roles, auth, storage)      00-imitar-supabase.sql
//   2. el esquema REAL del proyecto, sin cambios           database/supabase_inicial.sql
//   3. todas las migraciones, en orden                     database/migrations/*.sql
//   4. cuentas de prueba (contraseña cifrada) y datos      datos-e2e.sql
// Uso: npm run e2e:base   (variable E2E_DATABASE_URL; por defecto postgres local)

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { cifrarClave, CLAVE_CUENTAS, URL_BASE_DATOS } from "./comun.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..", "..");
const SQL = (ruta) => readFileSync(ruta, "utf8");

export const CUENTAS = [
  { email: "admin@e2e.pe", nombre: "Admin E2E", rol: "jugador", telefono: "" }, // pasa a admin abajo
  { email: "dueno@e2e.pe", nombre: "Rosa Quispe", rol: "dueno", telefono: "966123456" },
  { email: "dueno2@e2e.pe", nombre: "Mario Cárdenas", rol: "dueno", telefono: "" },
  { email: "jugador@e2e.pe", nombre: "Luis Gamboa", rol: "jugador", telefono: "987654321" },
  { email: "jugador2@e2e.pe", nombre: "Ana Torres", rol: "jugador", telefono: "" },
  { email: "jugador3@e2e.pe", nombre: "Pedro Rojas", rol: "jugador", telefono: "" },
];

async function main() {
  const url = new URL(URL_BASE_DATOS);
  const nombre = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(nombre)) throw new Error(`Nombre de base no válido: ${nombre}`);

  // 1. Base nueva (borra la anterior de pruebas)
  const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${nombre}`);
  await admin.end();

  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  db.on("notice", () => {}); // los avisos "ya existe, se omite" no interesan

  const ejecutar = async (titulo, sql) => {
    const inicio = Date.now();
    await db.query(sql);
    console.log(`  ✓ ${titulo} (${Date.now() - inicio} ms)`);
  };

  console.log(`Preparando la base de pruebas "${nombre}"`);
  await ejecutar("imitación de Supabase", SQL(join(AQUI, "00-imitar-supabase.sql")));
  await ejecutar("database/supabase_inicial.sql", SQL(join(RAIZ, "database", "supabase_inicial.sql")));
  const migraciones = readdirSync(join(RAIZ, "database", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migraciones) await ejecutar(`migración ${m}`, SQL(join(RAIZ, "database", "migrations", m)));

  // 2. Cuentas: se crean en auth.users y el trigger del proyecto (006) arma su perfil
  for (const c of CUENTAS) {
    await db.query("INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data) VALUES ($1, $2, $3)", [
      c.email,
      cifrarClave(CLAVE_CUENTAS),
      { nombre: c.nombre, rol: c.rol, telefono: c.telefono },
    ]);
  }
  await db.query("UPDATE users SET role = 'admin' WHERE email = 'admin@e2e.pe'");
  console.log(`  ✓ ${CUENTAS.length} cuentas de prueba`);

  await ejecutar("datos de prueba", SQL(join(AQUI, "datos-e2e.sql")));
  const { rows } = await db.query(
    "SELECT string_agg(name || ' (' || status || ')', ', ' ORDER BY name) AS locales FROM venues",
  );
  console.log(`  Locales: ${rows[0].locales}`);
  await db.end();
}

main().catch((e) => {
  console.error("No se pudo preparar la base de pruebas:", e.message);
  process.exit(1);
});
