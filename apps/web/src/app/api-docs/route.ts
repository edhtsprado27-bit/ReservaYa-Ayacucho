// GET /api-docs -> documentación interactiva de la API (Swagger UI).
// Lee la especificación OpenAPI de /openapi.yaml (apps/web/public/openapi.yaml).
// Swagger UI 5.17.14 está copiado en public/swagger-ui/ (licencia Apache 2.0):
// así la documentación no depende de ningún servicio externo.

const SWAGGER = "/swagger-ui";

const PAGINA = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API · ReservaYa Ayacucho</title>
  <link rel="stylesheet" href="${SWAGGER}/swagger-ui.css">
  <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      docExpansion: "list",
      tryItOutEnabled: false,
    });
  </script>
</body>
</html>`;

export function GET() {
  return new Response(PAGINA, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
