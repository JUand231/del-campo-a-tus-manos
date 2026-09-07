/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: backend/controllers/productController.js
 * DESCRIPCIÓN: Controlador de productos y catálogo público (RF-02, RF-03)
 * REGLA CLAVE: El catálogo público filtra exclusivamente productos con stock > 0.
 * ==========================================================
 */

const db = require('../database/db');

/**
 * Obtiene el catálogo público filtrado (RF-03)
 * Excluye productos sin stock disponible (cantidad_disponible > 0)
 */
async function getCatalog(req, res, next) {
    try {
        const { categoria_id, q, municipio } = req.query;

        let sql = `
            SELECT 
                p.id, p.productor_id, p.categoria_id, p.nombre, p.descripcion, 
                p.precio, p.cantidad_disponible, p.unidad_medida, p.foto_url, 
                p.municipio, p.created_at,
                c.nombre AS categoria_nombre, c.icono AS categoria_icono,
                u.nombre AS productor_nombre
            FROM producto p
            JOIN categoria c ON p.categoria_id = c.id
            JOIN usuario u ON p.productor_id = u.id
            WHERE p.cantidad_disponible > 0
        `;
        const params = [];

        // Filtro por categoría
        if (categoria_id && !isNaN(Number(categoria_id))) {
            sql += ' AND p.categoria_id = ?';
            params.push(Number(categoria_id));
        }

        // Filtro por búsqueda de texto
        if (q && q.trim().length > 0) {
            sql += ' AND (LOWER(p.nombre) LIKE ? OR LOWER(p.descripcion) LIKE ?)';
            const term = `%${q.trim().toLowerCase()}%`;
            params.push(term, term);
        }

        // Filtro por municipio / departamento
        if (municipio && municipio.trim() !== 'todos') {
            sql += ' AND LOWER(p.municipio) LIKE ?';
            params.push(`%${municipio.trim().toLowerCase()}%`);
        }

        sql += ' ORDER BY p.created_at DESC';

        const productos = await db.query(sql, params);
        const categorias = await db.query('SELECT id, nombre, descripcion, icono FROM categoria ORDER BY id ASC');

        return res.json({
            success: true,
            total: productos.length,
            categorias,
            productos
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Obtiene el detalle de un producto por su ID
 */
async function getProductById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const sql = `
            SELECT 
                p.id, p.productor_id, p.categoria_id, p.nombre, p.descripcion, 
                p.precio, p.cantidad_disponible, p.unidad_medida, p.foto_url, 
                p.municipio, p.version, p.created_at,
                c.nombre AS categoria_nombre,
                u.nombre AS productor_nombre, u.telefono AS productor_telefono
            FROM producto p
            JOIN categoria c ON p.categoria_id = c.id
            JOIN usuario u ON p.productor_id = u.id
            WHERE p.id = ?
        `;
        const products = await db.query(sql, [id]);

        if (!products || products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'El producto solicitado no fue encontrado.'
            });
        }

        return res.json({
            success: true,
            producto: products[0]
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Publicar un nuevo producto (RF-02 - Rol Productor)
 */
async function createProduct(req, res, next) {
    try {
        const { nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, categoria_id, municipio } = req.body;
        const productorId = req.user.id;

        const precioNum = parseFloat(precio);
        const stockNum = parseFloat(cantidad_disponible);

        // Validación de negocio (RF-02: precio y stock > 0)
        if (precioNum <= 0 || stockNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio y el stock deben ser estrictamente mayores a cero para poder publicar.'
            });
        }

        const fallbackFoto = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80';

        const sql = `
            INSERT INTO producto (
                productor_id, categoria_id, nombre, descripcion, precio, 
                cantidad_disponible, unidad_medida, foto_url, municipio, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;

        const result = await db.query(sql, [
            productorId,
            Number(categoria_id),
            nombre.trim(),
            descripcion ? descripcion.trim() : null,
            precioNum,
            stockNum,
            unidad_medida ? unidad_medida.trim() : 'Kg',
            foto_url && foto_url.trim().length > 0 ? foto_url.trim() : fallbackFoto,
            municipio.trim()
        ]);

        return res.status(201).json({
            success: true,
            message: 'Producto publicado exitosamente en el catálogo.',
            productoId: result.insertId
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Actualizar producto existente (RF-02 - Rol Productor)
 */
async function updateProduct(req, res, next) {
    try {
        const productId = Number(req.params.id);
        if (isNaN(productId) || productId <= 0) {
            return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
        }
        const productorId = req.user.id;
        const { nombre, descripcion, precio, cantidad_disponible, unidad_medida, foto_url, municipio } = req.body;

        // Verificar propiedad
        const existing = await db.query('SELECT id, productor_id FROM producto WHERE id = ?', [productId]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        if (existing[0].productor_id !== productorId && req.user.rol_nombre !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'No tienes permiso para modificar este producto.' });
        }

        const precioNum = parseFloat(precio);
        const stockNum = parseFloat(cantidad_disponible);

        if (precioNum <= 0 || stockNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio debe ser mayor a cero y el stock no puede ser negativo.'
            });
        }

        // D7: el ADMIN puede moderar publicaciones ajenas; el productor solo las propias.
        const isAdmin = req.user.rol_nombre === 'ADMIN';
        const sql = isAdmin ? `
            UPDATE producto SET 
                nombre = ?, descripcion = ?, precio = ?, cantidad_disponible = ?, 
                unidad_medida = ?, foto_url = ?, municipio = ?, version = version + 1
            WHERE id = ?
        ` : `
            UPDATE producto SET 
                nombre = ?, descripcion = ?, precio = ?, cantidad_disponible = ?, 
                unidad_medida = ?, foto_url = ?, municipio = ?, version = version + 1
            WHERE id = ? AND productor_id = ?
        `;

        const params = [
            nombre.trim(),
            descripcion ? descripcion.trim() : '',
            precioNum,
            stockNum,
            unidad_medida || 'Kg',
            foto_url || '',
            municipio.trim(),
            productId
        ];
        if (!isAdmin) {
            params.push(productorId);
        }

        const result = await db.query(sql, params);
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado o sin cambios aplicados.' });
        }

        return res.json({
            success: true,
            message: 'Producto actualizado satisfactoriamente.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Eliminar producto (RF-02 Productor / RF-08 Admin Moderación)
 */
async function deleteProduct(req, res, next) {
    try {
        const productId = Number(req.params.id);
        if (isNaN(productId) || productId <= 0) {
            return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
        }
        const existing = await db.query('SELECT id, productor_id FROM producto WHERE id = ?', [productId]);

        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        if (existing[0].productor_id !== req.user.id && req.user.rol_nombre !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'No estás autorizado para eliminar esta publicación.' });
        }

        await db.query('DELETE FROM producto WHERE id = ?', [productId]);

        return res.json({
            success: true,
            message: 'Publicación eliminada correctamente.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Listar productos propios del productor (incluye stock = 0)
 */
async function getMyProducts(req, res, next) {
    try {
        const productorId = req.user.id;
        const sql = `
            SELECT 
                p.id, p.categoria_id, p.nombre, p.descripcion, p.precio, 
                p.cantidad_disponible, p.unidad_medida, p.foto_url, p.municipio, 
                p.version, p.created_at,
                c.nombre AS categoria_nombre
            FROM producto p
            JOIN categoria c ON p.categoria_id = c.id
            WHERE p.productor_id = ?
            ORDER BY p.created_at DESC
        `;
        const products = await db.query(sql, [productorId]);

        return res.json({
            success: true,
            productos: products
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Listar categorías disponibles
 */
async function getCategories(req, res, next) {
    try {
        const categories = await db.query('SELECT id, nombre, descripcion, icono FROM categoria ORDER BY id ASC');
        return res.json({ success: true, categorias: categories });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getCatalog,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getMyProducts,
    getCategories
};
