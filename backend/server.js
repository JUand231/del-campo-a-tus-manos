/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/server.js
 * DESCRIPCIÓN: Servidor principal Express con seguridad OWASP Top 10
 * ==========================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./database/db');
const { errorHandler } = require('./middleware/errorHandler');

// Rutas
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
// Higiene de cabeceras (D6): no anunciar la tecnología del servidor.
app.disable('x-powered-by');
// D9: tras Nginx, req.ip es el cliente real (Nginx debe sobrescribir X-Forwarded-For).
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// 1. Cabeceras de Seguridad HTTP (RULES.md: CSP-HEADERS, X-Frame-Options, etc.)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: https: blob:; " +
        "connect-src 'self' http://localhost:* http://127.0.0.1:*;"
    );
    // D10: HSTS solo en producción (tras el proxy TLS; ver runbook en README §5).
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// 2. Política CORS restrictiva (RULES.md: CORS-POL/ORIGIN, D6):
// solo orígenes exactos listados en CORS_ORIGIN. Sin comodines ni excepciones por prefijo.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
app.use(cors({
    origin: function (origin, callback) {
        // Sin cabecera Origin (curl/apps móviles): se permite; es el navegador quien aplica CORS.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por política CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// 3. Parsers de JSON y URL encoded
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// D5: necesario para leer la cookie de sesión HttpOnly en authenticateToken.
app.use(cookieParser());

// 4. Servir archivos estáticos del Frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// 5. Endpoint de Salud del Sistema
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        app: 'Del Campo a Tus Manos',
        database: db.isMySQLConnected() ? 'MySQL 8+ (Conectado)' : 'Fallback Store (Memoria)',
        timestamp: new Date().toISOString()
    });
});

// 6. Registro de Rutas de la API REST
app.use('/api/auth', authRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/admin', adminRoutes);

// 7. Rutas Legales e Institucionales (RULES.md: GDPR/RGPD, T&C, FAQ)
app.get('/privacy', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// 8. Fallback SPA para navegación en cliente
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: `El endpoint '${req.path}' no existe en esta API.`
        });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// 9. Manejador global de errores (RULES.md: ERR-MASK/LOG-SEC)
app.use(errorHandler);

// 10. Arranque del servidor e inicialización de la Base de Datos
async function startServer() {
    await db.initDatabase();
    app.listen(PORT, () => {
        console.log('==========================================================');
        console.log(`🌾 DEL CAMPO A TUS MANOS - SERVIDOR INICIADO EN EL PUERTO ${PORT}`);
        console.log(`🌍 URL Local: http://localhost:${PORT}`);
        console.log(`🛡️  Seguridad OWASP Top 10 activa: Bcrypt, RBAC, Rate Limiting, CSP`);
        console.log(`📦 Base de Datos: ${db.isMySQLConnected() ? 'MySQL 8+ Conectado' : 'Modo Resiliente (Memoria)'}`);
        console.log('==========================================================');
    });
}

startServer();

module.exports = app;
