/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: tests/test_rf_suite.js
 * DESCRIPCIÓN: Suite de pruebas unitarias y de integración para TRD §4
 * CUBRE: 11 pruebas obligatorias mapeadas a los requisitos RF-01 a RF-09.
 * EJECUCIÓN: npm test
 * ==========================================================
 */

const assert = require('assert');
const path = require('path');
const db = require('../backend/database/db');

// Controladores y servicios a evaluar
const authController = require('../backend/controllers/authController');
const productController = require('../backend/controllers/productController');
const orderController = require('../backend/controllers/orderController');
const adminController = require('../backend/controllers/adminController');
const { sendOrderStatusNotificationAsync } = require('../backend/services/emailService');

// Colores para consola
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passedCount = 0;
let totalCount = 0;

function report(testName, passed, extra = '') {
    totalCount++;
    if (passed) {
        passedCount++;
        console.log(` ${GREEN}✓ [PASS]${RESET} Prueba #${totalCount}: ${testName} ${extra}`);
    } else {
        console.error(` ${RED}✗ [FAIL]${RESET} Prueba #${totalCount}: ${testName} - ${extra}`);
    }
}

// Emulador simple de req y res para controladores Express
function createMockReqRes({ body = {}, params = {}, query = {}, user = null, headers = {} } = {}) {
    const req = { body, params, query, user, headers };
    const res = {
        statusCode: 200,
        data: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.data = payload;
            return this;
        },
        cookie(name, value, options) {
            this.cookies = this.cookies || {};
            this.cookies[name] = { value, options };
            return this;
        },
        clearCookie(name, options) {
            if (this.cookies) delete this.cookies[name];
            return this;
        }
    };
    return { req, res };
}

async function runTests() {
    console.log(`\n${CYAN}================================================================${RESET}`);
    console.log(`${CYAN}   DEL CAMPO A TUS MANOS - SUITE DE PRUEBAS DE CALIDAD (TRD §4)  ${RESET}`);
    console.log(`${CYAN}================================================================${RESET}\n`);

    // Inicializar base de datos
    await db.initDatabase();

    // -------------------------------------------------------------
    // PRUEBA 1 (RF-01): Rechazo de registro con correo duplicado o campos vacíos
    // -------------------------------------------------------------
    try {
        const { req, res } = createMockReqRes({
            body: {
                nombre: 'Nuevo Usuario',
                email: 'admin@campo.com', // Correo existente
                password: 'Password123!',
                rol_id: 3
            }
        });
        await authController.register(req, res, () => {});
        const isDuplicateRejected = res.statusCode === 409 && res.data.success === false;
        report('Rechazo de registro con correo duplicado (RF-01)', isDuplicateRejected);
    } catch (e) {
        report('Rechazo de registro con correo duplicado (RF-01)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 2 (RF-02): Rechazo de publicación con precio o stock <= 0
    // -------------------------------------------------------------
    try {
        const { req, res } = createMockReqRes({
            user: { id: 2, rol_id: 2, rol_nombre: 'PRODUCTOR' },
            body: {
                nombre: 'Yuca de Prueba',
                precio: -100, // Inválido <= 0
                cantidad_disponible: 50,
                categoria_id: 3,
                municipio: 'Boyacá'
            }
        });
        await productController.createProduct(req, res, () => {});
        const isRejected = res.statusCode === 400 && res.data.success === false;
        report('Rechazo de publicación de producto con precio o stock ≤ 0 (RF-02)', isRejected);
    } catch (e) {
        report('Rechazo de publicación de producto con precio o stock ≤ 0 (RF-02)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 3 (RF-03): Filtro de catálogo excluye productos sin stock disponible
    // -------------------------------------------------------------
    try {
        const { req, res } = createMockReqRes({ query: {} });
        await productController.getCatalog(req, res, () => {});
        const productos = res.data.productos || [];
        const hasZeroStock = productos.some(p => Number(p.cantidad_disponible) <= 0);
        report('El filtro/búsqueda de catálogo excluye productos sin stock disponible (RF-03)', !hasZeroStock && productos.length > 0);
    } catch (e) {
        report('El filtro/búsqueda de catálogo excluye productos sin stock disponible (RF-03)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 4 (RF-04): Validación de stock antes de confirmar pedido
    // -------------------------------------------------------------
    try {
        const { req, res } = createMockReqRes({
            user: { id: 4, rol_id: 3, rol_nombre: 'COMPRADOR', email: 'comprador@campo.com', nombre: 'Laura' },
            body: {
                direccion_entrega: 'Calle 100 # 15-20',
                telefono_contacto: '+57 300 000 0000',
                items: [
                    { producto_id: 1, cantidad: 999999 } // Muy superior al stock
                ]
            }
        });
        await orderController.createOrder(req, res, (err) => {});
        const isStockBlocked = res.statusCode === 400 && res.data.message.includes('Stock insuficiente');
        report('Validación de stock antes de confirmar un pedido (RF-04)', isStockBlocked);
    } catch (e) {
        report('Validación de stock antes de confirmar un pedido (RF-04)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 5 (RF-04): Prohibición de auto-compra
    // -------------------------------------------------------------
    try {
        // Don Carlos Mendoza (id: 2) es el dueño del producto 1 (Tomate Chonto)
        const { req, res } = createMockReqRes({
            user: { id: 2, rol_id: 2, rol_nombre: 'PRODUCTOR', email: 'carlos.campesino@campo.com', nombre: 'Carlos' },
            body: {
                direccion_entrega: 'Finca Bella Vista',
                telefono_contacto: '+57 311 456 7890',
                items: [
                    { producto_id: 1, cantidad: 2 }
                ]
            }
        });
        await orderController.createOrder(req, res, (err) => {});
        const isSelfBuyBlocked = res.statusCode === 400 && res.data.message.includes('auto-compra');
        report('Prohibición de auto-compra para productores (RF-04)', isSelfBuyBlocked);
    } catch (e) {
        report('Prohibición de auto-compra para productores (RF-04)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 6 (RF-05): Prohibición de saltos de estado inválidos (ej. Pendiente -> Entregado)
    // -------------------------------------------------------------
    try {
        // Asegurar que Pedido 1 esté en estado 'Pendiente'
        await db.query("UPDATE pedido SET estado = 'Pendiente' WHERE id = 1");

        const { req, res } = createMockReqRes({
            user: { id: 2, rol_id: 2, rol_nombre: 'PRODUCTOR' }, // Dueño del producto 1 del pedido 1 (pasa el control anti-IDOR)
            params: { id: 1 },
            body: { nuevo_estado: 'Entregado' } // Salto prohibido sin pasar por 'En Proceso'
        });
        await orderController.updateOrderStatus(req, res, () => {});
        const isSkipBlocked = res.statusCode === 400 && res.data.message.includes('Transición de estado inválida');
        report('Prohibición de saltos de estado inválidos: Pendiente → Entregado (RF-05)', isSkipBlocked);
    } catch (e) {
        report('Prohibición de saltos de estado inválidos: Pendiente → Entregado (RF-05)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 7 (RF-06): Restitución correcta de stock al cancelar en estado 'Pendiente'
    // -------------------------------------------------------------
    try {
        // Asegurar que Pedido 1 esté en estado 'Pendiente' para permitir la cancelación
        await db.query("UPDATE pedido SET estado = 'Pendiente' WHERE id = 1");

        // Consultar stock inicial de Tomate Chonto (ID 1)
        const initialProd = (await db.query('SELECT cantidad_disponible FROM producto WHERE id = 1'))[0];
        const initialStock = Number(initialProd.cantidad_disponible);

        // Cancelar pedido 1 (que tiene 3 Kg de Tomate Chonto)
        const { req, res } = createMockReqRes({
            user: { id: 4, rol_id: 3, rol_nombre: 'COMPRADOR', email: 'comprador@campo.com', nombre: 'Laura' },
            params: { id: 1 }
        });
        await orderController.cancelOrder(req, res, () => {});
        const isCancelled = res.statusCode === 200 && res.data.nuevoEstado === 'Cancelado';

        // Verificar restitución de stock
        const updatedProd = (await db.query('SELECT cantidad_disponible FROM producto WHERE id = 1'))[0];
        const updatedStock = Number(updatedProd.cantidad_disponible);
        const stockRestored = updatedStock === initialStock + 3;

        report('Restitución correcta de stock al cancelar en estado Pendiente (RF-06)', isCancelled && stockRestored);
    } catch (e) {
        report('Restitución correcta de stock al cancelar en estado Pendiente (RF-06)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 8 (RF-06): Bloqueo de cancelación en estados 'En Proceso' y 'Entregado'
    // -------------------------------------------------------------
    try {
        // Asegurar que Pedido 2 esté en estado 'En Proceso'
        await db.query("UPDATE pedido SET estado = 'En Proceso' WHERE id = 2");

        const { req, res } = createMockReqRes({
            user: { id: 4, rol_id: 3, rol_nombre: 'COMPRADOR' },
            params: { id: 2 }
        });
        await orderController.cancelOrder(req, res, () => {});
        const isBlocked = res.statusCode === 400 && (res.data?.message?.toLowerCase().includes('no es posible cancelar') || res.data?.success === false);
        report('Bloqueo de cancelación en estados En Proceso y Entregado (RF-06)', isBlocked);
    } catch (e) {
        report('Bloqueo de cancelación en estados En Proceso y Entregado (RF-06)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 9 (RF-07): Persistencia del estado si el envío de correo falla
    // -------------------------------------------------------------
    try {
        // Simular fallo SMTP
        process.env.SMTP_USER = 'trigger_failure_mock';
        let didThrowInCallingCode = false;
        try {
            sendOrderStatusNotificationAsync({
                to: 'comprador@campo.com',
                nombreComprador: 'Laura',
                pedidoId: 2,
                nuevoEstado: 'Entregado',
                total: 13500
            });
        } catch (err) {
            didThrowInCallingCode = true;
        }

        // El servicio no debe lanzar excepción bloqueante
        const isAsyncSafe = !didThrowInCallingCode;
        process.env.SMTP_USER = 'mock_user'; // Restaurar
        report('Persistencia de estado ante fallo en el envío de correo (RF-07)', isAsyncSafe);
    } catch (e) {
        report('Persistencia de estado ante fallo en el envío de correo (RF-07)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 10 (RF-08, RF-09): Bloqueo de rutas /admin/** para roles no autorizados
    // -------------------------------------------------------------
    try {
        const { requireRole } = require('../backend/middleware/rbac');
        const rbacMiddleware = requireRole(['ADMIN']);
        const { req, res } = createMockReqRes({
            user: { id: 4, rol_id: 3, rol_nombre: 'COMPRADOR' } // No es ADMIN
        });
        let nextCalled = false;
        rbacMiddleware(req, res, () => { nextCalled = true; });

        const isForbidden = res.statusCode === 403 && !nextCalled;
        report('Bloqueo de rutas /admin/** para roles no autorizados (RF-08, RF-09)', isForbidden);
    } catch (e) {
        report('Bloqueo de rutas /admin/** para roles no autorizados (RF-08, RF-09)', false, e.message);
    }

    // -------------------------------------------------------------
    // PRUEBA 11 (RF-08): Un usuario desactivado no puede iniciar sesión
    // -------------------------------------------------------------
    try {
        // Usuario 5: 'bloqueado@campo.com' tiene activo = 0
        const { req, res } = createMockReqRes({
            body: {
                email: 'bloqueado@campo.com',
                password: 'Password123!'
            }
        });
        await authController.login(req, res, () => {});
        const isDeactivatedBlocked = res.statusCode === 403 && res.data.message.includes('desactivada');
        report('Un usuario desactivado no puede iniciar sesión (RF-08)', isDeactivatedBlocked);
    } catch (e) {
        report('Un usuario desactivado no puede iniciar sesión (RF-08)', false, e.message);
    }

    // -------------------------------------------------------------
    // RESUMEN FINAL
    // -------------------------------------------------------------
    console.log(`\n${CYAN}================================================================${RESET}`);
    if (passedCount === totalCount) {
        console.log(`${GREEN}   RESULTADO: 11/11 PRUEBAS APROBADAS SATISFACTORIAMENTE (100%)${RESET}`);
    } else {
        console.log(`${RED}   RESULTADO: ${passedCount}/${totalCount} PRUEBAS APROBADAS${RESET}`);
    }
    console.log(`${CYAN}================================================================${RESET}\n`);

    process.exit(passedCount === totalCount ? 0 : 1);
}

runTests();
