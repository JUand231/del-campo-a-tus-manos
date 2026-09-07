/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/routes/productRoutes.js
 * ==========================================================
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validateProduct, sanitizeBody } = require('../middleware/validation');

// Rutas públicas (RF-03)
router.get('/', productController.getCatalog);
router.get('/categorias', productController.getCategories);

// Rutas protegidas para Productores (RF-02)
router.get('/mis-productos', authenticateToken, requireRole(['PRODUCTOR']), productController.getMyProducts);
router.post('/', authenticateToken, requireRole(['PRODUCTOR']), sanitizeBody, validateProduct, productController.createProduct);
router.put('/:id', authenticateToken, requireRole(['PRODUCTOR', 'ADMIN']), sanitizeBody, productController.updateProduct);
router.delete('/:id', authenticateToken, requireRole(['PRODUCTOR', 'ADMIN']), productController.deleteProduct);

// Detalle de producto por ID
router.get('/:id', productController.getProductById);

module.exports = router;
