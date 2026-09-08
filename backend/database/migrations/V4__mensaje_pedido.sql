-- ==========================================================
-- PROYECTO: Del Campo a Tus Manos
-- ARCHIVO: V4__mensaje_pedido.sql
-- DESCRIPCIÓN: Hilo de mensajes por pedido (RF-10, Fase 2).
-- Solo participantes (regla aplicada en backend). ADMIN: solo lectura.
-- Texto 1–1000 caracteres (CHECK + validación backend).
-- ==========================================================

CREATE TABLE IF NOT EXISTS mensaje_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    autor_id INT NOT NULL,
    mensaje TEXT NOT NULL,
    leido TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mensaje_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE,
    CONSTRAINT fk_mensaje_autor FOREIGN KEY (autor_id) REFERENCES usuario (id) ON DELETE CASCADE,
    CONSTRAINT chk_mensaje_longitud CHECK (CHAR_LENGTH(mensaje) BETWEEN 1 AND 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_mensaje_pedido ON mensaje_pedido(pedido_id);
CREATE INDEX idx_mensaje_autor ON mensaje_pedido(autor_id);
CREATE INDEX idx_mensaje_no_leidos ON mensaje_pedido(pedido_id, autor_id, leido);
