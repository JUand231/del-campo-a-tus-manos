/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/services/metricsService.js
 * DESCRIPCIÓN: Cálculo de métricas del sistema (RF-09)
 * CRITERIO DE ACEPTACIÓN: Frescura máxima de 5 minutos, solo lectura.
 * ==========================================================
 */

const db = require('../database/db');

let cachedMetrics = null;
let lastCalculatedTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos exactos según PRD §3 (RF-09)

async function getGlobalMetrics(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && cachedMetrics && (now - lastCalculatedTime < CACHE_TTL_MS)) {
        return {
            ...cachedMetrics,
            origen: 'cache',
            frescura_segundos: Math.round((now - lastCalculatedTime) / 1000),
            ttl_restante_segundos: Math.round((CACHE_TTL_MS - (now - lastCalculatedTime)) / 1000)
        };
    }

    // Consulta en tiempo real contra la base de datos
    try {
        const usersCount = await db.query('SELECT COUNT(*) AS total FROM usuario WHERE activo = 1');
        const productsCount = await db.query('SELECT COUNT(*) AS total FROM producto WHERE cantidad_disponible > 0');
        const completedOrdersCount = await db.query("SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS total_recaudo FROM pedido WHERE estado = 'Entregado'");
        const pendingOrdersCount = await db.query("SELECT COUNT(*) AS total FROM pedido WHERE estado = 'Pendiente'");
        const inProcessOrdersCount = await db.query("SELECT COUNT(*) AS total FROM pedido WHERE estado = 'En Proceso'");
        const cancelledOrdersCount = await db.query("SELECT COUNT(*) AS total FROM pedido WHERE estado = 'Cancelado'");

        const activeUsers = usersCount[0]?.total || 0;
        const publishedProducts = productsCount[0]?.total || 0;
        const completedOrders = completedOrdersCount[0]?.total || 0;
        const totalSales = completedOrdersCount[0]?.total_recaudo || 0;

        cachedMetrics = {
            usuarios_activos: Number(activeUsers),
            productos_publicados: Number(publishedProducts),
            pedidos_completados: Number(completedOrders),
            pedidos_pendientes: Number(pendingOrdersCount[0]?.total || 0),
            pedidos_en_proceso: Number(inProcessOrdersCount[0]?.total || 0),
            pedidos_cancelados: Number(cancelledOrdersCount[0]?.total || 0),
            total_recaudado: parseFloat(totalSales)
        };
        lastCalculatedTime = now;

        return {
            ...cachedMetrics,
            origen: 'tiempo_real',
            frescura_segundos: 0,
            ttl_restante_segundos: CACHE_TTL_MS / 1000
        };
    } catch (err) {
        console.error('[METRICS ERROR] Error calculando métricas:', err.message);
        throw err;
    }
}

module.exports = {
    getGlobalMetrics
};
