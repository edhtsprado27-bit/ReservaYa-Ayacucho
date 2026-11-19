// Configuración de Jest. Usa next/jest (compila TypeScript con SWC, igual que Next.js)
// y entiende los alias "@/..." de tsconfig.json.
import nextJest from "next/jest.js";

const crearConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  roots: ["<rootDir>/pruebas"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // "server-only" solo protege de importar código del servidor en el navegador
    "^server-only$": "<rootDir>/pruebas/apoyo/vacio.ts",
  },
  collectCoverageFrom: [
    "src/modules/**/*.ts",
    "src/app/api/**/route.ts",
    "!src/modules/**/presentacion/useCanchas.ts",
    "!src/modules/**/presentacion/canchas-ejemplo.ts",
    "!src/modules/compartido/infraestructura/supabase/cliente-*.ts",
    "!src/modules/compartido/infraestructura/supabase/sesion-proxy.ts",
    "!src/modules/cuentas/infraestructura/perfil.ts",
  ],
  coverageReporters: ["text", "text-summary", "lcov", "json-summary"],
  coverageThreshold: {
    // Mínimo exigido: si baja, la prueba (y el CI) falla
    global: { lines: 80, statements: 80, functions: 80, branches: 70 },
  },
};

export default crearConfig(config);
