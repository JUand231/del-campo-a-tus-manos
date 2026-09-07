/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/controllers/authController.js
 * DESCRIPCIÓN: Controlador de autenticación (RF-01, RF-08)
 * SEGURIDAD: Bcrypt hashing, protección contra duplicados y usuarios bloqueados.
 * ==========================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendPasswordResetOtpAsync } = require('../services/emailService');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Sesión en cookie HttpOnly (D5): el JWT ya no se expone a JavaScript.
// SameSite=Lax es la protección CSRF: los POST/PUT/DELETE cross-site no llevan
// la cookie, y todos los endpoints que mutan estado usan esos métodos
// (los GET son de solo lectura).
const COOKIE_NAME = 'dcm_token';
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h, igual que JWT_EXPIRES_IN por defecto
function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/'
    });
}

// D11: los códigos OTP viven en la tabla password_reset_otp (BD, con expiración),
// no en memoria: sobreviven reinicios y funcionan con múltiples instancias.


/**
 * Registro de nuevos usuarios (RF-01)
 */
async function register(req, res, next) {
    try {
        const { nombre, email, password, telefono, municipio, rol_id } = req.body;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Verificar si el correo ya existe (Criterio RF-01)
        const existingUsers = await db.query('SELECT id FROM usuario WHERE email = ?', [normalizedEmail]);
        if (existingUsers && existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El correo electrónico ya se encuentra registrado. Por favor inicia sesión o utiliza otro correo.'
            });
        }

        // 2. Hash de contraseña exclusivamente con bcrypt (RULES.md: HASH-CRYPT/BCRYPT)
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Asignar rol (2 = Productor, 3 = Comprador)
        const targetRolId = Number(rol_id) === 2 ? 2 : 3;
        const targetRolName = targetRolId === 2 ? 'PRODUCTOR' : 'COMPRADOR';

        // 4. Insertar nuevo usuario
        const result = await db.query(
            'INSERT INTO usuario (rol_id, nombre, email, password_hash, telefono, municipio, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [targetRolId, nombre.trim(), normalizedEmail, passwordHash, telefono || null, municipio ? municipio.trim() : null, 1]
        );

        const newUserId = result.insertId;

        // 5. Generar token JWT
        const token = jwt.sign(
            { id: newUserId, rol_id: targetRolId, rol_nombre: targetRolName, nombre: nombre.trim(), email: normalizedEmail },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // D5: la sesión viaja en cookie HttpOnly, no en el cuerpo (ya no se expone el token).
        setAuthCookie(res, token);

        return res.status(201).json({
            success: true,
            message: 'Registro completado exitosamente.',
            user: {
                id: newUserId,
                nombre: nombre.trim(),
                email: normalizedEmail,
                rol_id: targetRolId,
                rol_nombre: targetRolName,
                municipio: municipio ? municipio.trim() : null
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Inicio de sesión (RF-01, RF-08)
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Buscar usuario por correo
        const users = await db.query(
            'SELECT u.id, u.rol_id, u.nombre, u.email, u.password_hash, u.activo, u.municipio, r.nombre AS rol_nombre FROM usuario u JOIN rol r ON u.rol_id = r.id WHERE u.email = ?',
            [normalizedEmail]
        );

        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas. Verifica tu correo y contraseña.'
            });
        }

        const user = users[0];

        // 2. Verificar estado de moderación: si está desactivado no puede iniciar sesión (RF-08)
        if (Number(user.activo) === 0) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido desactivada por el administrador del sistema. No es posible iniciar sesión.'
            });
        }

        // 3. Comparar contraseña con bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas. Verifica tu correo y contraseña.'
            });
        }

        // 4. Generar token JWT
        const token = jwt.sign(
            { id: user.id, rol_id: user.rol_id, rol_nombre: user.rol_nombre, nombre: user.nombre, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // D5: la sesión viaja en cookie HttpOnly, no en el cuerpo (ya no se expone el token).
        setAuthCookie(res, token);

        return res.json({
            success: true,
            message: `Bienvenido de nuevo, ${user.nombre}.`,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                rol_id: user.rol_id,
                rol_nombre: user.rol_nombre,
                municipio: user.municipio
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Consulta de perfil autenticado
 */
async function getProfile(req, res, next) {
    try {
        const users = await db.query(
            'SELECT u.id, u.rol_id, u.nombre, u.email, u.telefono, u.municipio, u.activo, r.nombre AS rol_nombre FROM usuario u JOIN rol r ON u.rol_id = r.id WHERE u.id = ?',
            [req.user.id]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        return res.json({
            success: true,
            user: users[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Solicitar código OTP para recuperación de contraseña
 */
async function solicitarOtp(req, res, next) {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es requerido.' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Verificar si el usuario existe
        const users = await db.query('SELECT id, nombre, activo FROM usuario WHERE email = ?', [normalizedEmail]);
        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No existe ninguna cuenta registrada con este correo electrónico.'
            });
        }
        const user = users[0];
        if (Number(user.activo) === 0) {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido desactivada por el administrador. No es posible restablecer la contraseña.'
            });
        }

        // D11: OTP criptográficamente aleatorio, guardado hasheado con expiración de 10 minutos.
        const otp = String(crypto.randomInt(100000, 1000000));
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        await db.query('DELETE FROM password_reset_otp WHERE email = ?', [normalizedEmail]);
        await db.query(
            'INSERT INTO password_reset_otp (email, otp_hash, expires_at, intentos) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0)',
            [normalizedEmail, otpHash]
        );
        // Higiene oportunista: purgar códigos vencidos.
        await db.query('DELETE FROM password_reset_otp WHERE expires_at < NOW()');

        // 3. Enviar notificación por correo de forma asíncrona
        sendPasswordResetOtpAsync({ to: normalizedEmail, nombre: user.nombre, otp });

        return res.json({
            success: true,
            message: `Código de verificación OTP enviado a ${normalizedEmail}. Revisa tu bandeja de entrada o spam. Válido por 10 minutos.`
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Restablecer contraseña verificando código OTP
 */
async function resetPasswordOtp(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Correo, código OTP y nueva contraseña son obligatorios.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La nueva contraseña debe tener mínimo 6 caracteres.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const rows = await db.query(
            'SELECT email, otp_hash, expires_at, intentos FROM password_reset_otp WHERE email = ?',
            [normalizedEmail]
        );

        if (!rows || rows.length === 0 || new Date(rows[0].expires_at).getTime() < Date.now()) {
            await db.query('DELETE FROM password_reset_otp WHERE email = ?', [normalizedEmail]);
            return res.status(400).json({
                success: false,
                message: 'El código OTP ha expirado o no ha sido solicitado. Por favor solicita uno nuevo.'
            });
        }

        const record = rows[0];
        if (Number(record.intentos) >= 5) {
            await db.query('DELETE FROM password_reset_otp WHERE email = ?', [normalizedEmail]);
            return res.status(429).json({
                success: false,
                message: 'Demasiados intentos erróneos. Por seguridad el código fue invalidado. Solicita uno nuevo.'
            });
        }

        const inputHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
        if (inputHash !== record.otp_hash) {
            await db.query('UPDATE password_reset_otp SET intentos = intentos + 1 WHERE email = ?', [normalizedEmail]);
            const remaining = 5 - (Number(record.intentos) + 1);
            return res.status(400).json({
                success: false,
                message: `El código OTP ingresado es incorrecto. Intentos restantes: ${remaining}.`
            });
        }

        // OTP válido: Generar hash bcrypt y actualizar en base de datos
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE usuario SET password_hash = ? WHERE email = ?', [passwordHash, normalizedEmail]);
        await db.query('DELETE FROM password_reset_otp WHERE email = ?', [normalizedEmail]);

        return res.json({
            success: true,
            message: '¡Contraseña actualizada exitosamente! Ya puedes iniciar sesión con tu nueva clave.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Cierre de sesión (D5): invalida la cookie de sesión en el servidor.
 * No exige token válido para permitir limpieza de sesión siempre.
 */
async function logout(req, res, next) {
    try {
        res.clearCookie(COOKIE_NAME, { path: '/' });
        return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    register,
    login,
    logout,
    getProfile,
    solicitarOtp,
    resetPasswordOtp
};
