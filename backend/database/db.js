/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/database/db.js
 * DESCRIPCIÓN: Capa de persistencia agnóstica con soporte primario
 *              MySQL 8+ (TRD §2) y fallback en memoria/resiliencia.
 * SEGURIDAD: Consultas preparadas parametrizadas (anti SQL Injection).
 * ==========================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool = null;
let isConnectedToMySQL = false;
let fallbackMemoryStore = null;

// Configuración de conexión MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'del_campo_a_tus_manos',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
};

/**
 * Inicialización de la base de datos
 */
async function initDatabase() {
    try {
        console.log(`[DB] Conectando a MySQL (${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database})...`);
        
        // Primero intentamos conectar al servidor sin base de datos para crearla si no existe
        const rootConn = await mysql.createConnection({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await rootConn.end();

        // Creamos el pool conectado a la base de datos
        pool = mysql.createPool(dbConfig);
        
        // Validar conexión
        const [rows] = await pool.query('SELECT 1 + 1 AS test');
        if (rows && rows[0].test === 2) {
            isConnectedToMySQL = true;
            console.log(`[DB] Conexión a MySQL '${dbConfig.database}' establecida con éxito.`);
            await runMigrationsIfEmpty();
        }
    } catch (err) {
        // D8: en producción, operar sin MySQL sería pérdida silenciosa de datos.
        // Se aborta el arranque para que el monitor/supervisor reinicie el servicio.
        if (process.env.NODE_ENV === 'production') {
            console.error(`[DB FATAL] Sin conexión a MySQL en producción (${err.message}). Arranque abortado.`);
            process.exit(1);
        }
        console.warn(`[DB WARNING] No fue posible conectar con MySQL en localhost:3306: ${err.message}`);
        console.warn('[DB INFO] Activando motor de almacenamiento en memoria/resiliente para permitir evaluación sin interrupciones.');
        initFallbackStore();
    }
}

/**
 * Aplica las migraciones V1 y V2 si la base de datos está vacía
 */
async function runMigrationsIfEmpty() {
    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'usuario'");
        if (tables.length === 0) {
            console.log('[DB] Base de datos vacía. Aplicando migraciones V1__init.sql y V2__seed_data.sql...');
            const v1Path = path.join(__dirname, 'migrations', 'V1__init.sql');
            const v2Path = path.join(__dirname, 'migrations', 'V2__seed_data.sql');

            if (fs.existsSync(v1Path)) {
                const sqlV1 = fs.readFileSync(v1Path, 'utf8');
                const statementsV1 = sqlV1.split(';').map(s => s.trim()).filter(s => s.length > 0);
                for (const stmt of statementsV1) {
                    await pool.query(stmt);
                }
                console.log('[DB] Migración V1__init.sql aplicada correctamente.');
            }

            if (fs.existsSync(v2Path)) {
                const sqlV2 = fs.readFileSync(v2Path, 'utf8');
                const statementsV2 = sqlV2.split(';').map(s => s.trim()).filter(s => s.length > 0);
                for (const stmt of statementsV2) {
                    await pool.query(stmt);
                }
                console.log('[DB] Migración V2__seed_data.sql aplicada correctamente.');
            }
        } else {
            console.log('[DB] Tablas existentes detectadas en MySQL. Esquema listo.');
        }

        // Migraciones incrementales (V3, V4, ...): aplicar cada una si su tabla
        // no existe, sin tocar migraciones ya aplicadas.
        const pendingMigrations = [
            { file: 'V3__password_reset_otp.sql', table: 'password_reset_otp' },
            { file: 'V4__mensaje_pedido.sql', table: 'mensaje_pedido' }
        ];
        for (const mig of pendingMigrations) {
            const [existing] = await pool.query(`SHOW TABLES LIKE '${mig.table}'`);
            if (existing.length > 0) continue;
            const migPath = path.join(__dirname, 'migrations', mig.file);
            if (!fs.existsSync(migPath)) continue;
            console.log(`[DB] Aplicando migración ${mig.file}...`);
            const sqlMig = fs.readFileSync(migPath, 'utf8');
            // Las migraciones solo usan comentarios de línea completa (-- ...):
            // se retiran antes de partir por ';' para que un ';' dentro de un
            // comentario no genere fragmentos inválidos.
            const withoutComments = sqlMig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
            const statements = withoutComments.split(';').map(s => s.trim()).filter(s => s.length > 0);
            for (const stmt of statements) {
                await pool.query(stmt);
            }
            console.log(`[DB] Migración ${mig.file} aplicada correctamente.`);
        }
    } catch (migError) {
        console.error('[DB ERROR] Error ejecutando migraciones automáticas:', migError.message);
    }
}

/**
 * Inicializador de datos en memoria para resiliencia en caso de no tener MySQL encendido
 */
function initFallbackStore() {
    fallbackMemoryStore = {
        roles: [
            { id: 1, nombre: 'ADMIN' },
            { id: 2, nombre: 'PRODUCTOR' },
            { id: 3, nombre: 'COMPRADOR' }
        ],
        usuarios: [
            { id: 1, rol_id: 1, nombre: 'Administrador del Sistema', email: 'admin@campo.com', password_hash: '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', telefono: '+57 310 000 0001', municipio: 'Bogotá D.C.', activo: 1, created_at: new Date() },
            { id: 2, rol_id: 2, nombre: 'Don Carlos Mendoza - Finca Bella Vista', email: 'carlos.campesino@campo.com', password_hash: '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', telefono: '+57 311 456 7890', municipio: 'Boyacá - Tibasosa', activo: 1, created_at: new Date() },
            { id: 3, rol_id: 2, nombre: 'Doña Martha Gómez - Granja La Esperanza', email: 'martha.agricola@campo.com', password_hash: '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', telefono: '+57 312 987 6543', municipio: 'Cundinamarca - Fusagasugá', activo: 1, created_at: new Date() },
            { id: 4, rol_id: 3, nombre: 'Laura Morales', email: 'comprador@campo.com', password_hash: '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', telefono: '+57 320 111 2233', municipio: 'Bogotá D.C.', activo: 1, created_at: new Date() },
            { id: 5, rol_id: 3, nombre: 'Usuario Inactivo Demo', email: 'bloqueado@campo.com', password_hash: '$2a$10$cGcQyFqXR19ICTcaRHrnfOoPb4/WTs7f3r9nFt4uXAVitsYXgkgr6', telefono: '+57 300 999 8877', municipio: 'Antioquia - Medellín', activo: 0, created_at: new Date() }
        ],
        categorias: [
            { id: 1, nombre: 'Hortalizas y Verduras', descripcion: 'Cosechas frescas de la huerta tradicional campesina', icono: 'eco' },
            { id: 2, 'nombre': 'Frutas Frescas', descripcion: 'Frutas tropicales y de clima frío recolectadas al punto de maduración', icono: 'nutrition' },
            { id: 3, 'nombre': 'Tubérculos y Plátanos', descripcion: 'Papas nativas, yuca campesina y plátanos seleccionados', icono: 'agriculture' },
            { id: 4, 'nombre': 'Granos y Legumbres', descripcion: 'Frijol bola roja, arveja verde y maíz criollo seleccionado', icono: 'grain' }
        ],
        productos: [
            { id: 1, productor_id: 2, categoria_id: 1, nombre: 'Tomate Chonto Orgánico de Finca', descripcion: 'Cultivado con abono orgánico en las laderas de Tibasosa. Cosechado a mano en horas de la mañana.', precio: 3800.00, cantidad_disponible: 120.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80', municipio: 'Boyacá - Tibasosa', version: 0, created_at: new Date() },
            { id: 2, productor_id: 2, categoria_id: 3, nombre: 'Papa Criolla Lavada de Páramo', descripcion: 'Papa criolla dorada y limpia, textura cremosa para caldos y fritos tradicionales.', precio: 4500.00, cantidad_disponible: 250.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=800&q=80', municipio: 'Boyacá - Tibasosa', version: 0, created_at: new Date() },
            { id: 3, productor_id: 3, categoria_id: 2, nombre: 'Aguacate Hass de Exportación', descripcion: 'Aguacate cultivado en clima templado. Punto exacto de maduración, pulpa mantecosa.', precio: 7200.00, cantidad_disponible: 80.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=800&q=80', municipio: 'Cundinamarca - Fusagasugá', version: 0, created_at: new Date() },
            { id: 4, productor_id: 3, categoria_id: 2, nombre: 'Fresas Dulces de Altura', descripcion: 'Fresas frescas en canastilla de 500g, aroma intenso y sabor balanceado.', precio: 6000.00, cantidad_disponible: 45.00, unidad_medida: 'Canastilla (500g)', foto_url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=800&q=80', municipio: 'Cundinamarca - Fusagasugá', version: 0, created_at: new Date() },
            { id: 5, productor_id: 2, categoria_id: 1, nombre: 'Zanahoria Tierna de Huerta', descripcion: 'Zanahoria crujiente recién arrancada, rica en betacarotenos.', precio: 2800.00, cantidad_disponible: 150.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=800&q=80', municipio: 'Boyacá - Tibasosa', version: 0, created_at: new Date() },
            { id: 6, productor_id: 3, categoria_id: 3, nombre: 'Plátano Hartón Maduro', descripcion: 'Plátano hartón seleccionado para hornear o freír.', precio: 3500.00, cantidad_disponible: 90.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80', municipio: 'Cundinamarca - Fusagasugá', version: 0, created_at: new Date() },
            { id: 7, productor_id: 2, categoria_id: 4, nombre: 'Frijol Bola Roja Seleccionado', descripcion: 'Grano seco seleccionado, cosecha reciente de cocción suave.', precio: 8500.00, cantidad_disponible: 60.00, unidad_medida: 'Kg', foto_url: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=800&q=80', municipio: 'Boyacá - Tibasosa', version: 0, created_at: new Date() },
            { id: 8, productor_id: 2, categoria_id: 1, nombre: 'Cilantro Cimarrón de Huerta (Agotado Demo)', descripcion: 'Manojo de hierba aromática tradicional sin stock.', precio: 1500.00, cantidad_disponible: 0.00, unidad_medida: 'Atado', foto_url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80', municipio: 'Boyacá - Tibasosa', version: 0, created_at: new Date() }
        ],
        pedidos: [
            { id: 1, comprador_id: 4, estado: 'Pendiente', total: 11400.00, direccion_entrega: 'Calle 127 # 45-20, Apto 502, Bogotá', telefono_contacto: '+57 320 111 2233', notas: 'Por favor entregar en portería.', created_at: new Date(Date.now() - 7200000) },
            { id: 2, comprador_id: 4, estado: 'En Proceso', total: 13500.00, direccion_entrega: 'Carrera 7 # 72-10, Oficina 301, Bogotá', telefono_contacto: '+57 320 111 2233', notas: 'Cosecha lista para despacho.', created_at: new Date(Date.now() - 86400000) },
            { id: 3, comprador_id: 4, estado: 'Entregado', total: 14400.00, direccion_entrega: 'Calle 127 # 45-20, Apto 502, Bogotá', telefono_contacto: '+57 320 111 2233', notas: 'Pedido recibido a satisfacción.', created_at: new Date(Date.now() - 259200000) }
        ],
        detalles_pedido: [
            { id: 1, pedido_id: 1, producto_id: 1, cantidad: 3.00, precio_unitario: 3800.00, subtotal: 11400.00 },
            { id: 2, pedido_id: 2, producto_id: 2, cantidad: 3.00, precio_unitario: 4500.00, subtotal: 13500.00 },
            { id: 3, pedido_id: 3, producto_id: 3, cantidad: 2.00, precio_unitario: 7200.00, subtotal: 14400.00 }
        ],
        otps: [], // D11: códigos de recuperación en modo fallback (con expiración)
        mensajes: [] // RF-10: hilos por pedido en modo fallback
    };
    console.log('[DB] Fallback store listo con roles, usuarios, categorías, productos y pedidos semilla.');
}

/**
 * Ejecutor principal de consultas parametrizadas
 * @param {string} sql - Sentencia SQL con placeholders '?'
 * @param {Array} params - Parámetros para prevenir inyección SQL
 */
async function query(sql, params = []) {
    if (isConnectedToMySQL && pool) {
        const [results] = await pool.query(sql, params);
        return results;
    }
    // Fallback en memoria si MySQL no está levantado
    return executeFallbackQuery(sql, params);
}

/**
 * Gestor transaccional para concurrencia de stock (RF-04)
 */
async function withTransaction(callback) {
    if (isConnectedToMySQL && pool) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } else {
        // En fallback simulamos atomicidad
        return await callback(null);
    }
}

/**
 * Emulador de consultas para el modo fallback en memoria
 */
function executeFallbackQuery(sql, params = []) {
    const s = sql.trim();
    const upper = s.toUpperCase();

    // SELECT usuario por email
    if (upper.startsWith('SELECT') && upper.includes('FROM USUARIO') && upper.includes('EMAIL = ?')) {
        const email = String(params[0]).toLowerCase();
        const user = fallbackMemoryStore.usuarios.find(u => u.email.toLowerCase() === email);
        if (user) {
            const rol = fallbackMemoryStore.roles.find(r => r.id === user.rol_id);
            return [{ ...user, rol_nombre: rol ? rol.nombre : '' }];
        }
        return [];
    }

    // SELECT usuario por id
    if (upper.startsWith('SELECT') && upper.includes('FROM USUARIO') && upper.includes('ID = ?')) {
        const id = Number(params[0]);
        const user = fallbackMemoryStore.usuarios.find(u => u.id === id);
        if (user) {
            const rol = fallbackMemoryStore.roles.find(r => r.id === user.rol_id);
            return [{ ...user, rol_nombre: rol ? rol.nombre : '' }];
        }
        return [];
    }

    // LISTAR usuarios para admin
    if (upper.startsWith('SELECT') && upper.includes('FROM USUARIO') && upper.includes('ORDER BY')) {
        return fallbackMemoryStore.usuarios.map(u => {
            const rol = fallbackMemoryStore.roles.find(r => r.id === u.rol_id);
            return {
                id: u.id,
                rol_id: u.rol_id,
                nombre: u.nombre,
                email: u.email,
                telefono: u.telefono,
                municipio: u.municipio,
                activo: u.activo,
                created_at: u.created_at,
                rol_nombre: rol ? rol.nombre : ''
            };
        });
    }

    // INSERT usuario
    if (upper.startsWith('INSERT INTO USUARIO')) {
        const newId = fallbackMemoryStore.usuarios.length + 1;
        const [rol_id, nombre, email, password_hash, telefono, municipio, activo] = params;
        const newUser = { id: newId, rol_id, nombre, email, password_hash, telefono, municipio, activo: activo !== undefined ? activo : 1, created_at: new Date() };
        fallbackMemoryStore.usuarios.push(newUser);
        return { insertId: newId, affectedRows: 1 };
    }

    // UPDATE usuario activo (RF-08)
    if (upper.startsWith('UPDATE USUARIO SET ACTIVO = ? WHERE ID = ?')) {
        const [activo, id] = params;
        const user = fallbackMemoryStore.usuarios.find(u => u.id === Number(id));
        if (user) {
            user.activo = Number(activo);
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // UPDATE usuario password_hash (Recuperación OTP)
    if (upper.startsWith('UPDATE USUARIO SET PASSWORD_HASH = ? WHERE EMAIL = ?')) {
        const [password_hash, email] = params;
        const user = fallbackMemoryStore.usuarios.find(u => u.email.toLowerCase() === String(email).toLowerCase());
        if (user) {
            user.password_hash = password_hash;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // SELECT categorias
    if (upper.startsWith('SELECT') && upper.includes('FROM CATEGORIA')) {
        return fallbackMemoryStore.categorias;
    }

    // SELECT productos para catálogo público (RF-03: cantidad_disponible > 0)
    if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTO') && upper.includes('CANTIDAD_DISPONIBLE > 0')) {
        let list = fallbackMemoryStore.productos.filter(p => Number(p.cantidad_disponible) > 0);
        
        // Filtro categoria
        if (upper.includes('CATEGORIA_ID = ?') && params.length > 0) {
            const catId = Number(params[0]);
            list = list.filter(p => p.categoria_id === catId);
        }
        // Filtro productor
        if (upper.includes('PRODUCTOR_ID = ?')) {
            const prodId = Number(params[0]);
            list = list.filter(p => p.productor_id === prodId);
        }

        return list.map(p => {
            const cat = fallbackMemoryStore.categorias.find(c => c.id === p.categoria_id);
            const user = fallbackMemoryStore.usuarios.find(u => u.id === p.productor_id);
            return {
                ...p,
                categoria_nombre: cat ? cat.nombre : '',
                productor_nombre: user ? user.nombre : ''
            };
        });
    }

    // SELECT todos los productos (para admin o productor)
    if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTO') && upper.includes('WHERE PRODUCTOR_ID = ?')) {
        const prodId = Number(params[0]);
        return fallbackMemoryStore.productos.filter(p => p.productor_id === prodId).map(p => {
            const cat = fallbackMemoryStore.categorias.find(c => c.id === p.categoria_id);
            return { ...p, categoria_nombre: cat ? cat.nombre : '' };
        });
    }

    // SELECT producto por ID
    if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTO') && upper.includes('ID = ?')) {
        const id = Number(params[0]);
        const p = fallbackMemoryStore.productos.find(prod => prod.id === id);
        if (!p) return [];
        const cat = fallbackMemoryStore.categorias.find(c => c.id === p.categoria_id);
        const user = fallbackMemoryStore.usuarios.find(u => u.id === p.productor_id);
        return [{
            ...p,
            categoria_nombre: cat ? cat.nombre : '',
            productor_nombre: user ? user.nombre : ''
        }];
    }

    // INSERT producto (RF-02)
    if (upper.startsWith('INSERT INTO PRODUCTO')) {
        const newId = fallbackMemoryStore.productos.length + 1;
        const [productor_id, categoria_id, nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, municipio] = params;
        const newProduct = {
            id: newId,
            productor_id: Number(productor_id),
            categoria_id: Number(categoria_id),
            nombre,
            descripcion,
            precio: parseFloat(precio),
            cantidad_disponible: parseFloat(cantidad_disponible),
            unidad_medida: unidad_medida || 'Kg',
            foto_url: foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
            municipio,
            version: 0,
            created_at: new Date()
        };
        fallbackMemoryStore.productos.push(newProduct);
        return { insertId: newId, affectedRows: 1 };
    }

    // UPDATE producto
    if (upper.startsWith('UPDATE PRODUCTO SET NOMBRE = ?')) {
        const [nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, municipio, id, productor_id] = params;
        // D7: el ADMIN (sin productor_id en params) puede actualizar cualquier publicación.
        const p = (productor_id === undefined || productor_id === null)
            ? fallbackMemoryStore.productos.find(prod => prod.id === Number(id))
            : fallbackMemoryStore.productos.find(prod => prod.id === Number(id) && prod.productor_id === Number(productor_id));
        if (p) {
            p.nombre = nombre;
            p.descripcion = descripcion;
            p.precio = parseFloat(precio);
            p.cantidad_disponible = parseFloat(cantidad_disponible);
            p.unidad_medida = unidad_medida;
            if (foto_url) p.foto_url = foto_url;
            p.municipio = municipio;
            p.version += 1;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // DELETE producto
    if (upper.startsWith('DELETE FROM PRODUCTO WHERE ID = ?')) {
        const id = Number(params[0]);
        const index = fallbackMemoryStore.productos.findIndex(p => p.id === id);
        if (index !== -1) {
            fallbackMemoryStore.productos.splice(index, 1);
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // UPDATE descuento de stock transaccional (RF-04)
    if (upper.includes('UPDATE PRODUCTO SET CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE - ?')) {
        const [cant, id] = params;
        const p = fallbackMemoryStore.productos.find(prod => prod.id === Number(id));
        if (p && p.cantidad_disponible >= Number(cant)) {
            p.cantidad_disponible -= Number(cant);
            p.version += 1;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // UPDATE restitución de stock al cancelar (RF-06)
    if (upper.includes('UPDATE PRODUCTO SET CANTIDAD_DISPONIBLE = CANTIDAD_DISPONIBLE + ?')) {
        const [cant, id] = params;
        const p = fallbackMemoryStore.productos.find(prod => prod.id === Number(id));
        if (p) {
            p.cantidad_disponible += Number(cant);
            p.version += 1;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // INSERT pedido (RF-04)
    if (upper.startsWith('INSERT INTO PEDIDO')) {
        const newId = fallbackMemoryStore.pedidos.length + 1;
        const [comprador_id, estado, total, direccion_entrega, telefono_contacto, notas] = params;
        const newOrder = {
            id: newId,
            comprador_id: Number(comprador_id),
            estado: estado || 'Pendiente',
            total: parseFloat(total),
            direccion_entrega,
            telefono_contacto,
            notas,
            created_at: new Date()
        };
        fallbackMemoryStore.pedidos.push(newOrder);
        return { insertId: newId, affectedRows: 1 };
    }

    // INSERT detalle pedido
    if (upper.startsWith('INSERT INTO DETALLE_PEDIDO')) {
        const newId = fallbackMemoryStore.detalles_pedido.length + 1;
        const [pedido_id, producto_id, cantidad, precio_unitario, subtotal] = params;
        const newDetail = {
            id: newId,
            pedido_id: Number(pedido_id),
            producto_id: Number(producto_id),
            cantidad: parseFloat(cantidad),
            precio_unitario: parseFloat(precio_unitario),
            subtotal: parseFloat(subtotal),
            created_at: new Date()
        };
        fallbackMemoryStore.detalles_pedido.push(newDetail);
        return { insertId: newId, affectedRows: 1 };
    }

    // SELECT pedidos por comprador
    if (upper.startsWith('SELECT') && upper.includes('FROM PEDIDO') && upper.includes('WHERE COMPRADOR_ID = ?')) {
        const compId = Number(params[0]);
        return fallbackMemoryStore.pedidos.filter(ped => ped.comprador_id === compId).map(ped => {
            const details = fallbackMemoryStore.detalles_pedido.filter(d => d.pedido_id === ped.id).map(d => {
                const prod = fallbackMemoryStore.productos.find(p => p.id === d.producto_id);
                return {
                    ...d,
                    producto_nombre: prod ? prod.nombre : '',
                    producto_foto: prod ? prod.foto_url : '',
                    unidad_medida: prod ? prod.unidad_medida : ''
                };
            });
            return { ...ped, items: details };
        });
    }

    // SELECT pedidos para productor
    if (upper.startsWith('SELECT') && upper.includes('FROM PEDIDO') && upper.includes('PRODUCTOR')) {
        const prodId = Number(params[0]);
        // Pedidos que contienen productos del productor
        const myProdIds = fallbackMemoryStore.productos.filter(p => p.productor_id === prodId).map(p => p.id);
        const myOrderIds = [...new Set(fallbackMemoryStore.detalles_pedido.filter(d => myProdIds.includes(d.producto_id)).map(d => d.pedido_id))];
        
        return fallbackMemoryStore.pedidos.filter(ped => myOrderIds.includes(ped.id)).map(ped => {
            const buyer = fallbackMemoryStore.usuarios.find(u => u.id === ped.comprador_id);
            const details = fallbackMemoryStore.detalles_pedido.filter(d => d.pedido_id === ped.id && myProdIds.includes(d.producto_id)).map(d => {
                const prod = fallbackMemoryStore.productos.find(p => p.id === d.producto_id);
                return { ...d, producto_nombre: prod ? prod.nombre : '' };
            });
            return {
                ...ped,
                comprador_nombre: buyer ? buyer.nombre : 'Comprador',
                items: details
            };
        });
    }

    // SELECT pedido por ID
    if (upper.startsWith('SELECT') && upper.includes('FROM PEDIDO') && upper.includes('WHERE ID = ?')) {
        const id = Number(params[0]);
        const ped = fallbackMemoryStore.pedidos.find(p => p.id === id);
        if (!ped) return [];
        const details = fallbackMemoryStore.detalles_pedido.filter(d => d.pedido_id === ped.id).map(d => {
            const prod = fallbackMemoryStore.productos.find(p => p.id === d.producto_id);
            return {
                ...d,
                producto_nombre: prod ? prod.nombre : '',
                producto_foto: prod ? prod.foto_url : '',
                unidad_medida: prod ? prod.unidad_medida : ''
            };
        });
        const buyer = fallbackMemoryStore.usuarios.find(u => u.id === ped.comprador_id);
        return [{ ...ped, comprador_nombre: buyer ? buyer.nombre : '', items: details }];
    }

    // UPDATE estado pedido (RF-05, RF-06)
    if (upper.startsWith('UPDATE PEDIDO SET ESTADO = ? WHERE ID = ?')) {
        const [nuevoEstado, id] = params;
        const ped = fallbackMemoryStore.pedidos.find(p => p.id === Number(id));
        if (ped) {
            ped.estado = nuevoEstado;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // SELECT metricas globales para admin (RF-09)
    if (upper.includes('COUNT(')) {
        const usuariosActivos = fallbackMemoryStore.usuarios.filter(u => u.activo === 1).length;
        const productosPublicados = fallbackMemoryStore.productos.filter(p => p.cantidad_disponible > 0).length;
        const pedidosCompletados = fallbackMemoryStore.pedidos.filter(p => p.estado === 'Entregado').length;
        const totalVentas = fallbackMemoryStore.pedidos.filter(p => p.estado === 'Entregado').reduce((acc, curr) => acc + Number(curr.total), 0);
        return [{
            usuarios_activos: usuariosActivos,
            productos_publicados: productosPublicados,
            pedidos_completados: pedidosCompletados,
            total_ventas: totalVentas
        }];
    }

    // Verificación de propiedad productor -> pedido (RF-05 anti-IDOR, bloqueador D2)
    if (upper.startsWith('SELECT 1') && upper.includes('DETALLE_PEDIDO') && upper.includes('PRODUCTOR_ID = ?')) {
        const [pedidoId, productorId] = params;
        const owns = fallbackMemoryStore.detalles_pedido.some(d =>
            d.pedido_id === Number(pedidoId) &&
            fallbackMemoryStore.productos.some(p => p.id === d.producto_id && p.productor_id === Number(productorId))
        );
        return owns ? [{ '1': 1 }] : [];
    }

    // OTP de recuperación (D11: con expiración, sobrevive reinicios en modo MySQL)
    if (upper.startsWith('SELECT') && upper.includes('FROM PASSWORD_RESET_OTP') && upper.includes('EMAIL = ?')) {
        const row = fallbackMemoryStore.otps.find(o => o.email === String(params[0]).toLowerCase());
        return row ? [{ ...row }] : [];
    }

    if (upper.startsWith('DELETE FROM PASSWORD_RESET_OTP') && upper.includes('EMAIL = ?')) {
        const email = String(params[0]).toLowerCase();
        const before = fallbackMemoryStore.otps.length;
        fallbackMemoryStore.otps = fallbackMemoryStore.otps.filter(o => o.email !== email);
        return { affectedRows: before - fallbackMemoryStore.otps.length };
    }

    if (upper.startsWith('DELETE FROM PASSWORD_RESET_OTP') && upper.includes('EXPIRES_AT')) {
        const now = Date.now();
        const before = fallbackMemoryStore.otps.length;
        fallbackMemoryStore.otps = fallbackMemoryStore.otps.filter(o => new Date(o.expires_at).getTime() >= now);
        return { affectedRows: before - fallbackMemoryStore.otps.length };
    }

    if (upper.startsWith('INSERT INTO PASSWORD_RESET_OTP')) {
        const [email, otp_hash] = params;
        fallbackMemoryStore.otps.push({
            email: String(email).toLowerCase(),
            otp_hash,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
            intentos: 0,
            created_at: new Date()
        });
        return { affectedRows: 1 };
    }

    if (upper.startsWith('UPDATE PASSWORD_RESET_OTP SET INTENTOS')) {
        const o = fallbackMemoryStore.otps.find(x => x.email === String(params[0]).toLowerCase());
        if (o) {
            o.intentos += 1;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    }

    // Hilo de mensajes por pedido (RF-10)
    if (upper.includes('FROM MENSAJE_PEDIDO') && upper.includes('COUNT(')) {
        const [ids, userId] = params;
        const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(Number));
        const agg = {};
        for (const m of fallbackMemoryStore.mensajes) {
            if (idSet.has(Number(m.pedido_id)) && Number(m.autor_id) !== Number(userId) && Number(m.leido) === 0) {
                agg[m.pedido_id] = (agg[m.pedido_id] || 0) + 1;
            }
        }
        return Object.entries(agg).map(([pedido_id, no_leidos]) => ({ pedido_id: Number(pedido_id), no_leidos }));
    }

    if (upper.startsWith('SELECT') && upper.includes('FROM MENSAJE_PEDIDO') && !upper.includes('COUNT(')) {
        const pedidoId = Number(params[0]);
        return fallbackMemoryStore.mensajes
            .filter(m => Number(m.pedido_id) === pedidoId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id)
            .map(m => {
                const autor = fallbackMemoryStore.usuarios.find(u => u.id === Number(m.autor_id));
                return { ...m, autor_nombre: autor ? autor.nombre : 'Usuario' };
            });
    }

    if (upper.startsWith('INSERT INTO MENSAJE_PEDIDO')) {
        const [pedido_id, autor_id, mensaje] = params;
        const newId = fallbackMemoryStore.mensajes.length + 1;
        fallbackMemoryStore.mensajes.push({
            id: newId,
            pedido_id: Number(pedido_id),
            autor_id: Number(autor_id),
            mensaje,
            leido: 0,
            created_at: new Date()
        });
        return { insertId: newId, affectedRows: 1 };
    }

    if (upper.startsWith('UPDATE MENSAJE_PEDIDO SET LEIDO = 1')) {
        const [pedidoId, userId] = params;
        let n = 0;
        for (const m of fallbackMemoryStore.mensajes) {
            if (Number(m.pedido_id) === Number(pedidoId) && Number(m.autor_id) !== Number(userId) && Number(m.leido) === 0) {
                m.leido = 1;
                n++;
            }
        }
        return { affectedRows: n };
    }

    // Comprador de un pedido por join (M3: destinatarios de notificación)
    if (upper.includes('FROM USUARIO') && upper.includes('JOIN PEDIDO')) {
        const ped = fallbackMemoryStore.pedidos.find(p => p.id === Number(params[0]));
        if (!ped) return [];
        const buyer = fallbackMemoryStore.usuarios.find(u => u.id === ped.comprador_id);
        return buyer ? [{ id: buyer.id, email: buyer.email, nombre: buyer.nombre }] : [];
    }

    // Productores de un pedido por joins (M3: destinatarios de notificación)
    if (upper.includes('FROM USUARIO') && upper.includes('DETALLE_PEDIDO')) {
        const pid = Number(params[0]);
        const prodIds = [...new Set(
            fallbackMemoryStore.detalles_pedido
                .filter(d => d.pedido_id === pid)
                .map(d => {
                    const pr = fallbackMemoryStore.productos.find(p => p.id === d.producto_id);
                    return pr ? pr.productor_id : null;
                })
                .filter(Boolean)
        )];
        return prodIds
            .map(id => fallbackMemoryStore.usuarios.find(u => u.id === id))
            .filter(Boolean)
            .map(u => ({ email: u.email, nombre: u.nombre }));
    }

    // Por defecto retorno vacío seguro
    return [];
}

module.exports = {
    initDatabase,
    query,
    withTransaction,
    isMySQLConnected: () => isConnectedToMySQL,
    getPool: () => pool
};
