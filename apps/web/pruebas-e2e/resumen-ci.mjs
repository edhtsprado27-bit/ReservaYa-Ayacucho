// Arma una tabla con el resultado de cada prueba E2E (lee pruebas-e2e/resumen-e2e.json).
// En GitHub Actions la agrega al resumen de la ejecución; en tu PC la muestra en pantalla.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const archivo = join(dirname(fileURLToPath(import.meta.url)), "resumen-e2e.json");
if (!existsSync(archivo)) process.exit(0);
const informe = JSON.parse(readFileSync(archivo, "utf8"));

const filas = [];
const recorrer = (suite, ruta) => {
  for (const s of suite.suites ?? []) recorrer(s, s.file ? [] : [...ruta, s.title]);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const r = t.results?.at(-1) ?? {};
      const icono = r.status === "passed" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
      filas.push(`| ${icono} | ${t.projectName} | ${[...ruta, spec.title].join(" › ")} | ${((r.duration ?? 0) / 1000).toFixed(1)} s |`);
    }
  }
};
for (const s of informe.suites ?? []) recorrer(s, []);

const e = informe.stats ?? {};
const md = [
  "## Pruebas E2E (Playwright)",
  "",
  `**${e.expected ?? 0} pasaron · ${e.unexpected ?? 0} fallaron · ${e.flaky ?? 0} inestables** en ${((e.duration ?? 0) / 1000).toFixed(0)} s.`,
  "Capturas, videos y el informe completo están en los artefactos `informe-e2e` y `evidencias-e2e`.",
  "",
  "| | Proyecto | Prueba | Tiempo |",
  "|---|---|---|---|",
  ...filas,
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
else console.log(md);
