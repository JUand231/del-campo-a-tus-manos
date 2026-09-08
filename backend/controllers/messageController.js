/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/controllers/messageController.js
 * DESCRIPCIÓN: Mensajería integrada al pedido (RF-10, Fase 2)
 * REGLAS:
 *  - Solo participantes (comprador dueño o productor con productos
 *    en el pedido) pueden escribir; ADMIN solo lectura del hilo.
 *  - Texto 1–1000 caracteres (validado aquí y en middleware).
 * ==========================================================
 */

const db = require('../database/db');
const { notifyOrderMessageAsync } = require('../services/emailService');

/**
 * Verifica que el pedido exista y el rol del usuario dentro de él.
 * @returns {Promise<{pedido: object, rol: string}|null>} rol: COMPRADOR|PRODUCTOR
 */
async function getParticipation(pedidoId, user) {
    const orders = await db.query('SELECT id, comprador_id, estado FROM pedido WHERE id = ?', [pedidoId]);
    if (!orders || orders.length === 0) {
        return null;
    }
    const order = orders[0];

    if (Number(order.comprador_id) === Number(user.id)) {
        return { pedido: order, rol: 'COMPRADOR' };
    }

    const owned = await db.query(
        `SELECT 1 FROM detalle_pedido dp
         JOIN producto pr ON dp.producto_id = pr.id
         WHERE dp.pedido_id = ? AND pr.productor_id = ?
         LIMIT 1`,
        [pedidoId, user.id]
    );
    if (owned && owned.length > 0) {
        return { pedido: order, rol: 'PRODUCTOR' };
    }

    return null;
}

async function orderExists(pedidoId) {
    const rows = await db.query('SELECT id FROM pedido WHERE id = ?', [pedidoId]);
    return !!(rows && rows.length > 0);
}

/**
 * Publicar mensaje en el hilo del pedido (RF-10: participantes).
 */
async function postMessage(req, res, next) {
    try {
        const pedidoId = Number(req.params.id);
        const texto = req.body && typeof req.body.mensaje === 'string' ? req.body.mensaje.trim() : '';

        if (texto.length < 1 || texto.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'El mensaje debe tener entre 1 y 1000 caracteres.'
            });
        }

        const part = await getParticipation(pedidoId, req.user);
        if (!part) {
            if (!(await orderExists(pedidoId))) {
                return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
            }
            return res.status(403).json({
                success: false,
                message: 'No tienes autorización para escribir en este pedido porque no participas en él.'
            });
        }

        const result = await db.query(
            'INSERT INTO mensaje_pedido (pedido_id, autor_id, mensaje) VALUES (?, ?, ?)',
            [pedidoId, req.user.id, texto]
        );

        // M3: notificación async al otro participante (extiende RF-07).
        // Fire-and-forget: jamás bloquea ni revierte el 201.
        notifyOrderMessageAsync({ pedidoId, autorId: req.user.id, autorNombre: req.user.nombre, texto }).catch(() => {});

        return res.status(201).json({
            success: true,
            message: 'Mensaje enviado.',
            mensajeId: result.insertId
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Leer el hilo del pedido en orden cronológico (RF-10: participantes + ADMIN).
 */
async function getMessages(req, res, next) {
    try {
        const pedidoId = Number(req.params.id);

        const part = await getParticipation(pedidoId, req.user);
        const isAdmin = req.user && req.user.rol_nombre === 'ADMIN';
        if (!part && !isAdmin) {
            if (!(await orderExists(pedidoId))) {
                return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
            }
            return res.status(403).json({
                success: false,
                message: 'No tienes autorización para leer este pedido porque no participas en él.'
            });
        }

        const rows = await db.query(
            `SELECT m.id, m.pedido_id, m.autor_id, m.mensaje, m.leido, m.created_at, u.nombre AS autor_nombre
             FROM mensaje_pedido m
             JOIN usuario u ON m.autor_id = u.id
             WHERE m.pedido_id = ?
             ORDER BY m.created_at ASC, m.id ASC`,
            [pedidoId]
        );

        return res.json({ success: true, mensajes: rows });
    } catch (err) {
        next(err);
    }
}

/**
 * Marcar como leídos los mensajes del otro participante (RF-10: participantes).
 */
async function markRead(req, res, next) {
    try {
        const pedidoId = Number(req.params.id);

        const part = await getParticipation(pedidoId, req.user);
        if (!part) {
            if (!(await orderExists(pedidoId))) {
                return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
            }
            return res.status(403).json({
                success: false,
                message: 'No tienes autorización sobre este pedido porque no participas en él.'
            });
        }

        const result = await db.query(
            'UPDATE mensaje_pedido SET leido = 1 WHERE pedido_id = ? AND autor_id != ?',
            [pedidoId, req.user.id]
        );

        return res.json({ success: true, marcados: result.affectedRows || 0 });
    } catch (err) {
        next(err);
    }
}

/**
 * Conteo de no leídos por pedido para mis participaciones (RF-10).
 */
async function getUnread(req, res, next) {
    try {
        const userId = req.user.id;

        const asBuyer = await db.query('SELECT id FROM pedido WHERE comprador_id = ?', [userId]);
        const asProducer = await db.query(
            `SELECT DISTINCT p.id FROM pedido p
             JOIN detalle_pedido dp ON p.id = dp.pedido_id
             JOIN producto pr ON dp.producto_id = pr.id
             WHERE pr.productor_id = ?`,
            [userId]
        );
        const ids = [...new Set([...asBuyer.map(o => o.id), ...asProducer.map(o => o.id)])];

        if (ids.length === 0) {
            return res.json({ success: true, no_leidos: [] });
        }

        const rows = await db.query(
            'SELECT pedido_id, COUNT(*) AS no_leidos FROM mensaje_pedido WHERE pedido_id IN (?) AND autor_id != ? AND leido = 0 GROUP BY pedido_id',
            [ids, userId]
        );

        return res.json({ success: true, no_leidos: rows });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    postMessage,
    getMessages,
    markRead,
    getUnread
};
