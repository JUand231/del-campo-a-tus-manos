# Flujo de Navegación (User Flow)
## Proyecto: Del Campo a Tus Manos

> Los flujos aquí descritos implementan la experiencia de los requisitos `RF-01` a `RF-09` de PRD §3. No se navega hacia ninguna función de mensajería/chat: esa capacidad está fuera del MVP (ver PRD §4).

### 1. Entry Point y Estado Inicial

**Landing Page:** Pantalla pública accesible para cualquier usuario. Presenta la propuesta del proyecto y muestra el catálogo en modo lectura.

**Comportamiento por Rol:**
- **Visitante:** Ve catálogo y landing. Al hacer clic en "Comprar" o "Publicar", es redirigido al Login.
- **Comprador:** Accede al catálogo interactivo y a su sección "Mis Pedidos" (RF-03, RF-04).
- **Productor:** Accede a su dashboard de "Mis Productos" y "Pedidos Recibidos" (RF-02, RF-05).
- **Administrador:** Redirección automática al Panel de Administración (RF-08, RF-09).

**Manejo de sesión (soporta RF-01):**
- Si un usuario intenta acceder a una sección que requiere autenticación sin tener sesión activa, el sistema lo redirige al Login y, tras iniciar sesión, lo devuelve a la página que intentaba visitar.
- Si la sesión expira mientras el usuario navega, la próxima acción que requiera autenticación (ej. confirmar un pedido) lo redirige al Login con un mensaje: *"Tu sesión ha expirado, por favor inicia sesión de nuevo."*

### 2. Happy Path del Comprador (RF-01, RF-03, RF-04, RF-06, RF-07)

1. Ingreso a la landing e inicio de sesión autenticado (RF-01).
2. Navegación por el catálogo y selección de producto agrícola.
3. Apertura de la vista de detalle del producto, selección de cantidad y clic en "Realizar Pedido".
4. Verificación de stock e impacto automático en la base de datos (RF-04).
5. Muestra de pantalla de confirmación exitosa con resumen de la compra.
6. Redirección sugerida a la sección "Mis Pedidos" para monitoreo del estado.
7. El comprador recibe un correo automático cada vez que el productor cambia el estado del pedido, o al cancelarlo él mismo desde "Mis Pedidos" (RF-06, RF-07).

### 3. Happy Path del Productor (RF-01, RF-02, RF-05)

1. Ingreso a la landing e inicio de sesión autenticado (RF-01).
2. Redirección al dashboard "Mis Productos".
3. Clic en "Publicar Producto" y llenado del formulario (nombre, descripción, precio, cantidad, unidad, foto, municipio).
4. Confirmación de publicación: el producto aparece de inmediato en el catálogo público (RF-02).
5. Notificación en el dashboard cuando llega un nuevo pedido, visible en "Pedidos Recibidos".
6. Actualización del estado del pedido (`Pendiente` → `En Proceso` → `Entregado`) desde el detalle del pedido (RF-05), lo que dispara la notificación por correo al comprador (RF-07).

### 4. Happy Path del Administrador (RF-01, RF-08, RF-09)

1. Ingreso a la landing e inicio de sesión autenticado (RF-01).
2. Redirección automática al Panel de Administración.
3. Consulta del listado de usuarios y publicaciones, con métricas globales visibles (usuarios activos, productos publicados, pedidos completados), calculadas en tiempo real o con frescura máxima de 5 minutos — RF-09.
4. Selección de un usuario o publicación para moderar (activar/desactivar cuenta, eliminar publicación inadecuada) — RF-08.
5. Confirmación de la acción y actualización inmediata del estado en el sistema.

### 5. Bifurcaciones y Escenarios Alternativos (Edge Cases)

- **Agotamiento de Stock Concurrente (RF-04):** Si el stock se agota mientras el usuario está en la pantalla de detalle, al intentar pedir se cancela la transacción, se muestra una alerta contextual de stock agotado y se actualiza la vista.
- **Cancelación en "Pendiente" (RF-06):** El comprador puede cancelar el pedido desde "Mis Pedidos"; al confirmar, el stock reservado se restituye y el pedido pasa a estado `Cancelado`.
- **Cancelación en "En Proceso" (RF-06):** Se deshabilita la cancelación directa en la plataforma y se despliega un mensaje indicando coordinar con el productor.
- **Cancelación en "Entregado" (RF-06):** Botón de cancelación totalmente bloqueado en la interfaz.
- **Intento de auto-compra (RF-04):** Si un productor intenta comprar su propio producto, el sistema bloquea la acción y muestra un mensaje explicativo.
- **Falla en el envío del correo (RF-07):** El pedido conserva su nuevo estado con normalidad; no se muestra ningún error al usuario en pantalla, ya que el fallo es interno y no bloqueante.
- **Correo duplicado o campos vacíos al registrarse (RF-01):** El formulario muestra el error inline (ver §6 Error State) y conserva los datos ya ingresados.

### 6. Estados de la Interfaz (UI States)

- **Empty State:** Cuando no existen productos en una categoría, se despliega una ilustración simple con el mensaje: *"Todavía no hay productos disponibles en esta categoría."*
- **Loading State:** Despliegue de indicadores visuales de carga en botones o listas durante peticiones asíncronas.
- **Error State:** Los mensajes de fallo por validación se muestran inline, directamente bajo el campo involucrado (en texto rojo y lenguaje sencillo), conservando la información ya ingresada.

### 7. Feedback de Cierre

Al confirmar un pedido, la aplicación redirige a una pantalla de éxito con la leyenda *"¡Tu pedido fue realizado con éxito!"*, presentando el resumen técnico de la orden y botones de acción rápida para "Volver al Catálogo" o "Ver Mis Pedidos". Adicionalmente, el sistema dispara en segundo plano el correo de notificación de RF-07 (el usuario no espera esta acción para ver la confirmación en pantalla).

Al publicar un producto (Productor), se muestra un mensaje breve *"Producto publicado correctamente"* con opción de "Publicar otro" o "Ver mi catálogo".

Al completar una acción de moderación (Administrador), se muestra una confirmación *"Cambios guardados"* y se actualiza la lista sin recargar la página.
