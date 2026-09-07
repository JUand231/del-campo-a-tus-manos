-- ==========================================================
-- PROYECTO: Del Campo a Tus Manos
-- ARCHIVO: V2__seed_data.sql
-- DESCRIPCIÓN: Datos semilla iniciales (Roles, Usuarios, Categorías, Productos y Pedidos)
-- MOTOR: MySQL 8+ / utf8mb4
-- Contraseña para todos los usuarios semilla: Password123!
-- Hash bcrypt: $2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6
-- ==========================================================

-- 1. Insertar Roles
INSERT INTO rol (id, nombre) VALUES
(1, 'ADMIN'),
(2, 'PRODUCTOR'),
(3, 'COMPRADOR')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- 2. Insertar Usuarios
-- 1: Administrador General (RF-08, RF-09)
-- 2: Don Carlos Mendoza (Productor Boyacá)
-- 3: Doña Martha Gómez (Productora Cundinamarca)
-- 4: Laura Morales (Compradora Bogotá)
-- 5: Usuario Bloqueado Demo (RF-08: activo = 0)
INSERT INTO usuario (id, rol_id, nombre, email, password_hash, telefono, municipio, activo) VALUES
(1, 1, 'Administrador del Sistema', 'admin@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 310 000 0001', 'Bogotá D.C.', 1),
(2, 2, 'Don Carlos Mendoza - Finca Bella Vista', 'carlos.campesino@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 311 456 7890', 'Boyacá - Tibasosa', 1),
(3, 2, 'Doña Martha Gómez - Granja La Esperanza', 'martha.agricola@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 312 987 6543', 'Cundinamarca - Fusagasugá', 1),
(4, 3, 'Laura Morales', 'comprador@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 320 111 2233', 'Bogotá D.C.', 1),
(5, 3, 'Usuario Inactivo Demo', 'bloqueado@campo.com', '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', '+57 300 999 8877', 'Antioquia - Medellín', 0)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), activo=VALUES(activo);

-- 3. Insertar Categorías Agrícolas
INSERT INTO categoria (id, nombre, descripcion, icono) VALUES
(1, 'Hortalizas y Verduras', 'Cosechas frescas de la huerta tradicional campesina', 'eco'),
(2, 'Frutas Frescas', 'Frutas tropicales y de clima frío recolectadas al punto de maduración', 'nutrition'),
(3, 'Tubérculos y Plátanos', 'Papas nativas, yuca campesina y plátanos seleccionados', 'agriculture'),
(4, 'Granos y Legumbres', 'Frijol bola roja, arveja verde y maíz criollo seleccionado', 'grain')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- 4. Insertar Productos en Catálogo (RF-02, RF-03)
-- Productos con fotos reales y datos agronómicos basados en Stitch mockups
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

-- 5. Insertar Pedidos Semilla de Demostración (RF-04, RF-05, RF-06)
INSERT INTO pedido (id, comprador_id, estado, total, direccion_entrega, telefono_contacto, notas, created_at) VALUES
(1, 4, 'Pendiente', 11400.00, 'Calle 127 # 45-20, Apto 502, Bogotá', '+57 320 111 2233', 'Por favor entregar en portería en horario de la mañana.', NOW() - INTERVAL 2 HOUR),
(2, 4, 'En Proceso', 13500.00, 'Carrera 7 # 72-10, Oficina 301, Bogotá', '+57 320 111 2233', 'Cosecha lista para despacho desde finca Bella Vista.', NOW() - INTERVAL 1 DAY),
(3, 4, 'Entregado', 14400.00, 'Calle 127 # 45-20, Apto 502, Bogotá', '+57 320 111 2233', 'Pedido recibido a satisfacción en excelentes condiciones.', NOW() - INTERVAL 3 DAY)
ON DUPLICATE KEY UPDATE estado=VALUES(estado), total=VALUES(total);

-- 6. Insertar Detalles de los Pedidos Semilla
INSERT INTO detalle_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 3.00, 3800.00, 11400.00), -- 3 Kg Tomate Chonto
(2, 2, 2, 3.00, 4500.00, 13500.00), -- 3 Kg Papa Criolla
(3, 3, 3, 2.00, 7200.00, 14400.00)  -- 2 Kg Aguacate Hass
ON DUPLICATE KEY UPDATE subtotal=VALUES(subtotal);
