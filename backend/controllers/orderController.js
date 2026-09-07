/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/controllers/orderController.js
 * DESCRIPCIÓN: Controlador del ciclo de vida de pedidos (RF-04, RF-05, RF-06, RF-07)
 * REGLAS CRÍTICAS:
 *  - Descuento atómico de stock con control de concurrencia.
 *  - Prohibición de auto-compra (RF-04).
 *  - Transición secuencial de estados sin saltos (RF-05).
 *  - Cancelación exclusiva en estado 'Pendiente' con restitución de stock (RF-06).
 *  - Notificación asíncrona que no revierte transacción si falla (RF-07).
 * ==========================================================
 */

const db = require('../database/db');
const { sendOrderStatusNotificationAsync } = require('../services/emailService');

/**
 * Crea un nuevo pedido (RF-04 - Rol Comprador)
 */
async function createOrder(req, res, next) {
    try {
        const compradorId = req.user.id;
        const { direccion_entrega, telefono_contacto, notas, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El pedido debe contener al menos un producto.'
            });
        }

        // Ejecutar dentro de transacción atómica
        const result = await db.withTransaction(async (conn) => {
            let grandTotal = 0;
            const itemsProcessed = [];

            for (const item of items) {
                const productId = Number(item.producto_id);
                const quantityRequested = parseFloat(item.cantidad);

                if (quantityRequested <= 0) {
                    throw { statusCode: 400, message: 'La cantidad solicitada debe ser mayor a cero.' };
                }

                // 1. Consultar producto con datos actualizados
                const prodRows = conn 
                    ? (await conn.query('SELECT id, productor_id, nombre, precio, cantidad_disponible, version FROM producto WHERE id = ? FOR UPDATE', [productId]))[0]
                    : await db.query('SELECT id, productor_id, nombre, precio, cantidad_disponible, version FROM producto WHERE id = ?', [productId]);

                if (!prodRows || prodRows.length === 0) {
                    throw { statusCode: 404, message: `El producto con ID ${productId} no existe.` };
                }

                const product = prodRows[0];

                // 2. REGLA CRÍTICA: Prohibición de auto-compra (RF-04)
                if (product.productor_id === compradorId) {
                    throw { 
                        statusCode: 400, 
                        message: `No puedes comprar tu propio producto (${product.nombre}). La auto-compra está prohibida.` 
                    };
                }

                // 3. REGLA CRÍTICA: Validación de stock disponible (RF-04)
                if (quantityRequested > Number(product.cantidad_disponible)) {
                    throw { 
                        statusCode: 400, 
                        message: `Stock insuficiente para '${product.nombre}'. Solicitado: ${quantityRequested}, disponible: ${product.cantidad_disponible}.` 
                    };
                }

                const subtotal = quantityRequested * Number(product.precio);
                grandTotal += subtotal;

                itemsProcessed.push({
                    producto_id: product.id,
                    cantidad: quantityRequested,
                    precio_unitario: Number(product.precio),
                    subtotal,
                    nombre: product.nombre,
                    productor_id: product.productor_id
                });

                // 4. Descuento atómico de stock
                if (conn) {
                    await conn.query(
                        'UPDATE producto SET cantidad_disponible = cantidad_disponible - ?, version = version + 1 WHERE id = ?',
                        [quantityRequested, product.id]
                    );
                } else {
                    await db.query(
                        'UPDATE producto SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?',
                        [quantityRequested, product.id]
                    );
                }
            }

            // 5. Insertar encabezado de pedido
            let newOrderId = null;
            if (conn) {
                const [orderRes] = await conn.query(
                    'INSERT INTO pedido (comprador_id, estado, total, direccion_entrega, telefono_contacto, notas) VALUES (?, ?, ?, ?, ?, ?)',
                    [compradorId, 'Pendiente', grandTotal, direccion_entrega.trim(), telefono_contacto.trim(), notas ? notas.trim() : null]
                );
                newOrderId = orderRes.insertId;

                // 6. Insertar detalles del pedido
                for (const it of itemsProcessed) {
                    await conn.query(
                        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                        [newOrderId, it.producto_id, it.cantidad, it.precio_unitario, it.subtotal]
                    );
                }
            } else {
                const orderRes = await db.query(
                    'INSERT INTO pedido (comprador_id, estado, total, direccion_entrega, telefono_contacto, notas) VALUES (?, ?, ?, ?, ?, ?)',
                    [compradorId, 'Pendiente', grandTotal, direccion_entrega.trim(), telefono_contacto.trim(), notas ? notas.trim() : null]
                );
                newOrderId = orderRes.insertId;

                for (const it of itemsProcessed) {
                    await db.query(
                        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                        [newOrderId, it.producto_id, it.cantidad, it.precio_unitario, it.subtotal]
                    );
                }
            }

            return { orderId: newOrderId, total: grandTotal, items: itemsProcessed };
        });

        // 7. Notificación asíncrona por correo (RF-07)
        sendOrderStatusNotificationAsync({
            to: req.user.email,
            nombreComprador: req.user.nombre,
            pedidoId: result.orderId,
            nuevoEstado: 'Pendiente',
            total: result.total
        });

        return res.status(201).json({
            success: true,
            message: '¡Tu pedido fue realizado con éxito!',
            pedidoId: result.orderId,
            total: result.total,
            estado: 'Pendiente'
        });

    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        next(err);
    }
}

/**
 * Obtener pedidos del comprador autenticado (RF-04, RF-06)
 */
async function getMyOrders(req, res, next) {
    try {
        const compradorId = req.user.id;
        const sql = `
            SELECT 
                p.id, p.comprador_id, p.estado, p.total, p.direccion_entrega, 
                p.telefono_contacto, p.notas, p.created_at, p.updated_at
            FROM pedido p
            WHERE p.comprador_id = ?
            ORDER BY p.created_at DESC
        `;
        const orders = await db.query(sql, [compradorId]);

        // Cargar ítems de cada pedido
        for (const order of orders) {
            const details = await db.query(`
                SELECT 
                    dp.id, dp.producto_id, dp.cantidad, dp.precio_unitario, dp.subtotal,
                    pr.nombre AS producto_nombre, pr.foto_url AS producto_foto, pr.unidad_medida,
                    u.nombre AS productor_nombre
                FROM detalle_pedido dp
                JOIN producto pr ON dp.producto_id = pr.id
                JOIN usuario u ON pr.productor_id = u.id
                WHERE dp.pedido_id = ?
            `, [order.id]);
            order.items = details;
        }

        return res.json({
            success: true,
            pedidos: orders
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Obtener pedidos recibidos por un productor (RF-05)
 */
async function getProducerOrders(req, res, next) {
    try {
        const productorId = req.user.id;
        const sql = `
            SELECT DISTINCT 
                p.id, p.comprador_id, p.estado, p.total, p.direccion_entrega, 
                p.telefono_contacto, p.notas, p.created_at,
                u.nombre AS comprador_nombre, u.email AS comprador_email, u.telefono AS comprador_telefono
            FROM pedido p
            JOIN detalle_pedido dp ON p.id = dp.pedido_id
            JOIN producto pr ON dp.producto_id = pr.id
            JOIN usuario u ON p.comprador_id = u.id
            WHERE pr.productor_id = ?
            ORDER BY p.created_at DESC
        `;
        const orders = await db.query(sql, [productorId]);

        for (const order of orders) {
            const details = await db.query(`
                SELECT 
                    dp.id, dp.producto_id, dp.cantidad, dp.precio_unitario, dp.subtotal,
                    pr.nombre AS producto_nombre, pr.unidad_medida
                FROM detalle_pedido dp
                JOIN producto pr ON dp.producto_id = pr.id
                WHERE dp.pedido_id = ? AND pr.productor_id = ?
            `, [order.id, productorId]);
            order.items = details;
        }

        return res.json({
            success: true,
            pedidos: orders
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Actualizar estado del pedido por parte del productor (RF-05)
 * Flujo secuencial estricto: Pendiente -> En Proceso -> Entregado.
 */
async function updateOrderStatus(req, res, next) {
    try {
        const orderId = Number(req.params.id);
        const { nuevo_estado } = req.body;

        const orders = await db.query(`
            SELECT p.id, p.estado, p.total, p.comprador_id, u.email AS comprador_email, u.nombre AS comprador_nombre
            FROM pedido p
            JOIN usuario u ON p.comprador_id = u.id
            WHERE p.id = ?
        `, [orderId]);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        const order = orders[0];
        const estadoActual = order.estado;

        // REGLA RF-05/RF-08 (anti-IDOR, bloqueador D2): solo el productor dueño
        // de los productos del pedido (o ADMIN) puede avanzar su estado.
        if (!req.user || req.user.rol_nombre !== 'ADMIN') {
            const ownerId = req.user ? req.user.id : null;
            const owned = await db.query(
                `SELECT 1 FROM detalle_pedido dp
                 JOIN producto pr ON dp.producto_id = pr.id
                 WHERE dp.pedido_id = ? AND pr.productor_id = ?
                 LIMIT 1`,
                [orderId, ownerId]
            );
            if (!owned || owned.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes autorización para modificar este pedido porque no contiene productos de tu finca.'
                });
            }
        }

        // REGLA CRÍTICA RF-05: Transiciones válidas y prohibición de saltos
        // Permitido: Pendiente -> En Proceso
        // Permitido: En Proceso -> Entregado
        // Prohibido: Pendiente -> Entregado directamente
        // Prohibido: Cualquier cambio sobre Entregado o Cancelado
        const validTransitions = {
            'Pendiente': ['En Proceso'],
            'En Proceso': ['Entregado'],
            'Entregado': [],
            'Cancelado': []
        };

        const allowedNextStates = validTransitions[estadoActual] || [];

        if (!allowedNextStates.includes(nuevo_estado)) {
            return res.status(400).json({
                success: false,
                message: `Transición de estado inválida. Un pedido en estado '${estadoActual}' no puede pasar a '${nuevo_estado}'. Las transiciones permitidas son: Pendiente → En Proceso → Entregado.`
            });
        }

        // Actualizar estado en la base de datos
        await db.query('UPDATE pedido SET estado = ? WHERE id = ?', [nuevo_estado, orderId]);

        // Disparar notificación asíncrona (RF-07)
        sendOrderStatusNotificationAsync({
            to: order.comprador_email,
            nombreComprador: order.comprador_nombre,
            pedidoId: order.id,
            nuevoEstado: nuevo_estado,
            total: order.total
        });

        return res.json({
            success: true,
            message: `El pedido #${orderId} ha sido actualizado a estado '${nuevo_estado}'.`,
            nuevoEstado: nuevo_estado
        });

    } catch (err) {
        next(err);
    }
}

/**
 * Cancelación de pedido por el comprador (RF-06)
 * REGLA CRÍTICA:
 * - Solo se permite en estado 'Pendiente'.
 * - En 'En Proceso' o 'Entregado' se rechaza.
 * - Restituye automáticamente el stock a cada producto.
 */
async function cancelOrder(req, res, next) {
    try {
        const orderId = Number(req.params.id);
        const compradorId = req.user.id;

        const orders = await db.query(`
            SELECT p.id, p.comprador_id, p.estado, p.total, u.email AS comprador_email, u.nombre AS comprador_nombre
            FROM pedido p
            JOIN usuario u ON p.comprador_id = u.id
            WHERE p.id = ?
        `, [orderId]);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        const order = orders[0];

        // Verificar que pertenezca al comprador (o que sea ADMIN)
        if (Number(order.comprador_id) !== Number(compradorId) && req.user.rol_nombre !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'No tienes autorización para cancelar este pedido.' });
        }

        // REGLA CRÍTICA RF-06: Bloqueo de cancelación si ya está En Proceso o Entregado
        if (order.estado !== 'Pendiente') {
            return res.status(400).json({
                success: false,
                message: `No es posible cancelar el pedido porque se encuentra en estado '${order.estado}'. La cancelación en línea solo está disponible mientras el pedido permanezca en estado 'Pendiente'.`
            });
        }

        // Obtener detalles del pedido para restituir stock
        const details = await db.query('SELECT producto_id, cantidad FROM detalle_pedido WHERE pedido_id = ?', [orderId]);

        await db.withTransaction(async (conn) => {
            // 1. Restituir el stock de cada producto
            for (const item of details) {
                if (conn) {
                    await conn.query(
                        'UPDATE producto SET cantidad_disponible = cantidad_disponible + ?, version = version + 1 WHERE id = ?',
                        [item.cantidad, item.producto_id]
                    );
                } else {
                    await db.query(
                        'UPDATE producto SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
                        [item.cantidad, item.producto_id]
                    );
                }
            }

            // 2. Cambiar estado a 'Cancelado'
            if (conn) {
                await conn.query("UPDATE pedido SET estado = 'Cancelado' WHERE id = ?", [orderId]);
            } else {
                await db.query("UPDATE pedido SET estado = 'Cancelado' WHERE id = ?", [orderId]);
            }
        });

        // 3. Notificación asíncrona al comprador (RF-07)
        sendOrderStatusNotificationAsync({
            to: order.comprador_email,
            nombreComprador: order.comprador_nombre,
            pedidoId: order.id,
            nuevoEstado: 'Cancelado',
            total: order.total
        });

        return res.json({
            success: true,
            message: `El pedido #${orderId} ha sido cancelado con éxito y el stock de los productos ha sido restituido automáticamente al catálogo.`,
            nuevoEstado: 'Cancelado'
        });

    } catch (err) {
        next(err);
    }
}

module.exports = {
    createOrder,
    getMyOrders,
    getProducerOrders,
    updateOrderStatus,
    cancelOrder
};
