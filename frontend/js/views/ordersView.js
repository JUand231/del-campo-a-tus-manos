/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/ordersView.js
 * DESCRIPCIÓN: Panel del comprador / Mis Pedidos (RF-04, RF-06)
 * REGLAS: Cancelación exclusiva en 'Pendiente' con restitución de stock.
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast, confirmDialog } from '../store.js';
import { threadToggleHTML, attachThreadToggles } from './messageThread.js';

let currentFilter = 'all';

export async function renderOrders(container) {
    if (!store.isAuthenticated()) {
        container.innerHTML = `
            <div class="max-w-[600px] mx-auto py-16 px-4 text-center">
                <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                    <span class="material-symbols-outlined text-[32px]" style="color: var(--color-primary);">lock</span>
                </div>
                <h2 class="text-xl font-bold text-on-surface mb-2">Inicia sesión para ver tus pedidos</h2>
                <p class="text-sm text-text-secondary mb-6">Accede con tu cuenta de comprador para monitorear tus cosechas y envíos.</p>
                <button id="btn-login-orders" class="btn-institutional text-xs">Iniciar Sesión</button>
            </div>
        `;
        document.getElementById('btn-login-orders')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
        });
        return;
    }

    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
            <!-- Header Context & Title (Stitch Mockup) -->
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1" style="color: var(--color-primary);">
                        <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                        <span>Panel del Comprador</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">Mis Pedidos</h1>
                    <p class="text-xs sm:text-sm text-text-secondary mt-1" style="color: var(--color-text-secondary);">
                        Monitorea tus cosechas solicitadas, el estado de preparación y cancela órdenes pendientes si lo requieres.
                    </p>
                </div>
            </div>

            <!-- Tabs de Filtro de Estados -->
            <div class="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none" id="order-tabs">
                <button class="order-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${currentFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161]'}" 
                        style="${currentFilter === 'all' ? 'background-color: var(--color-primary); color: white;' : ''}" data-filter="all">
                    Todos
                </button>
                <button class="order-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${currentFilter === 'Pendiente' ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161]'}" 
                        style="${currentFilter === 'Pendiente' ? 'background-color: var(--color-primary); color: white;' : ''}" data-filter="Pendiente">
                    Pendientes
                </button>
                <button class="order-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${currentFilter === 'En Proceso' ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161]'}" 
                        style="${currentFilter === 'En Proceso' ? 'background-color: var(--color-primary); color: white;' : ''}" data-filter="En Proceso">
                    En Proceso
                </button>
                <button class="order-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${currentFilter === 'Entregado' ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161]'}" 
                        style="${currentFilter === 'Entregado' ? 'background-color: var(--color-primary); color: white;' : ''}" data-filter="Entregado">
                    Entregados
                </button>
                <button class="order-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${currentFilter === 'Cancelado' ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border text-[#616161]'}" 
                        style="${currentFilter === 'Cancelado' ? 'background-color: var(--color-primary); color: white;' : ''}" data-filter="Cancelado">
                    Cancelados
                </button>
            </div>

            <!-- Listado de Pedidos -->
            <div id="orders-container" class="space-y-4">
                <div class="skeleton h-32 w-full rounded-2xl"></div>
                <div class="skeleton h-32 w-full rounded-2xl"></div>
            </div>
        </div>
    `;

    // Listeners de Tabs
    const tabs = document.querySelectorAll('.order-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentFilter = tab.getAttribute('data-filter');
            tabs.forEach(t => {
                t.style.backgroundColor = '';
                t.style.color = '';
                t.classList.remove('bg-primary', 'text-white', 'shadow-sm');
                t.classList.add('bg-white', 'text-[#616161]');
            });
            tab.style.backgroundColor = 'var(--color-primary)';
            tab.style.color = 'white';
            loadOrdersList();
        });
    });

    await loadOrdersList();
}

async function loadOrdersList() {
    const container = document.getElementById('orders-container');
    if (!container) return;

    try {
        const res = await api.getMyOrders();
        let orders = res.pedidos || [];

        // RF-10: mapa de no leídos por pedido (best-effort, no bloquea la lista)
        let unreadMap = {};
        try {
            const unreadRes = await api.getUnreadMessages();
            (unreadRes.no_leidos || []).forEach(u => { unreadMap[u.pedido_id] = u.no_leidos; });
        } catch (e) { /* sin insignias si falla */ }

        if (currentFilter !== 'all') {
            orders = orders.filter(o => o.estado === currentFilter);
        }

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-border p-12 text-center">
                    <span class="material-symbols-outlined text-[48px] text-text-secondary mb-3" style="color: var(--color-primary);">shopping_bag</span>
                    <h3 class="text-base font-bold text-on-surface mb-1">No tienes pedidos en esta sección</h3>
                    <p class="text-xs text-text-secondary mb-4">Explora el catálogo y apoya a las familias campesinas con cosechas frescas.</p>
                    <a href="#/catalogo" class="btn-primary-cta text-xs">Ir al Catálogo</a>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => {
            const isPending = order.estado === 'Pendiente';
            const isInProcess = order.estado === 'En Proceso';
            const isDelivered = order.estado === 'Entregado';
            const isCancelled = order.estado === 'Cancelado';

            let badgeClass = 'badge-pendiente';
            let badgeIcon = 'hourglass_top';
            if (isInProcess) { badgeClass = 'badge-proceso'; badgeIcon = 'local_shipping'; }
            if (isDelivered) { badgeClass = 'badge-entregado'; badgeIcon = 'check_circle'; }
            if (isCancelled) { badgeClass = 'badge-cancelado'; badgeIcon = 'cancel'; }

            const dateStr = new Date(order.created_at).toLocaleDateString('es-CO', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `
                <article class="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
                    <!-- Encabezado de la Tarjeta -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                        <div class="flex items-center gap-3">
                            <span class="font-extrabold text-base text-on-surface">#DCM-${order.id}</span>
                            <span class="badge-status ${badgeClass}">
                                <span class="material-symbols-outlined text-[14px]">${badgeIcon}</span>
                                ${order.estado}
                            </span>
                        </div>
                        <span class="text-xs text-text-secondary">${dateStr}</span>
                    </div>

                    <!-- Items del Pedido -->
                    <div class="space-y-2">
                        ${(order.items || []).map(item => `
                            <div class="flex items-center justify-between py-1 text-sm">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-lg overflow-hidden bg-[#F5F3F3] shrink-0">
                                        <img src="${item.producto_foto || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'}" 
                                             onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'"
                                             class="w-full h-full object-cover" alt="${item.producto_nombre}">
                                    </div>
                                    <div>
                                        <h4 class="font-bold text-xs text-on-surface">${item.producto_nombre}</h4>
                                        <span class="text-[11px] text-text-secondary">${item.cantidad} ${item.unidad_medida} x $${Number(item.precio_unitario).toLocaleString('es-CO')}</span>
                                    </div>
                                </div>
                                <span class="font-bold text-xs text-on-surface">$${Number(item.subtotal).toLocaleString('es-CO')}</span>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Hilo de mensajes (RF-10) -->
                    ${threadToggleHTML(order.id, unreadMap[order.id] || 0)}

                    <!-- Pie de la Tarjeta: Total y Acciones -->
                    <div class="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span class="text-xs text-text-secondary block">Entrega en: <strong class="text-on-surface">${order.direccion_entrega}</strong></span>
                            <span class="text-sm font-black" style="color: var(--color-primary);">
                                Total: $${Number(order.total).toLocaleString('es-CO')}
                            </span>
                        </div>

                        <!-- Botón de Cancelación (RF-06) -->
                        <div>
                            ${isPending ? `
                                <button class="btn-cancel-order btn-outline text-xs text-red-600 border-red-300 hover:bg-red-50 hover:border-red-500" data-id="${order.id}">
                                    <span class="material-symbols-outlined text-[16px]">close</span>
                                    Cancelar Pedido
                                </button>
                            ` : (isCancelled ? `
                                <span class="text-xs text-text-secondary font-medium">Pedido cancelado y stock devuelto al catálogo.</span>
                            ` : `
                                <span class="text-xs text-text-secondary font-medium italic">En preparación o entregado (no cancelable en línea).</span>
                            `)}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Listeners para Cancelar Pedido (RF-06)
        container.querySelectorAll('.btn-cancel-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-id');
                const confirmCancel = await confirmDialog({
                    title: `¿Cancelar pedido #DCM-${orderId}?`,
                    text: 'El pedido pasará a estado Cancelado y el stock de los productos se restituirá automáticamente al catálogo.',
                    confirmButtonText: 'Sí, cancelar pedido',
                    confirmButtonColor: '#d32f2f'
                });
                if (!confirmCancel) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Cancelando...';
                    await api.cancelOrder(orderId);
                    showToast(`El pedido #DCM-${orderId} fue cancelado y el stock se restituyó exitosamente.`, 'success');
                    await loadOrdersList();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">close</span> Cancelar Pedido';
                }
            });
        });

        // Hilo de mensajes (RF-10)
        attachThreadToggles(container);

    } catch (err) {
        container.innerHTML = `
            <div class="p-8 text-center bg-red-50 rounded-xl border border-red-200">
                <p class="text-xs text-red-600">${err.message}</p>
            </div>
        `;
    }
}
