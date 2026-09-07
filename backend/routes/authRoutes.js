/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/routes/authRoutes.js
 * ==========================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin, sanitizeBody } = require('../middleware/validation');
const { rateLimiter } = require('../middleware/rateLimiter');

// Rate limiting específico en autenticación (RULES.md: RATE-LIMIT/DDOS)
const authLimiter = rateLimiter({ windowMs: 60000, maxRequests: 15, message: 'Demasiados intentos de acceso. Intenta en 1 minuto.' });

router.post('/registro', sanitizeBody, validateRegister, authController.register);
router.post('/login', authLimiter, sanitizeBody, validateLogin, authController.login);
router.post('/logout', authController.logout); // D5: invalida la cookie HttpOnly (sin auth: limpieza siempre disponible)
router.get('/perfil', authenticateToken, authController.getProfile);

// Recuperación de Contraseña con OTP
router.post('/solicitar-otp', authLimiter, sanitizeBody, authController.solicitarOtp);
router.post('/reset-password-otp', authLimiter, sanitizeBody, authController.resetPasswordOtp);

module.exports = router;

