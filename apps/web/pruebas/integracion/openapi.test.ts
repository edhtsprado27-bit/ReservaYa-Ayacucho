// La documentación OpenAPI debe describir exactamente las rutas que existen en
// el código: si alguien agrega o quita un endpoint sin documentarlo, esta prueba falla.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import yaml from "js-yaml";

const RAIZ = join(__dirname, "..", "..");
const API = join(RAIZ, "src", "app", "api");
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function rutasDelCodigo(dir: string, encontradas: string[] = []) {
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    if (statSync(p).isDirectory()) rutasDelCodigo(p, encontradas);
    else if (nombre === "route.ts") {
      const ruta = "/api/" + relative(API, dir).split(sep).join("/").replace(/\[(\w+)\]/g, "{$1}");
      const codigo = readFileSync(p, "utf8");
      for (const m of METODOS) if (new RegExp(`export (async )?function ${m}\\b`).test(codigo)) encontradas.push(`${m} ${ruta}`);
    }
  }
  return encontradas;
}

type Spec = { openapi: string; paths: Record<string, Record<string, { responses?: object; operationId?: string }>> };
const spec = yaml.load(readFileSync(join(RAIZ, "public", "openapi.yaml"), "utf8")) as Spec;

const rutasDocumentadas = Object.entries(spec.paths).flatMap(([ruta, ops]) =>
  Object.keys(ops)
    .filter((k) => METODOS.includes(k.toUpperCase()))
    .map((m) => `${m.toUpperCase()} ${ruta}`),
);

describe("OpenAPI", () => {
  it("es OpenAPI 3", () => {
    expect(spec.openapi).toMatch(/^3\./);
  });

  it("documenta todas las rutas del código y ninguna que no exista", () => {
    expect(rutasDocumentadas.sort()).toEqual(rutasDelCodigo(API).sort());
    expect(rutasDocumentadas).toHaveLength(30);
  });

  it("cada operación tiene un operationId y respuestas", () => {
    for (const ops of Object.values(spec.paths)) {
      for (const [m, op] of Object.entries(ops)) {
        if (!METODOS.includes(m.toUpperCase())) continue;
        expect(op.operationId).toBeTruthy();
        expect(op.responses).toBeTruthy();
      }
    }
  });
});
