# Technical Requirements Document (TRD)
## Proyecto: Del Campo a Tus Manos

> **Alcance funcional:** Este documento implementa exclusivamente los requisitos `RF-01` a `RF-09` definidos en PRD §3. Ninguna entidad, endpoint o integración descrita aquí existe sin un RF que la respalde.

### 1. Stack Tecnológico y Arquitectura de Software

**Arquitectura seleccionada:** Modelo-Vista-Controlador (MVC) desacoplado con API REST en el backend.

**Decisión de stack:** **Node.js + Express**, por su bajo consumo de recursos, JSON nativo, ecosistema maduro (mysql2, jsonwebtoken, bcryptjs, Nodemailer) y despliegue simple en VPS económicos.

- **Backend:** Node.js + Express (capas: rutas, controladores, servicios, middlewares de seguridad y RBAC).
- **Frontend:** HTML5, CSS3, JavaScript Vanilla y Tailwind CSS para diseño responsive (SPA servida por el propio backend).
- **Servidor de Aplicaciones:** Node directo en desarrollo; Nginx como proxy inverso + TLS en producción.
- **Control de Versiones:** Git (GitHub) + Actions.
- **Calidad:** suite `npm test` (11 pruebas TRD §4) + `npm audit --audit-level=high` (0 hallazgos), ejecutados antes de cada `push`.
- **CI formalizado:** workflow `.github/workflows/ci.yml` (MySQL 8 de servicio) que ejecuta la suite y el audit en cada push/PR a `main`.

### 2. Modelo de Datos y Persistencia

**Motor de BD seleccionado:** **MySQL**, por su estabilidad, amplio soporte, buena documentación y adecuación a un modelo relacional con relaciones claras entre usuarios, productos y pedidos.

**Entidades del MVP (Hito 1) y RF que respaldan cada una:**

| Entidad | Relación | RF que la justifica |
|---|---|---|
| `Rol` | (1) ── (N) `Usuario` | RF-01 |
| `Usuario` (Productor) | (1) ── (N) `Producto` | RF-02 |
| `Categoria` | (1) ── (N) `Producto` | RF-03 |
| `Usuario` (Comprador) | (1) ── (N) `Pedido` | RF-04 |
| `Pedido` | (1) ── (N) `DetallePedido` (N) ── (1) `Producto` | RF-04, RF-05 |
| `Pedido.estado` | Enum: `Pendiente/En Proceso/Entregado/Cancelado` | RF-05, RF-06 |
| `password_reset_otp` | (1) ── (1) `Usuario` por email; OTP hash SHA-256, expira 10 min, tope 5 intentos | RF-01 (recuperación) |
| `mensaje_pedido` | (N) ── (1) `Pedido`, (N) ── (1) `Usuario` (autor) | RF-10 (Fase 2) |

**Campos principales:** `Usuario(id, rol_id, nombre, email único, password_hash bcrypt, telefono, municipio, activo)` · `Producto(id, productor_id, categoria_id, nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, municipio, version)` · `Pedido(id, comprador_id, estado enum, total, direccion_entrega, telefono_contacto, notas)` · `DetallePedido(id, pedido_id, producto_id, cantidad, precio_unitario, subtotal)` · `Categoria(id, nombre único, descripcion, icono)` · `Rol(id, nombre único)` · `password_reset_otp(email PK, otp_hash, expires_at, intentos)` · `mensaje_pedido(id, pedido_id, autor_id, mensaje TEXT, leido, created_at)` (Fase 2, migración V4).

> **Nota de alcance:** la entidad `MensajePedido` no existió en el MVP y ahora se construye como Fase 2 (RF-10, migración V4, épica M).

**Estrategia de Migración:** Scripts SQL manuales versionados con Flyway (`V1__init.sql`, `V2__seed_data.sql`), lo que permite trazabilidad y consistencia del esquema entre entornos.

**Políticas de seguridad de datos:** Restricciones de integridad referencial (foreign keys) a nivel de base de datos, validación de unicidad en el correo de usuario, y control de acceso a nivel de aplicación (no se expone acceso directo a la BD desde el cliente).

### 3. APIs, Seguridad e Integraciones

**Notificaciones (implementa RF-07):** Nodemailer sobre SMTP (TLS verificado), para notificar al comprador cambios de estado del pedido (`Pendiente` → `En Proceso` → `Entregado`/`Cancelado`).
- El envío se ejecuta de forma asíncrona (proceso en segundo plano) para no bloquear la respuesta al usuario.
- Si el envío del correo falla, el cambio de estado del pedido **no se revierte**; el error se registra en el log del sistema (ver §5), cumpliendo el criterio de aceptación de RF-07.

**Almacenamiento de Archivos (soporta RF-02):** las fotos viajan como URL (`foto_url`, con imagen de respaldo vía `onerror` en vistas); no existe endpoint de subida de archivos en el MVP (FILE-SEC N/A por diseño).

**Protección de credenciales:** Las credenciales de SMTP y la cadena de conexión a la base de datos se gestionan mediante variables de entorno (no se hardcodean en el código ni se suben al repositorio). No se manejan tokens de API de terceros en el MVP, por lo que no se requiere un patrón BFF adicional.

**Seguridad y Autenticación (implementa RF-01, RF-08, RF-09):**
- JWT en cookie HttpOnly (`Secure` en producción, `SameSite=Lax` como protección CSRF); esquema `Bearer` aceptado por compatibilidad. Fail-fast sin `JWT_SECRET` propio en producción.
- Hashing de contraseñas mediante `bcrypt`; recuperación por OTP hash SHA-256 con expiración de 10 minutos (tabla `password_reset_otp`).
- Control de acceso basado en roles (RBAC) vía middlewares: rutas `/admin/**` restringidas al rol Administrador (RF-08, RF-09), escritura de productos y avance de pedidos propios restringida al rol Productor (RF-02, RF-05), catálogo público de lectura.

**Contrato de API de catálogo (implementa RF-03):** `GET /api/productos?q=<texto>&categoria_id=<id>&municipio=<texto>` — responde `{ success, total, categorias, productos }` excluyendo `cantidad_disponible <= 0`; el frontend filtra vía fetch + re-render sin recarga. La restitución de stock (RF-06) corre dentro de la transacción de cancelación (`cancelOrder`), incrementando `version`.

**Contrato de mensajería (implementa RF-10, Fase 2):** `POST /api/pedidos/:id/mensajes {mensaje}` · `GET /api/pedidos/:id/mensajes` (cronológico) · `PUT /api/pedidos/:id/mensajes/leer` (marca leídos los del otro) · `GET /api/pedidos/mensajes/no-leidos` (conteo por pedido). Solo participantes (comprador dueño o productor con productos en el pedido); ADMIN solo lectura. Texto 1–1000 caracteres sanitizado; correo async al receptor (extiende RF-07).

### 4. Estrategia de Pruebas y Robustez

**Pruebas seleccionadas:** Pruebas con **Node (`tests/test_rf_suite.js`, comando `npm test` en `backend/`)**, enfocadas en la lógica de negocio del backend, mapeadas directamente a los criterios de aceptación del PRD. Cada RF del MVP tiene al menos una prueba explícita:

| Prueba | RF que valida |
|---|---|
| Rechazo de registro con correo duplicado o con campos obligatorios vacíos. | RF-01 |
| Rechazo de publicación de producto con precio o stock menor o igual a cero. | RF-02 |
| El filtro/búsqueda de catálogo excluye productos sin stock disponible. | RF-03 |
| Validación de stock antes de confirmar un pedido. | RF-04 |
| Prohibición de auto-compra. | RF-04 |
| Prohibición de transiciones de estado inválidas (ej. saltar de `Pendiente` a `Entregado`). | RF-05 |
| Restitución correcta de stock al cancelar un pedido en estado `Pendiente`. | RF-06 |
| Bloqueo de cancelación en estados `En Proceso` y `Entregado`. | RF-06 |
| Persistencia del estado del pedido aunque el envío de correo falle (mock de fallo SMTP). | RF-07 |
| Bloqueo de acceso a rutas `/admin/**` para roles distintos de Administrador. | RF-08, RF-09 |
| Un usuario desactivado no puede iniciar sesión. | RF-08 |
| Bloqueo de escritura/lectura de mensajes por un usuario ajeno al pedido. | RF-10 (Fase 2, verificación por script en M5) |
| Flujo escribir → leer → marcar leídos entre participantes. | RF-10 (Fase 2, verificación por script en M5) |

**Validación de Datos (doble capa):**
- *Frontend:* Atributos nativos de HTML5 (`required`, `min="0"`, `type="email"`).
- *Backend:* Bean Validation (anotaciones `@NotNull`, `@Min`, `@Email`, etc.) sobre los DTOs, más validaciones explícitas de reglas de negocio en la capa de servicio.

### 5. Operaciones, Despliegue y Observabilidad

**Entorno de Despliegue seleccionado:** Node.js directo (desarrollo) o tras Nginx con TLS (producción), en una Máquina Virtual / VPS simple, por ser una opción económica y suficiente para el volumen de tráfico esperado en el MVP. Desarrollo y producción corren la misma app; producción queda pendiente de VPS (ver README §5).

**Logging y Telemetría:** `services/logger.js` con niveles (info/warn/error), volcado diario a `backend/logs/` con retención de 14 días, para depuración técnica y auditoría básica de errores (intentos de login fallidos, errores en la confirmación de pedidos, fallos de envío de correo — este último trazado explícitamente para respaldar el criterio de aceptación de RF-07).
