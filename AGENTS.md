# AGENTS.md — Del Campo a Tus Manos

## System Brief

**Visión:** Plataforma web que conecta directamente a productores agrícolas con compradores (personas, familias, restaurantes, tiendas, empresas), eliminando intermediarios para mejorar el margen del productor y la transparencia del origen del producto.

**Alcance del MVP:** exclusivamente los requisitos RF-01 a RF-09 definidos en el PRD:
- RF-01 Autenticación (correo/contraseña, sin duplicados)
- RF-02 Gestión de Productos (CRUD del Productor)
- RF-03 Catálogo y Búsqueda (filtro por categoría/nombre, sin recarga completa)
- RF-04 Generación de Pedidos (con descuento de stock transaccional)
- RF-05 Gestión de Estados de Pedido (Pendiente → En Proceso → Entregado, sin saltos)
- RF-06 Cancelación de Pedidos (solo en estado Pendiente, con restitución de stock)
- RF-07 Notificaciones por Correo (asíncronas, no bloqueantes, no revierten estado si fallan)
- RF-08 Panel Admin — Moderación (activar/desactivar usuarios, eliminar publicaciones)
- RF-09 Panel Admin — Métricas (sin caché, o si existe, frescura máxima de 5 minutos; solo lectura)

**Límites explícitos del MVP (NO construir):** pasarelas de pago en línea, GPS en tiempo real, mensajería/chat entre productor y comprador (`MensajePedido` — reservado a Fase 2, sin tabla ni endpoint en el MVP), app nativa, facturación electrónica, calificaciones con IA.

**Idioma de la interfaz:** 100% en español. UI responsive, simple, orientada a usuarios del ámbito rural.

## Operational Rules

**Arquitectura:** MVC desacoplado con API REST. Backend Node.js + Express (JWT en cookie HttpOnly, bcrypt, mysql2, Nodemailer). Frontend HTML5/CSS3/JavaScript Vanilla + Tailwind CSS. Servidor Node directo (dev) o tras Nginx como proxy inverso (producción).

**Base de datos:** MySQL. Migraciones versionadas con Flyway (`V1__init.sql`, `V2__seed_data.sql`, ...). Nunca modificar un script Flyway ya aplicado; toda nueva migración debe ser un archivo nuevo.

**Entidades permitidas en el MVP:** `Rol`, `Usuario` (con campo `activo: boolean` para RF-08), `Producto` (nombre, descripción, precio, cantidad, unidad de medida, foto, municipio), `Categoria`, `Pedido` (con enum `estado`: Pendiente/En Proceso/Entregado/Cancelado), `DetallePedido`.

**Archivos y entidades prohibidos:**
- La entidad/tabla `MensajePedido` y sus endpoints existen únicamente bajo RF-10 (Fase 2); prohibida cualquier mensajería fuera de ese alcance.
- No integrar pasarelas de pago, SDKs de GPS, ni tokens de API de terceros.
- No hardcodear credenciales SMTP ni cadena de conexión a BD — siempre variables de entorno.

**Seguridad:** JWT en cookie HttpOnly (`Secure` en producción, `SameSite=Lax`), hashing bcrypt, RBAC vía middlewares (`/admin/**` → Administrador; escritura de productos y avance de pedidos propios → Productor; catálogo en lectura pública).

**Concurrencia de stock (RF-04):** todo descuento de stock se ejecuta dentro de una transacción (`db.withTransaction`, commit/rollback) con `SELECT ... FOR UPDATE` y columna `version` de bloqueo optimista en `Producto` (InnoDB, `READ_COMMITTED` por defecto). Prohibido descontar stock fuera de una transacción atómica.

**Notificaciones (RF-07):** envío de correo siempre asíncrono (no bloquear la respuesta HTTP). Un fallo de envío se registra en el log vía SLF4J/Logback y **nunca** revierte el cambio de estado del pedido.

## Harness Config

**Comandos permitidos:**
- `npm test` (en `backend/`) — suite TRD §4 (11 pruebas). Obligatorio y debe pasar limpio antes de cualquier `push`.
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilidades high/critical.
- `npm start` — arranque local (puerto 3000). `npm run init-db` — migraciones manuales V1+V2+V3.
- Despliegue a rama de pruebas solo al cerrar un Hito completo (pendiente VPS).

**Pre-push / PreToolUse gate:** ningún commit se considera válido si `npm test` falla o `npm audit` reporta high/critical. No se debe ejecutar `git push` sin suite en verde. El CI de GitHub (.github/workflows/ci.yml) lo verifica en cada push a main.

**Pruebas obligatorias por RF (suite Node en `tests/test_rf_suite.js`, ver TRD §4 — 11 en total, todas deben estar en verde antes del checkpoint de Hito 5):**
- Rechazo de registro con correo duplicado o campos obligatorios vacíos (RF-01)
- Rechazo de publicación de producto con precio o stock ≤ 0 (RF-02)
- El filtro/búsqueda de catálogo excluye productos sin stock disponible (RF-03)
- Validación de stock antes de confirmar pedido (RF-04)
- Prohibición de auto-compra (RF-04)
- Prohibición de saltos de estado inválidos (RF-05)
- Restitución de stock al cancelar en estado Pendiente (RF-06)
- Bloqueo de cancelación en estados En Proceso y Entregado (RF-06)
- Persistencia del estado del pedido aunque falle el envío de correo, mock SMTP (RF-07)
- Bloqueo de rutas `/admin/**` para roles no autorizados (RF-08, RF-09)
- Un usuario desactivado no puede iniciar sesión (RF-08)

**Puntos de control humano (Maker-Checker) — obligatorios antes de fusionar a `main`:**
1. Fin de Hito 1 → validar ERD contra tabla de entidades de TRD, confirmar ausencia de `MensajePedido`.
2. Fin de Hito 4 → auditar integridad del motor de pedidos (stock, cancelaciones, notificaciones).
3. Fin de Hito 5 → auditoría de RBAC (RF-08/RF-09) y checklist completo RF-01 a RF-09, con las 11 pruebas de TRD §4 en verde.

**Límites de contexto:** cada tarea/commit debe asociarse a un único RF-XX (granularidad atómica). No introducir funcionalidad, entidad o endpoint sin un RF de respaldo en el PRD.

**Deuda técnica (estado a cierre MVP):**
- ✅ Concurrencia de stock formalizada en TRD §2/§3 (`FOR UPDATE` + columna `version`).
- ✅ Contrato de API de catálogo documentado en TRD §3 (`GET /api/productos?q&categoria_id&municipio`).
- ✅ Servicio de restitución de stock documentado en TRD §2/§3 (cancelación transaccional RF-06).
- ✅ Servidor: desarrollo local (Node directo); producción pendiente (VPS + Nginx + MySQL administrado) — ver TRD §5 y README §5.
- ✅ Campos de entidades enumerados en TRD §2 (incluyendo `Usuario.activo` y `Producto.version`).
- ⏳ Post-piloto: prueba de carrera concurrente, build local de Tailwind, APM, Redis si se escala.

## Persistence Loop

**Protocolo de lectura de estado al iniciar una tarea:**
1. Leer el Hito activo en PLAN §2 y su lista de RF a entregar.
2. Leer los criterios de aceptación exactos de esos RF en PRD §3.
3. Leer la sección correspondiente de TRD (arquitectura/entidad/API) y USER_FLOW (pantalla/flujo) antes de escribir código.

**Protocolo de escritura de estado al cerrar una tarea:**
1. Ejecutar `mvn verify` — no continuar si falla.
2. Verificar los 4 criterios de parada del Hito (PLAN §3): happy path sin errores, criterios de aceptación cumplidos vía JUnit, build limpio, código consolidado en Git.
3. Si el Hito cierra en 1, 4 o 5 → detener el loop y solicitar el punto de control humano correspondiente antes de fusionar a `main`.
4. Registrar en el log (SLF4J/Logback) cualquier evento relevante para auditoría (login fallido, error de confirmación de pedido, fallo de envío de correo).
