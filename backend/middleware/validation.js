/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/middleware/validation.js
 * DESCRIPCIÓN: Sanitización y validación estricta de inputs (RULES.md: INPUT-VAL/SANITIZE)
 * ==========================================================
 */

/**
 * Sanitiza una cadena eliminando etiquetas HTML y caracteres de inyección
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '');
}

/**
 * Middleware para sanitizar recursivamente todo req.body
 */
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        }
    }
    next();
}

/**
 * Validador para registro de usuario (RF-01)
 */
function validateRegister(req, res, next) {
    const { nombre, email, password, rol_id } = req.body;

    if (!nombre || nombre.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: 'El nombre completo es obligatorio y debe contener al menos 3 caracteres.'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({
            success: false,
            message: 'Por favor ingresa un correo electrónico válido.'
        });
    }

    if (!password || password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'La contraseña es obligatoria y debe tener como mínimo 6 caracteres.'
        });
    }

    const rolNum = Number(rol_id);
    if (![2, 3].includes(rolNum)) { // 2: Productor, 3: Comprador (Admin no se auto-registra)
        return res.status(400).json({
            success: false,
            message: 'El rol seleccionado no es válido. Debe ser Productor o Comprador.'
        });
    }

    next();
}

/**
 * Validador para inicio de sesión (RF-01)
 */
function validateLogin(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Debes proporcionar tu correo y contraseña.'
        });
    }

    next();
}

/**
 * Validador para publicación de producto (RF-02)
 */
function validateProduct(req, res, next) {
    const { nombre, precio, cantidad_disponible, categoria_id, municipio } = req.body;

    if (!nombre || nombre.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: 'El nombre del producto es obligatorio (mínimo 3 letras).'
        });
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum <= 0) {
        return res.status(400).json({
            success: false,
            message: 'El precio debe ser un valor numérico mayor a cero.'
        });
    }

    const stockNum = parseFloat(cantidad_disponible);
    if (isNaN(stockNum) || stockNum <= 0) {
        return res.status(400).json({
            success: false,
            message: 'La cantidad disponible (stock) debe ser mayor a cero para publicar.'
        });
    }

    if (!categoria_id || isNaN(Number(categoria_id))) {
        return res.status(400).json({
            success: false,
            message: 'Debes seleccionar una categoría válida.'
        });
    }

    if (!municipio || municipio.trim().length < 2) {
        return res.status(400).json({
            success: false,
            message: 'El municipio o departamento de origen es obligatorio.'
        });
    }

    next();
}

/**
 * Validador para creación de pedido (RF-04)
 */
function validateOrder(req, res, next) {
    const { direccion_entrega, telefono_contacto, items } = req.body;

    if (!direccion_entrega || direccion_entrega.trim().length < 5) {
        return res.status(400).json({
            success: false,
            message: 'La dirección de entrega es obligatoria (mínimo 5 caracteres).'
        });
    }

    if (!telefono_contacto || telefono_contacto.trim().length < 7) {
        return res.status(400).json({
            success: false,
            message: 'El teléfono de contacto es obligatorio (mínimo 7 dígitos).'
        });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'El pedido debe contener al menos un producto.'
        });
    }

    for (const item of items) {
        const cant = parseFloat(item.cantidad);
        if (isNaN(cant) || cant <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La cantidad solicitada de cada producto debe ser mayor a cero.'
            });
        }
    }

    next();
}

module.exports = {
    sanitizeBody,
    validateRegister,
    validateLogin,
    validateProduct,
    validateOrder
};
