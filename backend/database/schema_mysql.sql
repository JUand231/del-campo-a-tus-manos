-- ==========================================================
-- PROYECTO: Del Campo a Tus Manos
-- ARCHIVO CONSOLIDADO: schema_mysql.sql
-- DESCRIPCIÓN: Creación completa de base de datos, tablas y datos semilla
-- MOTOR: MySQL 8+ / InnoDB / utf8mb4
-- ==========================================================

CREATE DATABASE IF NOT EXISTS del_campo_a_tus_manos 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE del_campo_a_tus_manos;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabla de Roles (RBAC)
DROP TABLE IF EXISTS rol;
CREATE TABLE rol (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Usuarios (RF-01, RF-08)
DROP TABLE IF EXISTS usuario;
CREATE TABLE usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(30) NULL,
    municipio VARCHAR(100) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_usuario_rol ON usuario(rol_id);

-- 3. Tabla de Categorías (RF-03)
DROP TABLE IF EXISTS categoria;
CREATE TABLE categoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NULL,
    icono VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Productos (RF-02, RF-03, RF-04)
DROP TABLE IF EXISTS producto;
CREATE TABLE producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    productor_id INT NOT NULL,
    categoria_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(12,2) NOT NULL,
    cantidad_disponible DECIMAL(12,2) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL DEFAULT 'Kg',
    foto_url TEXT NULL,
    municipio VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto_productor FOREIGN KEY (productor_id) REFERENCES usuario (id) ON DELETE CASCADE,
    CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id) ON DELETE RESTRICT,
    CONSTRAINT chk_producto_precio CHECK (precio > 0),
    CONSTRAINT chk_producto_stock CHECK (cantidad_disponible >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_producto_categoria ON producto(categoria_id);
CREATE INDEX idx_producto_productor ON producto(productor_id);
CREATE INDEX idx_producto_stock ON producto(cantidad_disponible);

-- 5. Tabla de Pedidos (RF-04, RF-05, RF-06)
DROP TABLE IF EXISTS pedido;
CREATE TABLE pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comprador_id INT NOT NULL,
    estado ENUM('Pendiente', 'En Proceso', 'Entregado', 'Cancelado') NOT NULL DEFAULT 'Pendiente',
    total DECIMAL(12,2) NOT NULL,
    direccion_entrega VARCHAR(255) NOT NULL,
    telefono_contacto VARCHAR(30) NOT NULL,
    notas TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pedido_comprador FOREIGN KEY (comprador_id) REFERENCES usuario (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pedido_comprador ON pedido(comprador_id);
CREATE INDEX idx_pedido_estado ON pedido(estado);
CREATE INDEX idx_pedido_created_at ON pedido(created_at);

-- 6. Tabla de Detalles de Pedido (RF-04)
DROP TABLE IF EXISTS detalle_pedido;
CREATE TABLE detalle_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE RESTRICT,
    CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_detalle_pedido ON detalle_pedido(pedido_id);
CREATE INDEX idx_detalle_producto ON detalle_pedido(producto_id);

-- 7. Tabla de OTP de recuperación (D11: hasheado, expira en 10 min)
CREATE TABLE IF NOT EXISTS password_reset_otp (
    email VARCHAR(150) NOT NULL PRIMARY KEY,
    otp_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_usuario FOREIGN KEY (email) REFERENCES usuario (email) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================================
-- INSERCIÓN DE DATOS INICIALES (V2__seed_data)
-- ==========================================================

-- Roles
INSERT INTO rol (id, nombre) VALUES
(1, 'ADMIN'),
(2, 'PRODUCTOR'),
(3, 'COMPRADOR')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- Usuarios (Clave para todos: Password123!)
INSERT INTO usuario (id, rol_id, nombre, email, password_hash, telefono, municipio, activo) VALUES
(1, 1, 'Administrador del Sistema', 'admin@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 310 000 0001', 'Bogotá D.C.', 1),
(2, 2, 'Don Carlos Mendoza - Finca Bella Vista', 'carlos.campesino@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 311 456 7890', 'Boyacá - Tibasosa', 1),
(3, 2, 'Doña Martha Gómez - Granja La Esperanza', 'martha.agricola@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 312 987 6543', 'Cundinamarca - Fusagasugá', 1),
(4, 3, 'Laura Morales', 'comprador@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 320 111 2233', 'Bogotá D.C.', 1),
(5, 3, 'Usuario Inactivo Demo', 'bloqueado@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 300 999 8877', 'Antioquia - Medellín', 0)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo);

-- Categorías
INSERT INTO categoria (id, nombre, descripcion, icono) VALUES
(1, 'Hortalizas y Verduras', 'Cosechas frescas de la huerta tradicional campesina', 'eco'),
(2, 'Frutas Frescas', 'Frutas tropicales y de clima frío recolectadas al punto de maduración', 'nutrition'),
(3, 'Tubérculos y Plátanos', 'Papas nativas, yuca campesina y plátanos seleccionados', 'agriculture'),
(4, 'Granos y Legumbres', 'Frijol bola roja, arveja verde y maíz criollo seleccionado', 'grain')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- Productos
INSERT INTO producto (id, productor_id, categoria_id, nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, municipio, version) VALUES
(1, 2, 1, 'Tomate Chonto Orgánico de Finca', 'Cultivado con abono orgánico en las laderas de Tibasosa. Cosechado a mano en horas de la mañana, ideal para ensaladas y guisos con sabor natural de campo.', 3800.00, 120.00, 'Kg', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80', 'Boyacá - Tibasosa', 0),
(2, 2, 3, 'Papa Criolla Lavada de Páramo', 'Papa criolla dorada y limpia, textura cremosa para caldos y fritos tradicionales. Selección premium sin tierra excesiva.', 4500.00, 250.00, 'Kg', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80', 'Boyacá - Tibasosa', 0),
(3, 3, 2, 'Aguacate Hass de Exportación', 'Aguacate cultivado en el clima templado de Fusagasugá. Punto exacto de maduración, pulpa mantecosa y rica en aceites saludables.', 7200.00, 80.00, 'Kg', 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=800&q=80', 'Cundinamarca - Fusagasugá', 0),
(4, 3, 2, 'Fresas Dulces de Altura', 'Fresas frescas cosechadas en canastilla de 500g, aroma intenso y sabor balanceado. Libres de químicos agresivos.', 6000.00, 45.00, 'Canastilla (500g)', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=800&q=80', 'Cundinamarca - Fusagasugá', 0),
(5, 2, 1, 'Zanahoria Tierna de Huerta', 'Zanahoria crujiente recién arrancada, rica en betacarotenos. Tamaño mediano parejo, hojas verdes frescas.', 2800.00, 150.00, 'Kg', 'https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=800&q=80', 'Boyacá - Tibasosa', 0),
(6, 3, 3, 'Plátano Hartón Maduro', 'Plátano hartón seleccionado para hornear o freír. Maduración natural bajo el sol cálido de la provincia del Sumapaz.', 3500.00, 90.00, 'Kg', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80', 'Cundinamarca - Fusagasugá', 0),
(7, 2, 4, 'Frijol Bola Roja Seleccionado', 'Grano seco seleccionado, cosecha reciente de cocción suave y caldo espeso. Calidad garantizada por familias campesinas.', 8500.00, 60.00, 'Kg', 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=800&q=80', 'Boyacá - Tibasosa', 0),
(8, 2, 1, 'Cilantro Cimarrón de Huerta (Agotado Demo)', 'Manojo de hierba aromática tradicional. Se incluye con stock 0 para validar que RF-03 excluye productos sin disponibilidad del catálogo público.', 1500.00, 0.00, 'Atado', 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80', 'Boyacá - Tibasosa', 0)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), precio=VALUES(precio), cantidad_disponible=VALUES(cantidad_disponible);

-- Pedidos iniciales
INSERT INTO pedido (id, comprador_id, estado, total, direccion_entrega, telefono_contacto, notas, created_at) VALUES
(1, 4, 'Pendiente', 11400.00, 'Calle 127 # 45-20, Apto 502, Bogotá', '+57 320 111 2233', 'Por favor entregar en portería en horario de la mañana.', NOW() - INTERVAL 2 HOUR),
(2, 4, 'En Proceso', 13500.00, 'Carrera 7 # 72-10, Oficina 301, Bogotá', '+57 320 111 2233', 'Cosecha lista para despacho desde finca Bella Vista.', NOW() - INTERVAL 1 DAY),
(3, 4, 'Entregado', 14400.00, 'Calle 127 # 45-20, Apto 502, Bogotá', '+57 320 111 2233', 'Pedido recibido a satisfacción en excelentes condiciones.', NOW() - INTERVAL 3 DAY)
ON DUPLICATE KEY UPDATE estado=VALUES(estado), total=VALUES(total);

-- Detalles de pedido
INSERT INTO detalle_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 3.00, 3800.00, 11400.00),
(2, 2, 2, 3.00, 4500.00, 13500.00),
(3, 3, 3, 2.00, 7200.00, 14400.00)
ON DUPLICATE KEY UPDATE subtotal=VALUES(subtotal);
