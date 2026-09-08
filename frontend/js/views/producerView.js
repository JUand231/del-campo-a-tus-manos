/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/producerView.js
 * DESCRIPCIÓN: Panel de control del Productor Agrícola (RF-02, RF-05)
 * GESTIÓN: CRUD de cosechas propias y avance secuencial de pedidos.
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast, confirmDialog } from '../store.js';
import { threadToggleHTML, attachThreadToggles } from './messageThread.js';

let editingProductId = null;
let orderFilter = 'all';

export async function renderProducer(container) {
    if (!store.isAuthenticated() || (!store.isProducer() && !store.isAdmin())) {
        container.innerHTML = `
            <div class="max-w-[600px] mx-auto py-16 px-4 text-center">
                <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style="background-color: var(--color-warning-bg);">
                    <span class="material-symbols-outlined text-[32px]" style="color: var(--color-warning);">lock</span>
                </div>
                <h2 class="text-xl font-bold text-on-surface mb-2">Acceso exclusivo para Productores</h2>
                <p class="text-sm text-text-secondary mb-6">Debes iniciar sesión con una cuenta de Productor para gestionar cosechas y despachos.</p>
                <button id="btn-login-producer" class="btn-institutional text-xs">Iniciar Sesión como Productor</button>
            </div>
        `;
        document.getElementById('btn-login-producer')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
        });
        return;
    }

    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
            <!-- Encabezado del Productor -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1" style="color: var(--color-primary);">
                        <span class="material-symbols-outlined text-[16px]">agriculture</span>
                        <span>Panel del Productor Agrícola</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">Gestión de Cosechas y Pedidos</h1>
                    <p class="text-xs sm:text-sm text-text-secondary mt-1">
                        Publica nuevos lotes de tu finca y actualiza el estado de las órdenes recibidas.
                    </p>
                </div>
                <button id="btn-open-create-product" class="btn-primary-cta text-xs py-2.5 px-4 shadow-sm">
                    <span class="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Publicar Nueva Cosecha</span>
                </button>
            </div>

            <!-- Sección 1: Pedidos Recibidos (RF-05) -->
            <section class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">inbox</span>
                        Pedidos Recibidos
                    </h2>
                    <span id="producer-orders-count" class="text-xs text-text-secondary font-medium">Cargando...</span>
                </div>
                <!-- Tabs de filtrado de pedidos -->
                <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" id="order-filter-tabs">
                    <button class="order-ftab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all text-white shadow-sm" 
                            style="background-color: var(--color-primary);" data-filter="all">Todos</button>
                    <button class="order-ftab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-white border border-border text-[#616161]" 
                            data-filter="Pendiente">🟡 Pendientes</button>
                    <button class="order-ftab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-white border border-border text-[#616161]" 
                            data-filter="En Proceso">🔵 En Proceso</button>
                    <button class="order-ftab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-white border border-border text-[#616161]" 
                            data-filter="Entregado">✅ Entregados</button>
                    <button class="order-ftab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all bg-white border border-border text-[#616161]" 
                            data-filter="Cancelado">❌ Cancelados</button>
                </div>
                <div id="producer-orders-list" class="space-y-3">
                    <div class="skeleton h-24 w-full rounded-xl"></div>
                </div>
            </section>

            <!-- Sección 2: Mis Productos Publicados (RF-02) -->
            <section class="space-y-4 pt-4 border-t border-border">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">inventory_2</span>
                        Mis Cosechas Publicadas
                    </h2>
                    <span id="producer-products-count" class="text-xs text-text-secondary font-medium">Cargando...</span>
                </div>
                <div id="producer-products-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="skeleton h-32 w-full rounded-xl"></div>
                </div>
            </section>
        </div>

        <!-- Modal de Creación / Edición de Producto (RF-02) -->
        <div id="product-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="flex items-center justify-between pb-3 border-b border-border mb-4">
                    <h3 id="modal-prod-title" class="font-bold text-base text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">add_box</span>
                        Publicar Producto en Catálogo
                    </h3>
                    <button id="btn-close-prod-modal" class="text-text-secondary hover:text-on-surface">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form id="product-form" class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-text-secondary block mb-1">Nombre del Alimento *</label>
                        <input id="p-nombre" type="text" required placeholder="Ej. Tomate Chonto Orgánico"
                               class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Categoría *</label>
                            <select id="p-categoria" required class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-white">
                                <option value="" disabled selected>Cargando...</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Unidad de Medida *</label>
                            <input id="p-unidad" type="text" required value="Kg" placeholder="Kg, Canastilla, Atado"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Precio Unitario ($) *</label>
                            <input id="p-precio" type="number" step="any" min="0.01" required placeholder="Ej. 3200"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Stock Disponible *</label>
                            <input id="p-stock" type="number" step="any" min="0.01" required placeholder="Ej. 100"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-text-secondary block mb-1">Municipio / Vereda de Origen *</label>
                        <input id="p-municipio" type="text" required placeholder="Ej. Boyacá - Tibasosa"
                               class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-text-secondary block mb-1">URL de Foto (Opcional)</label>
                        <input id="p-foto" type="url" placeholder="https://..."
                               class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-text-secondary block mb-1">Descripción del cultivo</label>
                        <textarea id="p-descripcion" rows="2" placeholder="Prácticas de siembra, frescura, recomendaciones..."
                                  class="w-full p-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"></textarea>
                    </div>

                    <div id="product-error-msg" class="text-xs text-red-600 font-semibold hidden"></div>

                    <div class="pt-3 border-t border-border flex items-center justify-end gap-2">
                        <button type="button" id="btn-cancel-prod-modal" class="btn-outline text-xs">Cancelar</button>
                        <button type="submit" id="btn-submit-prod" class="btn-institutional text-xs">
                            <span id="btn-submit-prod-text">Publicar Lote</span>
                            <span class="material-symbols-outlined text-[16px]">check</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Cargar categorías dinámicamente desde la API
    try {
        const catRes = await api.getCategories();
        const catSelect = document.getElementById('p-categoria');
        if (catSelect && catRes.categorias) {
            catSelect.innerHTML = catRes.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
    } catch (_) {
        const catSelect = document.getElementById('p-categoria');
        if (catSelect) {
            catSelect.innerHTML = `
                <option value="1">Hortalizas y Verduras</option>
                <option value="2">Frutas Frescas</option>
                <option value="3">Tubérculos y Plátanos</option>
                <option value="4">Granos y Legumbres</option>
            `;
        }
    }

    // Modal listeners
    const modal = document.getElementById('product-modal');
    document.getElementById('btn-open-create-product')?.addEventListener('click', () => {
        editingProductId = null;
        document.getElementById('product-form').reset();
        // Recargar categorías al abrir modal
        api.getCategories().then(catRes => {
            const catSelect = document.getElementById('p-categoria');
            if (catSelect && catRes.categorias) {
                catSelect.innerHTML = catRes.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            }
        }).catch(() => {});
        document.getElementById('modal-prod-title').innerHTML = `
            <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">add_box</span>
            Publicar Producto en Catálogo
        `;
        document.getElementById('btn-submit-prod-text').textContent = 'Publicar Lote';
        document.getElementById('product-error-msg').classList.add('hidden');
        modal.classList.remove('hidden');
    });
    const closeModal = () => modal.classList.add('hidden');
    document.getElementById('btn-close-prod-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-prod-modal')?.addEventListener('click', closeModal);

    // Tabs de filtrado de pedidos del productor
    document.getElementById('order-filter-tabs')?.querySelectorAll('.order-ftab').forEach(tab => {
        tab.addEventListener('click', () => {
            orderFilter = tab.getAttribute('data-filter');
            document.getElementById('order-filter-tabs').querySelectorAll('.order-ftab').forEach(t => {
                t.style.backgroundColor = '';
                t.style.color = '';
                t.classList.remove('text-white', 'shadow-sm');
                t.classList.add('bg-white', 'border', 'border-border', 'text-[#616161]');
            });
            tab.style.backgroundColor = 'var(--color-primary)';
            tab.style.color = 'white';
            tab.classList.add('shadow-sm');
            tab.classList.remove('bg-white', 'border-border');
            loadOrders();
        });
    });

    // Enviar formulario de publicación / edición
    document.getElementById('product-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorMsg = document.getElementById('product-error-msg');
        errorMsg.classList.add('hidden');

        const nombre = document.getElementById('p-nombre').value.trim();
        const categoria_id = document.getElementById('p-categoria').value;
        const unidad_medida = document.getElementById('p-unidad').value.trim();
        const precio = parseFloat(document.getElementById('p-precio').value);
        const cantidad_disponible = parseFloat(document.getElementById('p-stock').value);
        const municipio = document.getElementById('p-municipio').value.trim();
        const foto_url = document.getElementById('p-foto').value.trim();
        const descripcion = document.getElementById('p-descripcion').value.trim();

        if (precio <= 0 || cantidad_disponible <= 0) {
            errorMsg.textContent = 'El precio y la cantidad disponible deben ser mayores a cero (RF-02).';
            errorMsg.classList.remove('hidden');
            return;
        }

        const submitBtn = document.getElementById('btn-submit-prod');
        const submitText = document.getElementById('btn-submit-prod-text');
        submitBtn.disabled = true;
        submitText.textContent = 'Guardando...';

        try {
            if (editingProductId) {
                await api.updateProduct(editingProductId, {
                    nombre,
                    categoria_id,
                    unidad_medida,
                    precio,
                    cantidad_disponible,
                    municipio,
                    foto_url: foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
                    descripcion
                });
                closeModal();
                showToast('Producto actualizado correctamente en el catálogo.', 'success');
            } else {
                await api.createProduct({
                    nombre,
                    categoria_id,
                    unidad_medida,
                    precio,
                    cantidad_disponible,
                    municipio,
                    foto_url: foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
                    descripcion
                });
                closeModal();
                showToast('¡Cosecha publicada en el catálogo exitosamente!', 'success');
            }
            await loadProducerData();
        } catch (err) {
            errorMsg.textContent = err.message;
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitText.textContent = editingProductId ? 'Guardar Cambios' : 'Publicar Lote';
        }
    });

    await loadProducerData();
}

async function loadProducerData() {
    await loadOrders();
    await loadProducts();
}

async function loadOrders() {
    const listContainer = document.getElementById('producer-orders-list');
    const countBadge = document.getElementById('producer-orders-count');
    if (!listContainer) return;

    try {
        const res = await api.getProducerOrders();
        const allOrders = res.pedidos || [];

        // RF-10: mapa de no leídos por pedido (best-effort, no bloquea la lista)
        let unreadMap = {};
        try {
            const unreadRes = await api.getUnreadMessages();
            (unreadRes.no_leidos || []).forEach(u => { unreadMap[u.pedido_id] = u.no_leidos; });
        } catch (e) { /* sin insignias si falla */ }
        let orders = allOrders;

        // Aplicar filtro de tab
        if (orderFilter !== 'all') {
            orders = allOrders.filter(o => o.estado === orderFilter);
        }

        countBadge.textContent = `${orders.length} de ${allOrders.length} orden(es)`;

        if (orders.length === 0) {
            listContainer.innerHTML = `
                <div class="bg-white rounded-xl border border-border p-8 text-center">
                    <span class="material-symbols-outlined text-[40px] mb-2" style="color: var(--color-primary);">inbox</span>
                    <p class="text-sm font-semibold text-on-surface mb-1">No hay pedidos en esta categoría</p>
                    <p class="text-xs text-text-secondary">Selecciona otro filtro o espera que compradores realicen pedidos de tus cosechas.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = orders.map(ord => {
            const isPending = ord.estado === 'Pendiente';
            const isInProcess = ord.estado === 'En Proceso';
            const isDelivered = ord.estado === 'Entregado';
            const isCancelled = ord.estado === 'Cancelado';

            let badgeClass = 'badge-pendiente';
            let badgeIcon = 'hourglass_top';
            if (isInProcess) { badgeClass = 'badge-proceso'; badgeIcon = 'local_shipping'; }
            if (isDelivered) { badgeClass = 'badge-entregado'; badgeIcon = 'check_circle'; }
            if (isCancelled) { badgeClass = 'badge-cancelado'; badgeIcon = 'cancel'; }

            const dateStr = new Date(ord.created_at).toLocaleDateString('es-CO', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            return `
                <div class="bg-white rounded-xl border ${isCancelled ? 'border-red-200 opacity-70' : 'border-border'} p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="space-y-1 flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-sm text-on-surface">#DCM-${ord.id}</span>
                            <span class="badge-status ${badgeClass}">
                                <span class="material-symbols-outlined text-[13px]">${badgeIcon}</span>
                                ${ord.estado}
                            </span>
                            <span class="text-[11px] text-text-secondary">${dateStr}</span>
                        </div>
                        <p class="text-xs text-text-secondary">
                            Comprador: <strong class="text-on-surface">${ord.comprador_nombre}</strong>
                            ${ord.comprador_telefono ? `· <a href="tel:${ord.comprador_telefono}" class="text-primary hover:underline" style="color:var(--color-primary);">${ord.comprador_telefono}</a>` : ''}
                        </p>
                        <p class="text-xs text-text-secondary truncate">
                            📍 ${ord.direccion_entrega}
                        </p>
                        <div class="text-xs text-on-surface font-medium pt-1">
                            ${(ord.items || []).map(i => `<span class="inline-block bg-[#F5F3F3] px-2 py-0.5 rounded-md mr-1 mb-1">${i.cantidad} ${i.unidad_medida || 'Kg'} de <strong>${i.producto_nombre}</strong></span>`).join('')}
                        </div>
                        ${threadToggleHTML(ord.id, unreadMap[ord.id] || 0)}
                    </div>

                    <!-- Transición Secuencial de Estados (RF-05) -->
                    <div class="shrink-0 flex items-center gap-2">
                        ${isPending ? `
                            <button class="btn-advance-order btn-institutional text-xs px-3 py-2" data-id="${ord.id}" data-next="En Proceso">
                                <span class="material-symbols-outlined text-[16px]">local_shipping</span>
                                En Proceso
                            </button>
                        ` : (isInProcess ? `
                            <button class="btn-advance-order btn-primary-cta text-xs px-3 py-2" data-id="${ord.id}" data-next="Entregado">
                                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                                Entregado
                            </button>
                        ` : isCancelled ? `
                            <span class="text-xs text-red-600 font-bold flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">cancel</span>
                                Cancelado
                            </span>
                        ` : `
                            <span class="text-xs text-green-700 font-bold flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">verified</span>
                                Entregado
                            </span>
                        `)}
                    </div>
                </div>
            `;
        }).join('');

        // Listeners para avanzar estado (RF-05)
        listContainer.querySelectorAll('.btn-advance-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-id');
                const nextState = btn.getAttribute('data-next');

                const confirmed = await confirmDialog({
                    title: `¿Actualizar a "${nextState}"?`,
                    text: `El pedido #DCM-${orderId} cambiará a estado "${nextState}" y se notificará al comprador por correo.`,
                    confirmButtonText: `Sí, marcar como ${nextState}`,
                    confirmButtonColor: nextState === 'Entregado' ? '#2E7D32' : '#1976D2'
                });
                if (!confirmed) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Actualizando...';
                    await api.updateOrderStatus(orderId, nextState);
                    showToast(`✅ Pedido #DCM-${orderId} marcado como "${nextState}". El comprador fue notificado.`, 'success');
                    await loadOrders();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                }
            });
        });

        // Hilo de mensajes (RF-10)
        attachThreadToggles(listContainer);

    } catch (err) {
        listContainer.innerHTML = `
            <div class="p-4 bg-red-50 rounded-xl border border-red-200">
                <p class="text-xs text-red-600">${err.message}</p>
            </div>
        `;
    }
}

async function loadProducts() {
    const listContainer = document.getElementById('producer-products-list');
    const countBadge = document.getElementById('producer-products-count');
    if (!listContainer) return;

    try {
        const res = await api.getMyProducts();
        const products = res.productos || [];
        countBadge.textContent = `${products.length} producto(s)`;

        if (products.length === 0) {
            listContainer.innerHTML = `
                <div class="col-span-full bg-white rounded-xl border border-border p-6 text-center text-xs text-text-secondary">
                    Aún no has publicado cosechas. Haz clic en "Publicar Nueva Cosecha" para comenzar.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = products.map(p => `
            <div class="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div class="flex items-start gap-3">
                    <img src="${p.foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'}" 
                         onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'"
                         class="w-16 h-16 rounded-lg object-cover shrink-0 bg-[#F5F3F3]" alt="${p.nombre}">
                    <div class="min-w-0 flex-1">
                        <span class="text-[11px] font-bold text-primary block" style="color: var(--color-primary);">${p.categoria_nombre}</span>
                        <h4 class="font-bold text-sm text-on-surface truncate">${p.nombre}</h4>
                        <span class="text-xs font-extrabold text-on-surface block mt-0.5">$${Number(p.precio).toLocaleString('es-CO')} / ${p.unidad_medida}</span>
                        <span class="text-[11px] ${p.cantidad_disponible > 0 ? 'text-green-700' : 'text-red-600'} font-semibold block">
                            Stock: ${p.cantidad_disponible} ${p.unidad_medida}
                        </span>
                    </div>
                </div>

                <div class="pt-2 border-t border-border flex items-center justify-end gap-2">
                    <button class="btn-edit-prod text-xs text-primary hover:text-green-800 font-semibold flex items-center gap-1 p-1" data-id="${p.id}">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                    </button>
                    <button class="btn-delete-prod text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 p-1" data-id="${p.id}" data-nombre="${p.nombre}">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');

        // Listeners para Editar Cosecha
        listContainer.querySelectorAll('.btn-edit-prod').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                const prod = products.find(item => item.id === id);
                if (!prod) return;

                editingProductId = prod.id;
                document.getElementById('p-nombre').value = prod.nombre || '';
                document.getElementById('p-categoria').value = prod.categoria_id || 1;
                document.getElementById('p-unidad').value = prod.unidad_medida || 'Kg';
                document.getElementById('p-precio').value = prod.precio || '';
                document.getElementById('p-stock').value = prod.cantidad_disponible || '';
                document.getElementById('p-municipio').value = prod.municipio || '';
                document.getElementById('p-foto').value = prod.foto_url || '';
                document.getElementById('p-descripcion').value = prod.descripcion || '';

                document.getElementById('modal-prod-title').innerHTML = `
                    <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">edit_note</span>
                    Editar Cosecha (#${prod.id})
                `;
                document.getElementById('btn-submit-prod-text').textContent = 'Guardar Cambios';
                document.getElementById('product-error-msg').classList.add('hidden');
                document.getElementById('product-modal')?.classList.remove('hidden');
            });
        });

        // Listeners para Eliminar Cosecha con SweetAlert2
        listContainer.querySelectorAll('.btn-delete-prod').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nombre = btn.getAttribute('data-nombre') || 'este producto';

                const confirmed = await confirmDialog({
                    title: '¿Eliminar cosecha?',
                    text: `¿Estás seguro de eliminar "${nombre}" del catálogo público?`,
                    confirmButtonText: 'Sí, eliminar',
                    confirmButtonColor: '#d32f2f'
                });
                if (!confirmed) return;

                try {
                    await api.deleteProduct(id);
                    showToast('Publicación eliminada correctamente.', 'success');
                    await loadProducts();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

    } catch (err) {
        listContainer.innerHTML = `<p class="text-xs text-red-500">${err.message}</p>`;
    }
}
