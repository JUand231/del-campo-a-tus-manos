# Technical Requirements Document (TRD)
## Proyecto: Del Campo a Tus Manos

> **Alcance funcional:** Este documento implementa exclusivamente los requisitos `RF-01` a `RF-09` definidos en PRD §3. Ninguna entidad, endpoint o integración descrita aquí existe sin un RF que la respalde.

### 1. Stack Tecnológico y Arquitectura de Software

**Arquitectura seleccionada:** Modelo-Vista-Controlador (MVC) desacoplado con API REST en el backend.

**Decisión de stack:** **Java + Spring Boot**, sobre Servlets/JSP puros, por su ecosistema más maduro para construir APIs REST, su menor cantidad de código repetitivo (boilerplate) y su facilidad para integrar seguridad, validaciones y persistencia de forma ordenada.

- **Backend:** Java con Spring Boot (Spring Web, Spring Security, Spring Data JPA).
- **Frontend:** HTML5, CSS3, JavaScript Vanilla y Bootstrap para diseño responsive.
- **Servidor de Aplicaciones:** Apache Tomcat (embebido en Spring Boot).
- **Control de Versiones:** Git.
- **Calidad estática:** Checkstyle + SpotBugs, ejecutados en cada build local (`mvn verify`) antes de cualquier `push` (ver PLAN §3, puerta de calidad de CI/lint).
- **Mejora continua (post-MVP):** cuando el equipo disponga de un runner, formalizar un pipeline de CI declarativo (ej. GitHub Actions) que ejecute `mvn verify` automáticamente en cada Pull Request, como respaldo del control local. No bloqueante para el MVP.

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

> **Nota de alcance (resuelve conflicto detectado en auditoría previa):** la entidad `MensajePedido` (mensajería entre productor y comprador) **no se crea en el Hito 1 ni en ningún hito del MVP**. Corresponde a la Fase 2 del roadmap (ver PLAN §1) y solo se diseñará cuando esa fase inicie. No existe tabla, endpoint ni servicio asociado a mensajería en esta versión del TRD.

**Estrategia de Migración:** Scripts SQL manuales versionados con Flyway (`V1__init.sql`, `V2__seed_data.sql`), lo que permite trazabilidad y consistencia del esquema entre entornos.

**Políticas de seguridad de datos:** Restricciones de integridad referencial (foreign keys) a nivel de base de datos, validación de unicidad en el correo de usuario, y control de acceso a nivel de aplicación (no se expone acceso directo a la BD desde el cliente).

### 3. APIs, Seguridad e Integraciones

**Notificaciones (implementa RF-07):** JavaMail API sobre SMTP, para notificar al comprador cambios de estado del pedido (`Pendiente` → `En Proceso` → `Entregado`/`Cancelado`).
- El envío se ejecuta de forma asíncrona (proceso en segundo plano) para no bloquear la respuesta al usuario.
- Si el envío del correo falla, el cambio de estado del pedido **no se revierte**; el error se registra en el log del sistema (ver §5), cumpliendo el criterio de aceptación de RF-07.

**Almacenamiento de Archivos (soporta RF-02):** Almacenamiento local en disco del servidor para imágenes subidas por los productores, con validación de tipo (jpg/png) y tamaño máximo por archivo.

**Protección de credenciales:** Las credenciales de SMTP y la cadena de conexión a la base de datos se gestionan mediante variables de entorno (no se hardcodean en el código ni se suben al repositorio). No se manejan tokens de API de terceros en el MVP, por lo que no se requiere un patrón BFF adicional.

**Seguridad y Autenticación (implementa RF-01, RF-08, RF-09):**
- Sesiones HTTP tradicionales con cookies seguras.
- Hashing de contraseñas mediante `bcrypt`.
- Control de acceso basado en roles (RBAC) mediante filtros de Spring Security: rutas `/admin/**` restringidas al rol Administrador (RF-08, RF-09), rutas `/productor/**` restringidas al rol Productor (RF-02, RF-05).

### 4. Estrategia de Pruebas y Robustez

**Pruebas seleccionadas:** Pruebas unitarias con **JUnit**, enfocadas en la lógica de negocio del backend, mapeadas directamente a los criterios de aceptación del PRD. Cada RF del MVP tiene al menos una prueba explícita:

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

**Validación de Datos (doble capa):**
- *Frontend:* Atributos nativos de HTML5 (`required`, `min="0"`, `type="email"`).
- *Backend:* Bean Validation (anotaciones `@NotNull`, `@Min`, `@Email`, etc.) sobre los DTOs, más validaciones explícitas de reglas de negocio en la capa de servicio.

### 5. Operaciones, Despliegue y Observabilidad

**Entorno de Despliegue seleccionado:** Servidor Apache Tomcat embebido, desplegado en una Máquina Virtual / VPS simple, por ser una opción económica y suficiente para el volumen de tráfico esperado en el MVP.

**Logging y Telemetría:** Registrador estructurado SLF4J / Logback, con volcado a archivos de log locales para depuración técnica y auditoría básica de errores (intentos de login fallidos, errores en la confirmación de pedidos, fallos de envío de correo — este último trazado explícitamente para respaldar el criterio de aceptación de RF-07).
