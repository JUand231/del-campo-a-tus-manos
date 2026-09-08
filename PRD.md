# Product Requirements Document (PRD)
## Proyecto: Del Campo a Tus Manos

> **Fuente de verdad:** Este documento es la única fuente de verdad sobre *qué* funcionalidades existen en el MVP y *cuándo* se consideran terminadas. TRD, PLAN y USER_FLOW deben referenciar los IDs `RF-XX` definidos aquí; ningún otro documento puede introducir una funcionalidad, entidad o flujo que no tenga un RF correspondiente en esta sección.

### 1. Visión y Objetivos de Negocio

**Problema:** Los productores agrícolas dependen de múltiples intermediarios para vender sus cosechas, lo que reduce drásticamente sus ganancias y aumenta el costo final para el comprador, además de limitar la transparencia sobre el origen y calidad de los productos.

**Propuesta de Valor:** Plataforma web que conecta directamente a productores del campo con personas, familias, restaurantes, tiendas y empresas. Ofrece precios justos, mayor margen de ganancia para el campesino y visibilidad comercial directa.

**Métricas y KPIs de Éxito:**
- Número de productores y compradores registrados y activos.
- Número de ofertas de productos publicadas en catálogo.
- Número de pedidos realizados y porcentaje de pedidos completados ("Entregado").
- Nivel de satisfacción del usuario (medido en encuestas sencillas).

### 2. Usuarios, Roles y Permisos (RBAC)

| Rol | Permisos |
|---|---|
| **Visitante (No Autenticado)** | Acceso en solo lectura al landing page y catálogo público. No puede realizar compras ni publicar. |
| **Productor** | Registro y gestión de perfil personal. Permisos de lectura/escritura sobre su propio catálogo de productos y gestión de los pedidos recibidos (cambio de estado). |
| **Comprador** | Registro y gestión de perfil personal. Búsqueda y filtrado en catálogo público. Creación de pedidos y seguimiento de su historial de compras. Puede solicitar la cancelación de un pedido mientras esté en estado "Pendiente". |
| **Administrador** | Supervisión global del sistema. Permisos para activar/desactivar usuarios, moderar/eliminar publicaciones y consultar métricas globales. |

### 3. Funcionalidades y Criterios de Aceptación

Cada funcionalidad tiene un identificador único (`RF-XX`) que debe citarse en TRD (componente técnico que la implementa), PLAN (hito que la entrega) y USER_FLOW (pantallas donde se manifiesta).

| ID | Funcionalidad | Descripción | Criterio de Aceptación |
|---|---|---|---|
| **RF-01** | Autenticación | Registro e inicio de sesión con correo y contraseña, validando duplicidad de correos. Incluye recuperación de contraseña por código OTP al correo (hash, expira en 10 min, tope de 5 intentos). | El sistema rechaza el registro si el correo ya existe o si algún campo obligatorio está vacío, mostrando un mensaje claro al usuario. |
| **RF-02** | Gestión de Productos (Productor) | Crear, editar y eliminar publicaciones (nombre, descripción, precio, cantidad disponible, unidad de medida, foto y municipio). | Un producto solo se publica cuando todos los campos obligatorios son válidos (precio y stock mayores a cero) y aparece de inmediato en el catálogo público. |
| **RF-03** | Catálogo y Búsqueda (Comprador) | Visualización de productos disponibles con filtros por categoría o búsqueda por nombre. | Los resultados del filtro/búsqueda se actualizan sin recargar la página completa y muestran solo productos con stock disponible. |
| **RF-04** | Generación de Pedidos | Selección de productos y cantidad deseada. Descuento automático de stock al confirmar la compra. | El pedido solo se confirma si la cantidad solicitada es menor o igual al stock disponible en ese momento; el stock se descuenta de forma inmediata y consistente. |
| **RF-05** | Gestión de Estados de Pedido | Actualización de estado del pedido (`Pendiente` → `En Proceso` → `Entregado`) por parte del productor y visualización del avance por parte del comprador. | El productor solo puede avanzar el estado en el orden definido (no puede saltar de `Pendiente` a `Entregado` directamente). |
| **RF-06** | Cancelación de Pedidos (Comprador) | El comprador puede cancelar un pedido únicamente mientras se encuentra en estado `Pendiente`. | Al cancelar, el stock reservado se restituye automáticamente y el pedido cambia a estado `Cancelado`. No es posible cancelar pedidos en estado `En Proceso` o `Entregado` desde la plataforma. |
| **RF-07** | Notificaciones por Correo (Sistema) | El comprador recibe un correo automático cada vez que cambia el estado de su pedido (`En Proceso`, `Entregado` o `Cancelado`). | El correo se envía de forma asíncrona tras el cambio de estado; si el envío falla, la operación de cambio de estado **no se revierte** y el pedido conserva su nuevo estado. |
| **RF-08** | Panel de Administración — Moderación | Control sobre el estado de cuentas de usuarios y moderación/eliminación de publicaciones inadecuadas. | Un usuario desactivado por el administrador no puede iniciar sesión ni realizar acciones en la plataforma hasta ser reactivado. |
| **RF-09** | Panel de Administración — Métricas | El administrador consulta métricas globales del sistema (usuarios activos, productos publicados, pedidos completados). | Las métricas se calculan en tiempo real contra la base de datos en cada consulta (sin caché) o, si se implementa caché, esta tiene una frescura máxima de **5 minutos**. El panel es de solo lectura: no permite editar datos desde ahí. |
| **RF-10** | Mensajería del Pedido (Fase 2) | Comprador y productor intercambian mensajes de texto dentro de un pedido donde participan. | Solo los participantes del pedido (comprador dueño o productor con productos en él) pueden escribir y leer; ADMIN solo lectura. Los mensajes se listan en orden cronológico con marca de leídos. |

### 4. Límites, Restricciones y Exclusiones

**Restricciones:**
- Aplicación web responsive (optimizada para dispositivos móviles y escritorio).
- Navegación e interfaz sencilla, adaptada para usuarios del ámbito rural.
- Lenguaje 100% en español.

**Fuera del Alcance (Exclusiones para MVP — ver PLAN §1 "Fase 2/3"):**
- Pasarelas de pago en línea integradas (pagos coordinados en persona/transferencia).
- Rastreo GPS en tiempo real.
- **Mensajería/chat directo entre productor y comprador dentro del pedido** (entidad `MensajePedido`: excluida del MVP, **en construcción en Fase 2 como RF-10**).
- App nativa Android/iOS.
- Facturación electrónica.
- Calificaciones avanzadas con IA.

### 5. Flujos Críticos y Casos Límite a Validar

| Caso límite | RF relacionado |
|---|---|
| Intento de registro con correo duplicado o campos obligatorios vacíos. | RF-01 |
| Código OTP expirado, erróneo o con intentos agotados al recuperar contraseña. | RF-01 |
| Publicación de productos con precio o stock menor o igual a cero. | RF-02 |
| Intento de compra solicitando una cantidad superior al stock disponible. | RF-04 |
| Intento de auto-compra (un productor comprándose a sí mismo). | RF-04 |
| Intento de cancelación de un pedido en estado "En Proceso" o "Entregado" (debe bloquearse). | RF-06 |
| Cancelación válida de un pedido en estado "Pendiente" y verificación de que el stock se restituye correctamente. | RF-06 |
| Falla en el envío del correo de notificación: el pedido debe conservar su estado igualmente. | RF-07 |
| Bloqueo de acceso a funciones administrativas para roles no autorizados. | RF-08, RF-09 |
| Envío o lectura de mensajes por un usuario ajeno al pedido (debe bloquearse con 403). | RF-10 |
| Mensaje vacío o mayor a 1000 caracteres (debe rechazarse con 400). | RF-10 |
