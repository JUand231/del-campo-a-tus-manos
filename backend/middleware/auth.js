/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/middleware/auth.js
 * DESCRIPCIÓN: Autenticación con JWT (RF-01, RF-08)
 * SEGURIDAD: Verifica firma de token y estado 'activo' del usuario.
 * ==========================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../database/db');

// Secreto público de ejemplo: NUNCA usar en producción (ver guardia fail-fast abajo).
const PUBLIC_DEFAULT_SECRET = 'super_secret_jwt_del_campo_a_tus_manos_2026_adso_agro_key!';
const JWT_SECRET = process.env.JWT_SECRET || PUBLIC_DEFAULT_SECRET;

// Fail-fast de seguridad (bloqueador D1): en producción el servidor se niega
// a arrancar sin un JWT_SECRET propio de al menos 32 caracteres.
if (process.env.NODE_ENV === 'production') {
    const configured = process.env.JWT_SECRET || '';
    if (!configured || configured.length < 32 || configured === PUBLIC_DEFAULT_SECRET) {
        throw new Error('SEGURIDAD CRÍTICA: define JWT_SECRET con un valor aleatorio de al menos 32 caracteres en el .env de producción. Arranque abortado.');
    }
}

async function authenticateToken(req, res, next) {
    let token = null;

    // Buscar en header Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.dcm_token) {
        token = req.cookies.dcm_token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Acceso no autorizado. Se requiere iniciar sesión.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verificar que el usuario continúe activo en la base de datos (RF-08)
        const users = await db.query('SELECT id, rol_id, nombre, email, activo FROM usuario WHERE id = ?', [decoded.id]);
        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'La cuenta asociada al token ya no existe.'
            });
        }

        const user = users[0];
        if (Number(user.activo) === 0) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido desactivada por el administrador. Contacta a soporte.'
            });
        }

        req.user = {
            id: user.id,
            rol_id: user.rol_id,
            rol_nombre: decoded.rol_nombre,
            nombre: user.nombre,
            email: user.email
        };

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Sesión expirada o token inválido. Por favor ingresa nuevamente.'
        });
    }
}

// Middleware opcional para visitantes: si hay token lo decodifica, si no, continúa como visitante
async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.dcm_token) {
        token = req.cookies.dcm_token;
    }
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const users = await db.query('SELECT id, rol_id, nombre, email, activo FROM usuario WHERE id = ?', [decoded.id]);
            if (users && users.length > 0 && Number(users[0].activo) === 1) {
                req.user = {
                    id: users[0].id,
                    rol_id: users[0].rol_id,
                    rol_nombre: decoded.rol_nombre,
                    nombre: users[0].nombre,
                    email: users[0].email
                };
            }
        } catch (e) {
            // Se ignora token inválido en modo opcional
        }
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    JWT_SECRET
};
