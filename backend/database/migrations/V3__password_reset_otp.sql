-- ==========================================================
-- PROYECTO: Del Campo a Tus Manos
-- ARCHIVO: V3__password_reset_otp.sql
-- DESCRIPCIÓN: Tabla de códigos OTP de recuperación (D11).
-- Los códigos se guardan hasheados (SHA-256), con expiración de
-- 10 minutos y contador de intentos. No se modifica V1/V2.
-- ==========================================================

CREATE TABLE IF NOT EXISTS password_reset_otp (
    email VARCHAR(150) NOT NULL PRIMARY KEY,
    otp_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_usuario FOREIGN KEY (email) REFERENCES usuario (email) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
