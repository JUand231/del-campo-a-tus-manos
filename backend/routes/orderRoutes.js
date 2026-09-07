/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/routes/orderRoutes.js
 * ==========================================================
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validateOrder, sanitizeBody } = require('../middleware/validation');
const { rateLimiter } = require('../middleware/rateLimiter');

const orderLimiter = rateLimiter({ windowMs: 60000, maxRequests: 20, message: 'Has alcanzado el límite de operaciones sobre pedidos por minuto.' });

// Rutas de Comprador (RF-04, RF-06)
router.post('/', authenticateToken, requireRole(['COMPRADOR', 'ADMIN']), orderLimiter, sanitizeBody, validateOrder, orderController.createOrder);
router.get('/mis-pedidos', authenticateToken, requireRole(['COMPRADOR', 'ADMIN']), orderController.getMyOrders);
router.put('/:id/cancelar', authenticateToken, requireRole(['COMPRADOR', 'ADMIN']), orderController.cancelOrder);

// Rutas de Productor (RF-05)
router.get('/productor', authenticateToken, requireRole(['PRODUCTOR', 'ADMIN']), orderController.getProducerOrders);
router.put('/:id/estado', authenticateToken, requireRole(['PRODUCTOR', 'ADMIN']), sanitizeBody, orderController.updateOrderStatus);

module.exports = router;
