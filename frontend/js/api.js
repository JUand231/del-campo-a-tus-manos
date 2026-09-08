/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/api.js
 * DESCRIPCIÓN: Cliente HTTP centralizado con manejo de tokens y errores
 * ==========================================================
 */

const API_BASE_URL = '/api';

async function request(endpoint, options = {}) {
    // D5: la sesión viaja en cookie HttpOnly (el navegador la adjunta solo);
    // ya no se inyecta Authorization Bearer desde localStorage.
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const config = {
        credentials: 'same-origin',
        ...options,
        headers
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            // Si la sesión expiró (401), desautenticar
            if (response.status === 401 && !endpoint.includes('/auth/login')) {
                localStorage.removeItem('dcm_user');
                window.dispatchEvent(new CustomEvent('auth-changed'));
            }
            throw new Error(data.message || 'Error en la solicitud al servidor.');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export const api = {
    // Auth
    register: (userData) => request('/auth/registro', { method: 'POST', body: JSON.stringify(userData) }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getProfile: () => request('/auth/perfil'),
    solicitarOtp: (email) => request('/auth/solicitar-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPasswordOtp: (data) => request('/auth/reset-password-otp', { method: 'POST', body: JSON.stringify(data) }),

    // Productos y Catálogo
    getCatalog: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/productos${query ? `?${query}` : ''}`);
    },
    getProductById: (id) => request(`/productos/${id}`),
    getCategories: () => request('/productos/categorias'),
    getMyProducts: () => request('/productos/mis-productos'),
    createProduct: (productData) => request('/productos', { method: 'POST', body: JSON.stringify(productData) }),
    updateProduct: (id, productData) => request(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(productData) }),
    deleteProduct: (id) => request(`/productos/${id}`, { method: 'DELETE' }),

    // Pedidos
    createOrder: (orderData) => request('/pedidos', { method: 'POST', body: JSON.stringify(orderData) }),
    getMyOrders: () => request('/pedidos/mis-pedidos'),
    getProducerOrders: () => request('/pedidos/productor'),
    updateOrderStatus: (id, nuevo_estado) => request(`/pedidos/${id}/estado`, { method: 'PUT', body: JSON.stringify({ nuevo_estado }) }),
    cancelOrder: (id) => request(`/pedidos/${id}/cancelar`, { method: 'PUT' }),

    // Mensajería del pedido (RF-10, Fase 2)
    getOrderMessages: (id) => request(`/pedidos/${id}/mensajes`),
    postOrderMessage: (id, mensaje) => request(`/pedidos/${id}/mensajes`, { method: 'POST', body: JSON.stringify({ mensaje }) }),
    markMessagesRead: (id) => request(`/pedidos/${id}/mensajes/leer`, { method: 'PUT' }),
    getUnreadMessages: () => request('/pedidos/mensajes/no-leidos'),

    // Administración
    getAdminMetrics: (force = false) => request(`/admin/metricas${force ? '?force=true' : ''}`),
    getAdminUsers: () => request('/admin/usuarios'),
    toggleUserStatus: (id, activo) => request(`/admin/usuarios/${id}/estado`, { method: 'PUT', body: JSON.stringify({ activo }) }),
    getAdminProducts: () => request('/admin/productos'),
    deleteAdminProduct: (id) => request(`/admin/productos/${id}`, { method: 'DELETE' })
};
