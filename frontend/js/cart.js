/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/cart.js
 * DESCRIPCIÓN: Carrito multi-producto en localStorage (épica K, ticket K1)
 * - Estado de UI NO sensible: ids + cantidades + snapshot de muestra.
 * - La sesión sigue en cookie HttpOnly; precio/stock reales los
 *   valida el backend al confirmar (RF-04, sin cambios).
 * - Al confirmar (K4) se divide en un pedido por productor.
 * ==========================================================
 */

const CART_KEY = 'dcm_cart';

function readStorage() {
    try {
        const raw = localStorage.getItem(CART_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidLine);
    } catch (e) {
        return [];
    }
}

function writeStorage(lines) {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch (e) {
        // Almacenamiento lleno o bloqueado: se opera en memoria esta sesión.
    }
    window.dispatchEvent(new CustomEvent('cart-changed', { detail: lines }));
}

function isValidLine(l) {
    return l
        && Number.isFinite(Number(l.producto_id)) && Number(l.producto_id) > 0
        && Number.isFinite(Number(l.cantidad)) && Number(l.cantidad) > 0;
}

function round2(n) {
    return Math.round(Number(n) * 100) / 100;
}

export const cart = {
    /** Líneas actuales (siempre array válido). */
    getCart() {
        return readStorage();
    },

    /** Agrega cantidad a una línea (crea o acumula). Acepta forma de catálogo ({id,...}) o de pedido ({producto_id,...}). */
    addItem(product, cantidad = 1) {
        const qty = round2(cantidad);
        const pid = Number(product && product.producto_id !== undefined ? product.producto_id : product && product.id);
        if (!Number.isFinite(pid) || pid <= 0) {
            return { ok: false, message: 'Producto inválido.' };
        }
        if (!Number.isFinite(qty) || qty <= 0) {
            return { ok: false, message: 'La cantidad debe ser mayor a cero.' };
        }
        const lines = readStorage();
        const existing = lines.find(l => Number(l.producto_id) === pid);
        const stock = Number(product.cantidad_disponible);
        const newQty = round2((existing ? Number(existing.cantidad) : 0) + qty);
        if (Number.isFinite(stock) && newQty > stock) {
            return { ok: false, message: `Solo hay ${stock} ${product.unidad_medida || 'unidades'} disponibles de "${product.nombre}".` };
        }
        if (existing) {
            existing.cantidad = newQty;
        } else {
            lines.push({
                producto_id: pid,
                cantidad: qty,
                nombre: product.nombre || 'Producto',
                precio: Number(product.precio) || 0,
                foto_url: product.foto_url || '',
                unidad_medida: product.unidad_medida || 'Kg',
                municipio: product.municipio || '',
                productor_id: Number(product.productor_id) || null,
                productor_nombre: product.productor_nombre || 'Productor'
            });
        }
        writeStorage(lines);
        return { ok: true, cantidad: existing ? existing.cantidad : qty };
    },

    /** Fija cantidad (<=0 elimina la línea). */
    updateQty(producto_id, cantidad) {
        const qty = round2(cantidad);
        let lines = readStorage();
        const line = lines.find(l => Number(l.producto_id) === Number(producto_id));
        if (!line) return { ok: false, message: 'El producto no está en el carrito.' };
        if (!Number.isFinite(qty) || qty <= 0) {
            lines = lines.filter(l => l !== line);
        } else {
            line.cantidad = qty;
        }
        writeStorage(lines);
        return { ok: true };
    },

    /** Elimina una línea por id de producto. */
    removeItem(producto_id) {
        const lines = readStorage().filter(l => Number(l.producto_id) !== Number(producto_id));
        writeStorage(lines);
        return { ok: true };
    },

    /** Vacía el carrito. */
    clear() {
        writeStorage([]);
    },

    /** Reemplaza el contenido (usado por K3 tras verificar stock real). */
    syncLines(lines) {
        const clean = (Array.isArray(lines) ? lines : []).filter(isValidLine);
        writeStorage(clean);
        return clean;
    },

    /** Nº de líneas distintas (badge compacto). */
    count() {
        return readStorage().length;
    },

    /** Unidades totales (badge estándar). */
    units() {
        return round2(readStorage().reduce((acc, l) => acc + Number(l.cantidad), 0));
    },

    /** Total estimado (el backend recalcula al confirmar). */
    total() {
        return round2(readStorage().reduce((acc, l) => acc + Number(l.cantidad) * Number(l.precio), 0));
    },

    /** Agrupa líneas por productor para el split de K4. */
    groupByProducer() {
        const groups = new Map();
        for (const l of readStorage()) {
            const key = l.productor_id ?? 'sin_productor';
            if (!groups.has(key)) {
                groups.set(key, {
                    productor_id: l.productor_id,
                    productor_nombre: l.productor_nombre,
                    items: [],
                    subtotal: 0
                });
            }
            const g = groups.get(key);
            g.items.push(l);
            g.subtotal = round2(g.subtotal + Number(l.cantidad) * Number(l.precio));
        }
        return [...groups.values()];
    }
};
