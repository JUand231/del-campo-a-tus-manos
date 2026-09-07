/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/controllers/adminController.js
 * DESCRIPCIÓN: Controlador del panel de administración (RF-08, RF-09)
 * REGLAS:
 *  - Moderación de usuarios y productos (RF-08).
 *  - Métricas globales de solo lectura con caché <= 5 min (RF-09).
 * ==========================================================
 */

const db = require('../database/db');
const { getGlobalMetrics } = require('../services/metricsService');

/**
 * Consulta de métricas globales del sistema (RF-09 - Solo Lectura)
 */
async function getMetrics(req, res, next) {
    try {
        const force = req.query.force === 'true';
        const metrics = await getGlobalMetrics(force);
        return res.json({
            success: true,
            data: metrics
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Listar todos los usuarios para moderación (RF-08)
 */
async function getUsers(req, res, next) {
    try {
        const sql = `
            SELECT u.id, u.rol_id, u.nombre, u.email, u.telefono, u.municipio, u.activo, u.created_at,
                   r.nombre AS rol_nombre
            FROM usuario u
            JOIN rol r ON u.rol_id = r.id
            ORDER BY u.id ASC
        `;
        const users = await db.query(sql);
        return res.json({
            success: true,
            total: users.length,
            usuarios: users
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Activar o desactivar cuenta de usuario (RF-08)
 */
async function toggleUserStatus(req, res, next) {
    try {
        const targetUserId = Number(req.params.id);
        const { activo } = req.body;

        // No permitir auto-desactivación del administrador logueado
        if (targetUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes desactivar tu propia cuenta de administrador principal.'
            });
        }

        const newStatus = Number(activo) === 1 ? 1 : 0;
        await db.query('UPDATE usuario SET activo = ? WHERE id = ?', [newStatus, targetUserId]);

        const actionText = newStatus === 1 ? 'activada' : 'desactivada';
        return res.json({
            success: true,
            message: `La cuenta del usuario #${targetUserId} ha sido ${actionText} exitosamente.`,
            activo: newStatus
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Listar todas las publicaciones para moderación (RF-08)
 */
async function getAllProducts(req, res, next) {
    try {
        const sql = `
            SELECT p.id, p.productor_id, p.categoria_id, p.nombre, p.descripcion, 
                   p.precio, p.cantidad_disponible, p.unidad_medida, p.municipio, p.created_at,
                   c.nombre AS categoria_nombre,
                   u.nombre AS productor_nombre, u.email AS productor_email
            FROM producto p
            JOIN categoria c ON p.categoria_id = c.id
            JOIN usuario u ON p.productor_id = u.id
            ORDER BY p.id DESC
        `;
        const products = await db.query(sql);
        return res.json({
            success: true,
            total: products.length,
            productos: products
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Moderar/Eliminar publicación inadecuada (RF-08)
 */
async function deleteProduct(req, res, next) {
    try {
        const productId = Number(req.params.id);
        const result = await db.query('DELETE FROM producto WHERE id = ?', [productId]);
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: `La publicación #${productId} no existe.` });
        }
        return res.json({
            success: true,
            message: `La publicación #${productId} ha sido eliminada por moderación administrativa.`
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getMetrics,
    getUsers,
    toggleUserStatus,
    getAllProducts,
    deleteProduct
};
