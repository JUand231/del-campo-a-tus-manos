/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/services/emailService.js
 * DESCRIPCIÓN: Servicio de correos asíncronos reales con Nodemailer (RF-07 y Recuperación OTP)
 * ==========================================================
 */

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}

const db = require('../database/db');

const logger = require('./logger');

/**
 * Obtiene o crea el transporte SMTP de Nodemailer según configuración en .env
 */
function getTransporter() {
    if (!nodemailer) {
        console.warn('[EMAIL WARNING] Nodemailer no está disponible.');
        return null;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Si aún tiene mock_user o no está configurado, no puede enviar correo real
    if (!user || user === 'mock_user' || !pass || pass === 'mock_pass') {
        console.warn(`[EMAIL AVISO] En el archivo backend/.env todavía está puesto SMTP_USER='${user}'. Guarda tus credenciales reales de Gmail en backend/.env y reinicia con 'npm start'.`);
        return null;
    }

    const isGmail = host.includes('gmail');
    return nodemailer.createTransport({
        ...(isGmail ? { service: 'gmail' } : { host, port, secure: port === 465 }),
        auth: {
            user,
            pass
        },
        tls: {
            rejectUnauthorized: true
        }
    });
}

/**
 * Envía notificación por correo de cambio de estado de pedido (RF-07)
 */
function sendOrderStatusNotificationAsync({ to, nombreComprador, pedidoId, nuevoEstado, total }) {
    setImmediate(async () => {
        try {
            const timestamp = new Date().toISOString();
            console.log(`[EMAIL SERVICE - ASYNC ${timestamp}] Iniciando envío de notificación de pedido...`);
            console.log(`[EMAIL INFO] Destinatario: ${to} | Pedido: #DCM-${pedidoId} | Nuevo Estado: '${nuevoEstado}'`);

            const transporter = getTransporter();
            if (transporter) {
                const fromAddress = process.env.SMTP_FROM || `"Del Campo a Tus Manos" <${process.env.SMTP_USER}>`;
                await transporter.sendMail({
                    from: fromAddress,
                    to,
                    subject: `🌾 Actualización de tu Pedido #DCM-${pedidoId} - Del Campo a Tus Manos`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                            <div style="background-color: #2F6F4E; padding: 20px; text-align: center; color: white;">
                                <h2 style="margin: 0;">🌾 Del Campo a Tus Manos</h2>
                            </div>
                            <div style="padding: 24px;">
                                <h3>Hola ${nombreComprador},</h3>
                                <p>Te informamos que tu pedido <strong>#DCM-${pedidoId}</strong> ha cambiado de estado a:</p>
                                <div style="background-color: #F4F8F5; border-left: 4px solid #2F6F4E; padding: 12px; font-size: 16px; font-weight: bold; color: #2F6F4E; margin: 16px 0;">
                                    ${nuevoEstado}
                                </div>
                                <p>Total del pedido: <strong>$${Number(total).toLocaleString('es-CO')} COP</strong></p>
                            </div>
                        </div>
                    `
                });
                console.log(`[EMAIL SUCCESS REAL] Notificación de pedido enviada a ${to}`);
            } else {
                console.log(`[EMAIL LOG] Notificación de pedido procesada para ${to} (Estado: ${nuevoEstado})`);
            }
        } catch (error) {
            logger.error(`[EMAIL ERROR AUDIT] Fallo en el envío de correo para pedido #${pedidoId}: ${error.message}`);
        }
    });
}

/**
 * Envía notificación por correo de mensaje nuevo en un pedido (RF-10, extiende RF-07)
 */
function sendNewMessageNotificationAsync({ to, nombreDestinatario, autorNombre, pedidoId, mensaje }) {
    setImmediate(async () => {
        try {
            const timestamp = new Date().toISOString();
            console.log(`[EMAIL SERVICE - ASYNC ${timestamp}] Nuevo mensaje en pedido...`);
            console.log(`[EMAIL INFO] Destinatario: ${to} | Pedido: #DCM-${pedidoId} | De: '${autorNombre}'`);

            const preview = String(mensaje || '').slice(0, 140);
            const transporter = getTransporter();
            if (transporter) {
                const fromAddress = process.env.SMTP_FROM || `"Del Campo a Tus Manos" <${process.env.SMTP_USER}>`;
                await transporter.sendMail({
                    from: fromAddress,
                    to,
                    subject: `💬 Nuevo mensaje en tu Pedido #DCM-${pedidoId} - Del Campo a Tus Manos`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                            <div style="background-color: #2F6F4E; padding: 20px; text-align: center; color: white;">
                                <h2 style="margin: 0;">🌾 Del Campo a Tus Manos</h2>
                            </div>
                            <div style="padding: 24px;">
                                <h3>Hola ${nombreDestinatario},</h3>
                                <p><strong>${autorNombre}</strong> te escribió en el pedido <strong>#DCM-${pedidoId}</strong>:</p>
                                <div style="background-color: #F4F8F5; border-left: 4px solid #2F6F4E; padding: 12px; font-size: 14px; color: #1f2937; margin: 16px 0;">
                                    ${preview}
                                </div>
                                <p>Ingresa a la plataforma para responder.</p>
                            </div>
                        </div>
                    `
                });
                console.log(`[EMAIL SUCCESS REAL] Mensaje notificado a ${to}`);
            } else {
                console.log(`[EMAIL LOG] Mensaje notificado a ${to} (Pedido: ${pedidoId})`);
            }
        } catch (error) {
            console.error(`[EMAIL ERROR AUDIT] Fallo notificando mensaje del pedido #${pedidoId}:`, error.message);
        }
    });
}

/**
 * Resuelve al otro participante del pedido y le notifica (fire-and-forget).
 * Nunca lanza: un fallo aquí jamás bloquea ni revierte el 201 del mensaje.
 */
async function notifyOrderMessageAsync({ pedidoId, autorId, autorNombre, texto }) {
    try {
        const buyerRows = await db.query(
            'SELECT u.id, u.email, u.nombre FROM usuario u JOIN pedido p ON p.comprador_id = u.id WHERE p.id = ?',
            [pedidoId]
        );
        const producerRows = await db.query(
            `SELECT DISTINCT u.email, u.nombre FROM usuario u
             JOIN producto pr ON pr.productor_id = u.id
             JOIN detalle_pedido dp ON dp.producto_id = pr.id
             WHERE dp.pedido_id = ?`,
            [pedidoId]
        );
        const buyer = buyerRows && buyerRows[0];
        const recipients = (buyer && Number(buyer.id) === Number(autorId))
            ? producerRows
            : (buyer ? [buyer] : []);

        for (const r of recipients) {
            sendNewMessageNotificationAsync({
                to: r.email,
                nombreDestinatario: r.nombre,
                autorNombre: autorNombre || 'Tu contacto',
                pedidoId,
                mensaje: texto
            });
        }
    } catch (error) {
        console.error(`[EMAIL ERROR AUDIT] Fallo resolviendo destinatarios del pedido #${pedidoId}:`, error.message);
    }
}
function sendPasswordResetOtpAsync({ to, nombre, otp }) {
    setImmediate(async () => {
        console.log(`[EMAIL OTP] Enviando código de verificación a ${to}...`);

        const transporter = getTransporter();
        if (transporter) {
            try {
                const fromAddress = process.env.SMTP_FROM || `"Del Campo a Tus Manos" <${process.env.SMTP_USER}>`;
                await transporter.sendMail({
                    from: fromAddress,
                    to,
                    subject: '🌾 Tu Código de Seguridad OTP - Del Campo a Tus Manos',
                    text: `Hola ${nombre},\n\nTu código OTP de verificación para restablecer tu contraseña es: ${otp}\n\nEste código vence en 10 minutos.\n\nPlataforma Del Campo a Tus Manos.`,
                    html: `
                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                            <div style="background-color: #2F6F4E; padding: 28px 24px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">🌾 Del Campo a Tus Manos</h1>
                                <p style="color: #E8F5E9; margin: 6px 0 0 0; font-size: 13px;">Conexión directa del campo colombiano a tu mesa</p>
                            </div>
                            
                            <div style="padding: 32px 24px; text-align: center;">
                                <h2 style="color: #1f2937; margin: 0 0 12px 0; font-size: 19px;">Código de Verificación</h2>
                                <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                                    Hola <strong>${nombre}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa este código de verificación de 6 dígitos:
                                </p>
                                
                                <div style="background: #F4F8F5; border: 2px dashed #2F6F4E; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 0 auto 24px auto;">
                                    <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2F6F4E;">
                                        ${otp}
                                    </span>
                                </div>
                                
                                <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0 0 20px 0;">
                                    ⏳ Este código es válido por <strong>10 minutos</strong>.<br>
                                    Si no solicitaste este cambio, ignora este mensaje.
                                </p>
                            </div>
                            
                            <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                                    Seguridad Del Campo a Tus Manos — SENA ADSO
                                </p>
                            </div>
                        </div>
                    `
                });
                console.log(`[EMAIL SUCCESS] Correo OTP entregado satisfactoriamente a ${to}`);
            } catch (smtpErr) {
                logger.error(`[EMAIL ERROR] Fallo enviando correo a ${to}: ${smtpErr.message}`);
            }
        }
    });
}

module.exports = {
    sendOrderStatusNotificationAsync,
    sendPasswordResetOtpAsync,
    sendNewMessageNotificationAsync,
    notifyOrderMessageAsync
};
