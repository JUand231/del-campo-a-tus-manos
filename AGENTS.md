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

**Arquitectura:** MVC desacoplado con API REST. Backend Java + Spring Boot (Web, Security, Data JPA). Frontend HTML5/CSS3/JavaScript Vanilla + Bootstrap. Servidor Tomcat embebido.

**Base de datos:** MySQL. Migraciones versionadas con Flyway (`V1__init.sql`, `V2__seed_data.sql`, ...). Nunca modificar un script Flyway ya aplicado; toda nueva migración debe ser un archivo nuevo.

**Entidades permitidas en el MVP:** `Rol`, `Usuario` (con campo `activo: boolean` para RF-08), `Producto` (nombre, descripción, precio, cantidad, unidad de medida, foto, municipio), `Categoria`, `Pedido` (con enum `estado`: Pendiente/En Proceso/Entregado/Cancelado), `DetallePedido`.

**Archivos y entidades prohibidos:**
- No crear la entidad/tabla `MensajePedido` ni ningún endpoint o servicio de mensajería.
- No integrar pasarelas de pago, SDKs de GPS, ni tokens de API de terceros.
- No hardcodear credenciales SMTP ni cadena de conexión a BD — siempre variables de entorno.

**Seguridad:** sesiones HTTP con cookies seguras, hashing bcrypt, RBAC vía filtros de Spring Security (`/admin/**` → Administrador; `/productor/**` → Productor).

**Concurrencia de stock (RF-04):** todo descuento de stock debe ejecutarse dentro de una transacción (`@Transactional`) con bloqueo optimista (columna `@Version` en `Producto`) o `SELECT ... FOR UPDATE`, aislamiento mínimo `READ_COMMITTED`. Prohibido descontar stock fuera de una transacción atómica.

**Notificaciones (RF-07):** envío de correo siempre asíncrono (no bloquear la respuesta HTTP). Un fallo de envío se registra en el log vía SLF4J/Logback y **nunca** revierte el cambio de estado del pedido.

## Harness Config

**Comandos permitidos:**
- `mvn verify` — build + Checkstyle + SpotBugs + JUnit. Obligatorio y debe pasar limpio antes de cualquier `push`.
- `mvn test` — ejecución local de pruebas unitarias durante desarrollo.
- Despliegue a `develop` en servidor de pruebas (VPS Tomcat) solo al cerrar un Hito completo.

**Pre-push / PreToolUse gate:** ningún commit se considera válido si `mvn verify` falla. No se debe ejecutar `git push` sin build limpio.

**Pruebas obligatorias por RF (JUnit, ver TRD §4 — 11 en total, todas deben estar en verde antes del checkpoint de Hito 5):**
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

**Deuda técnica pendiente (resolver antes o durante Hito 4, no bloquea el inicio de Hito 1):**
- Definir explícitamente el mecanismo de concurrencia para el descuento de stock (bloqueo optimista `@Version` o `SELECT ... FOR UPDATE`) — hoy solo está descrito en este archivo, falta formalizarlo en TRD §2/§3.
- Definir el contrato de API de catálogo (`GET /api/productos?...`) para RF-03.
- Documentar en TRD §2 el servicio de restitución de stock al cancelar (RF-06).
- Aclarar en TRD §5 si el servidor de pruebas es el entorno final o si hay una etapa de producción posterior.
- Enumerar campos concretos de `Usuario`, `Producto`, `Pedido`/`DetallePedido` en TRD §2 (incluyendo `Usuario.activo`).

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
