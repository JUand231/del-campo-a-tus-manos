/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/middleware/rbac.js
 * DESCRIPCIÓN: Control de acceso basado en roles (RBAC) (TRD §3, RF-08, RF-09)
 * SEGURIDAD: Bloquea rutas protegidas para roles no autorizados.
 * ==========================================================
 */

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado. Debes iniciar sesión para realizar esta acción.'
            });
        }

        const userRole = String(req.user.rol_nombre).toUpperCase();
        const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());

        if (!normalizedAllowed.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`
            });
        }

        next();
    };
}

module.exports = {
    requireRole
};
