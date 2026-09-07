# Roadmap de Desarrollo (PLAN)
## Proyecto: Del Campo a Tus Manos

> Cada hito entrega uno o más requisitos funcionales (`RF-XX`) definidos en PRD §3. Un hito no se considera terminado si no cumple **todos** los criterios de aceptación de los RF que le corresponden, verificados mediante las pruebas unitarias declaradas en TRD §4 (que cubren la totalidad de RF-01 a RF-09).

### 1. Alcance del MVP (Fase 1) vs. Futuras Iteraciones

**MVP (Fase 1):** RF-01 a RF-09 — autenticación y roles, gestión de productos, catálogo con búsqueda, ciclo completo de pedidos con descuento de stock, cancelación en estado `Pendiente`, notificaciones por correo y panel admin (moderación + métricas).

**Fase 2 (Mejoras Cercanas):** Filtro avanzado por categorías/ubicación, **mensajería integrada al pedido (entidad `MensajePedido`, explícitamente fuera del MVP — ver PRD §4 y TRD §2)**, notificaciones por email más completas (ej. resumen semanal), historial detallado y pipeline de CI declarativo (ver TRD §1).

**Fase 3 (Largo Plazo):** Exportación de reportes PDF/Excel, mapa interactivo de productores y sistema de reputación/comentarios.

### 2. Estructura de Hitos Secuenciales (Feature Slices)

| Hito | Alcance | RF entregados | Pruebas que lo respaldan (TRD §4) |
|---|---|---|---|
| **Hito 1 – Base de Datos y Modelos** | Creación de DDL en MySQL, scripts de migración e inserción de roles/categorías base. **No incluye `MensajePedido`** (ver TRD §2). | Base para RF-01 a RF-09 | [N/A — hito de infraestructura, sin lógica de negocio propia] |
| **Hito 2 – Autenticación y Usuarios** | Endpoints y vistas de login/registro, hashing bcrypt y manejo de sesiones HTTP. | RF-01 | "Rechazo de registro con correo duplicado o campos vacíos" |
| **Hito 3 – Módulo de Productos** | ABM de productos, subida local de imágenes, visualización de catálogo y validaciones de rango. | RF-02, RF-03 | "Rechazo de producto con precio/stock ≤0", "Filtro de catálogo excluye sin stock" |
| **Hito 4 – Módulo de Pedidos** | Endpoint de creación de pedido, descuento transaccional de stock, cancelación en estado `Pendiente`, vista de seguimiento, actualización de estado para el productor y envío de notificación por correo. | RF-04, RF-05, RF-06, RF-07 | "Validación de stock", "Prohibición de auto-compra", "Transiciones de estado inválidas", "Restitución de stock al cancelar", "Persistencia de estado si falla el correo" |
| **Hito 5 – Panel Admin e Integración Final** | Módulo de moderación, consulta de métricas, pruebas unitarias JUnit sobre flujos críticos y despliegue final en servidor de pruebas. | RF-08, RF-09 | "Bloqueo de rutas /admin/** para roles no autorizados", "Usuario desactivado no puede iniciar sesión" |

### 3. Puertas de Calidad y Criterios de Parada (Human-in-the-Loop)

**Criterio de Parada (por hito):** Un hito solo se aprueba cuando:
1. El flujo vertical (backend + frontend) se ejecuta sin errores en el *Happy Path* correspondiente (ver USER_FLOW).
2. Se cumplen **todos** los criterios de aceptación de los RF asignados a ese hito (tabla §2), verificados con las pruebas unitarias JUnit ya declaradas en TRD §4 para ese hito.
3. El build pasa limpio: `mvn verify` sin errores de Checkstyle/SpotBugs (ver TRD §1).
4. El código está consolidado en Git y desplegado en el servidor de pruebas (ver §4).

**Intervención Humana:** Puntos de revisión obligatorios antes de fusionar a la rama `main`:
- Al finalizar el Hito 1 (validación del esquema ERD contra la tabla de entidades de TRD §2, confirmando que `MensajePedido` no está presente).
- Al finalizar el Hito 4 (validación de integridad en el motor de pedidos: stock, cancelaciones y notificaciones — RF-04 a RF-07).
- Al finalizar el Hito 5 (auditoría previa a la salida a producción: RBAC de RF-08/RF-09 y checklist completo de RF-01 a RF-09, con las 11 pruebas de TRD §4 en verde).

### 4. Granularidad de Tareas y Despliegue de Pruebas

**Granularidad:** Micro-tareas atómicas, cada una asociada a un único RF (ej. "Crear tabla Producto — RF-02", "Crear endpoint POST /login — RF-01", "Implementar envío async de correo en cambio de estado — RF-07").

**Estrategia de Despliegue de Pruebas:** Ejecución local durante el desarrollo, con `mvn verify` (build + linter) como paso obligatorio antes de cada `push`. Al superar cada hito, se despliega la versión de desarrollo (rama `develop`) en un servidor de pruebas (VPS con Tomcat) para retroalimentación con evaluadores/instructores SENA.
