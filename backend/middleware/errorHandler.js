/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/middleware/errorHandler.js
 * DESCRIPCIÓN: Enmascaramiento de errores y logging seguro (RULES.md: ERR-MASK/LOG-SEC)
 * ==========================================================
 */

const logger = require('../services/logger');

function errorHandler(err, req, res, next) {
    const timestamp = new Date().toISOString();
    logger.error(`[${req.method} ${req.url}] ${err.message}`);
    if (process.env.NODE_ENV !== 'production' && err.stack) {
        logger.error(err.stack);
    }

    // Código de estado por defecto 500
    const statusCode = err.statusCode || 500;
    
    // Mensaje enmascarado para producción (sin detalles de infraestructura)
    let clientMessage = 'Ha ocurrido un error interno en el servidor. Por favor intenta más tarde.';
    if (statusCode < 500 || process.env.NODE_ENV !== 'production') {
        clientMessage = err.message || clientMessage;
    }

    res.status(statusCode).json({
        success: false,
        message: clientMessage,
        timestamp
    });
}

module.exports = {
    errorHandler
};
