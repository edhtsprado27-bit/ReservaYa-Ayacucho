Se utiliza el enfoque Clean Architecture para separar

| Elemento | Descripción aplicada a ReservaYa Ayacucho |
|---|---|
| Patrón / enfoque arquitectónico | Clean Architecture (Arquitectura Limpia). |
| Objetivo | Separar responsabilidades y controlar las dependencias hacia el dominio. |
| ¿Qué problema resuelve? | Evita el acoplamiento entre la interfaz Next.js, las reglas del negocio (reservas, tarifas, estados del pago) y las tecnologías externas, como PostgreSQL, Redis, Supabase Storage y OpenRouter. |
| Capas definidas | Presentación, Aplicación, Dominio e Infraestructura. |
| Beneficios | • Facilita el mantenimiento y las pruebas unitarias.<br>• Permite cambiar implementaciones técnicas (por ejemplo, el modelo de IA) sin modificar innecesariamente las reglas del negocio.<br>• Mejora la organización y separación de responsabilidades del código. |

![Clean Architecture de ReservaYa](../../img/ArquitecturalimpiadeReservaYaWeb.png)
