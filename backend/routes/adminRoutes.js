/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/routes/adminRoutes.js
 * ==========================================================
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Todas las rutas de administración requieren rol ADMIN (RF-08, RF-09)
router.use(authenticateToken, requireRole(['ADMIN']));

// Métricas del sistema (RF-09)
router.get('/metricas', adminController.getMetrics);

// Gestión de usuarios y moderación (RF-08)
router.get('/usuarios', adminController.getUsers);
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);

// Moderación de publicaciones (RF-08)
router.get('/productos', adminController.getAllProducts);
router.delete('/productos/:id', adminController.deleteProduct);

module.exports = router;
