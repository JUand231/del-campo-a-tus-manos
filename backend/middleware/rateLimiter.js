/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/middleware/rateLimiter.js
 * DESCRIPCIÓN: Rate limiting en memoria (RULES.md: RATE-LIMIT/DDOS)
 * Endpoints críticos: /api/auth/login, /api/pedidos
 * ==========================================================
 */

const requestCounts = new Map();

// Limpieza periódica de ventanas expiradas (D9): evita crecimiento sin cota del Map.
// .unref() para no mantener vivo el proceso por este temporizador.
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts) {
        if (now - record.startTime > record.windowMs) {
            requestCounts.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();

function rateLimiter({ windowMs = 60000, maxRequests = 30, message = 'Demasiadas solicitudes. Por favor espera un momento.' } = {}) {
    return (req, res, next) => {
        // D9: tras un proxy inverso, req.ip es el cliente real solo con 'trust proxy' (ver server.js).
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const key = `${ip}_${req.baseUrl || req.path}`;
        const now = Date.now();

        let record = requestCounts.get(key);
        if (!record || now - record.startTime > windowMs) {
            record = { startTime: now, count: 1, windowMs };
            requestCounts.set(key, record);
            return next();
        }

        record.count += 1;
        if (record.count > maxRequests) {
            return res.status(429).json({
                success: false,
                message: message
            });
        }

        next();
    };
}

module.exports = {
    rateLimiter
};
