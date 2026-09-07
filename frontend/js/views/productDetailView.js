/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/productDetailView.js
 * DESCRIPCIÓN: Detalle agronómico de producto y compra transaccional (RF-04)
 * CASOS LÍMITE: Auto-compra bloqueada, validación de stock, selector 44x44px.
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast } from '../store.js';

export async function renderProductDetail(container, productId) {
    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
            <div class="skeleton h-6 w-48 mb-6"></div>
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div class="lg:col-span-6 skeleton aspect-[4/3] rounded-xl"></div>
                <div class="lg:col-span-6 space-y-4">
                    <div class="skeleton h-8 w-3/4"></div>
                    <div class="skeleton h-4 w-1/2"></div>
                    <div class="skeleton h-16 w-full"></div>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await api.getProductById(productId);
        const prod = res.producto;

        const currentUser = store.getUser();
        const isOwner = currentUser && Number(currentUser.id) === Number(prod.productor_id);
        const maxStock = Number(prod.cantidad_disponible);

        container.innerHTML = `
            <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
                <!-- Breadcrumb de Navegación -->
                <nav class="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-6" style="color: var(--color-text-secondary);">
                    <a href="#/catalogo" class="hover:text-primary transition-colors">Catálogo</a>
                    <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                    <span>${prod.categoria_nombre}</span>
                    <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                    <span class="text-on-surface truncate">${prod.nombre}</span>
                </nav>

                <!-- Aviso de Auto-compra si aplica (RF-04 Casos Límite) -->
                ${isOwner ? `
                    <div class="mb-6 p-4 rounded-xl border flex items-start gap-3 shadow-sm" style="background-color: var(--color-warning-bg); border-color: var(--color-warning);">
                        <span class="material-symbols-outlined text-[24px]" style="color: var(--color-warning);">shield_person</span>
                        <div>
                            <h4 class="font-bold text-sm" style="color: var(--color-warning);">Eres el productor titular de este lote agrícola</h4>
                            <p class="text-xs text-text-secondary mt-0.5" style="color: var(--color-text-secondary);">
                                Por reglas de transparencia comercial campesina (RF-04), el sistema prohíbe realizar auto-compras de tus propias publicaciones.
                            </p>
                        </div>
                    </div>
                ` : ''}

                <!-- Vista de 2 Columnas (Estilo Stitch Mockup) -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <!-- Columna Izquierda: Galería y Datos del Productor (6 cols) -->
                    <div class="lg:col-span-6 flex flex-col gap-6">
                        <div class="bg-white rounded-2xl p-4 shadow-sm border border-border">
                            <div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F3F3]">
                                <img id="detail-main-img" src="${prod.foto_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'}" 
                                     onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'"
                                     alt="${prod.nombre}" class="w-full h-full object-cover">
                                <div class="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-white/95 shadow-sm flex items-center gap-1.5"
                                     style="color: var(--color-primary);">
                                    <span class="material-symbols-outlined text-[16px]">eco</span>
                                    Cosecha Fresca de Campo
                                </div>
                            </div>
                        </div>

                        <!-- Ficha de Trazabilidad Campesina -->
                        <div class="bg-white rounded-2xl p-5 shadow-sm border border-border flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style="background-color: var(--color-primary-container);">
                                <span class="material-symbols-outlined text-[24px]" style="color: var(--color-primary);">agriculture</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <span class="text-xs text-text-secondary font-medium block">Familia Productora</span>
                                <h4 class="font-bold text-sm text-on-surface truncate">${prod.productor_nombre}</h4>
                                <span class="text-xs text-primary font-semibold flex items-center gap-1 mt-0.5" style="color: var(--color-primary);">
                                    <span class="material-symbols-outlined text-[14px]">verified</span>
                                    ${prod.municipio} · Cosecha Directa
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Columna Derecha: Especificaciones y Caja de Compra (6 cols) -->
                    <div class="lg:col-span-6 flex flex-col gap-6">
                        <div class="bg-white rounded-2xl p-6 shadow-sm border border-border space-y-5">
                            <div>
                                <span class="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2" 
                                      style="background-color: var(--color-primary-container); color: var(--color-primary);">
                                    ${prod.categoria_nombre}
                                </span>
                                <h1 class="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight mb-2">
                                    ${prod.nombre}
                                </h1>
                                <p class="text-sm text-text-secondary leading-relaxed" style="color: var(--color-text-secondary);">
                                    ${prod.descripcion || 'Sin descripción detallada por el momento.'}
                                </p>
                            </div>

                            <!-- Precio y Stock -->
                            <div class="p-4 rounded-xl flex items-center justify-between" style="background-color: #F5F3F3;">
                                <div>
                                    <span class="text-xs text-text-secondary block">Precio por ${prod.unidad_medida}</span>
                                    <span class="text-2xl font-black" style="color: var(--color-primary);">
                                        $${Number(prod.precio).toLocaleString('es-CO')}
                                    </span>
                                </div>
                                <div class="text-right">
                                    <span class="text-xs text-text-secondary block">Stock Disponible</span>
                                    <span class="text-sm font-bold text-on-surface">
                                        ${Number(prod.cantidad_disponible).toLocaleString('es-CO')} ${prod.unidad_medida}
                                    </span>
                                </div>
                            </div>

                            <!-- Selector de Cantidad (44x44px táctil conforme a DESIGN.md) -->
                            <div class="space-y-2">
                                <label class="text-xs font-bold uppercase tracking-wider text-text-secondary block">
                                    Cantidad deseada (${prod.unidad_medida})
                                </label>
                                <div class="flex items-center gap-3">
                                    <div class="flex items-center border border-border rounded-xl bg-white overflow-hidden shadow-sm">
                                        <button id="btn-qty-minus" class="w-11 h-11 flex items-center justify-center text-lg font-bold hover:bg-[#F5F3F3] text-on-surface"
                                                ${maxStock <= 0 ? 'disabled' : ''}>-</button>
                                        <input id="input-qty" type="number" min="1" max="${maxStock}" value="1" 
                                               class="w-16 h-11 text-center font-bold text-base focus:outline-none border-x border-border"
                                               ${maxStock <= 0 ? 'disabled' : ''}>
                                        <button id="btn-qty-plus" class="w-11 h-11 flex items-center justify-center text-lg font-bold hover:bg-[#F5F3F3] text-on-surface"
                                                ${maxStock <= 0 ? 'disabled' : ''}>+</button>
                                    </div>
                                    <div class="text-xs text-text-secondary">
                                        Subtotal: <span id="detail-subtotal" class="font-bold text-sm text-on-surface">$${Number(prod.precio).toLocaleString('es-CO')}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Botón de Compra -->
                            <div class="pt-4 border-t border-border">
                                ${isOwner ? `
                                    <button disabled class="w-full h-11 rounded-xl bg-gray-200 text-gray-400 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
                                        <span class="material-symbols-outlined text-[18px]">block</span>
                                        Auto-compra no permitida
                                    </button>
                                ` : (maxStock <= 0 ? `
                                    <button disabled class="w-full h-11 rounded-xl bg-red-100 text-red-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
                                        <span class="material-symbols-outlined text-[18px]">sentiment_dissatisfied</span>
                                        Producto Agotado
                                    </button>
                                ` : `
                                    <button id="btn-open-order-modal" class="btn-primary-cta w-full h-11 text-sm font-bold shadow-md">
                                        <span>Confirmar y Realizar Pedido</span>
                                        <span class="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
                                    </button>
                                `)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de Confirmación de Pedido (RF-04) -->
            <div id="order-modal" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="flex items-center justify-between pb-3 border-b border-border mb-4">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary text-[22px]" style="color: var(--color-primary);">local_shipping</span>
                            <h3 class="font-bold text-base text-on-surface">Confirmar Compra Directa</h3>
                        </div>
                        <button id="btn-close-modal" class="text-text-secondary hover:text-on-surface">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form id="order-form" class="space-y-4">
                        <!-- Resumen del Alimento -->
                        <div class="p-3.5 rounded-xl border border-border flex items-center justify-between" style="background-color: #F5F3F3;">
                            <div>
                                <h4 class="font-bold text-sm text-on-surface">${prod.nombre}</h4>
                                <span class="text-xs text-text-secondary" id="modal-summary-qty">1 ${prod.unidad_medida}</span>
                            </div>
                            <span class="text-base font-extrabold" style="color: var(--color-primary);" id="modal-summary-total">
                                $${Number(prod.precio).toLocaleString('es-CO')}
                            </span>
                        </div>

                        <!-- Dirección de Entrega -->
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Dirección de Entrega *</label>
                            <input id="order-address" type="text" required placeholder="Ej. Calle 127 # 45-20, Apto 301, Bogotá"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>

                        <!-- Teléfono de Contacto -->
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Teléfono de Contacto *</label>
                            <input id="order-phone" type="tel" required placeholder="Ej. +57 320 111 2233"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                                   value="${currentUser?.telefono || ''}">
                        </div>

                        <!-- Notas Adicionales -->
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Indicaciones especiales (opcional)</label>
                            <textarea id="order-notes" rows="2" placeholder="Ej. Dejar con el vigilante en portería..."
                                      class="w-full p-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"></textarea>
                        </div>

                        <!-- Mensaje de Error Inline (USER_FLOW §6) -->
                        <div id="order-error-msg" class="text-xs text-red-600 font-semibold hidden"></div>

                        <!-- Botones de Acción -->
                        <div class="pt-3 border-t border-border flex items-center justify-end gap-2">
                            <button type="button" id="btn-cancel-modal" class="btn-outline text-xs">Cancelar</button>
                            <button type="submit" id="btn-submit-order" class="btn-primary-cta text-xs">
                                <span id="submit-order-text">Confirmar Pedido</span>
                                <span class="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Interacciones de Cantidad
        const qtyInput = document.getElementById('input-qty');
        const btnMinus = document.getElementById('btn-qty-minus');
        const btnPlus = document.getElementById('btn-qty-plus');
        const subtotalSpan = document.getElementById('detail-subtotal');
        const unitPrice = Number(prod.precio);

        function updateSubtotal() {
            let val = parseFloat(qtyInput.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > maxStock) val = maxStock;
            qtyInput.value = val;
            const sub = val * unitPrice;
            subtotalSpan.textContent = `$${sub.toLocaleString('es-CO')}`;
            document.getElementById('modal-summary-qty').textContent = `${val} ${prod.unidad_medida}`;
            document.getElementById('modal-summary-total').textContent = `$${sub.toLocaleString('es-CO')}`;
        }

        btnMinus?.addEventListener('click', () => {
            let v = parseFloat(qtyInput.value) || 1;
            if (v > 1) {
                qtyInput.value = v - 1;
                updateSubtotal();
            }
        });

        btnPlus?.addEventListener('click', () => {
            let v = parseFloat(qtyInput.value) || 1;
            if (v < maxStock) {
                qtyInput.value = v + 1;
                updateSubtotal();
            } else {
                showToast(`Solo hay ${maxStock} unidades disponibles en stock.`, 'warning');
            }
        });

        qtyInput?.addEventListener('input', updateSubtotal);

        // Modal de Pedido
        const modal = document.getElementById('order-modal');
        const btnOpenModal = document.getElementById('btn-open-order-modal');
        const btnCloseModal = document.getElementById('btn-close-modal');
        const btnCancelModal = document.getElementById('btn-cancel-modal');
        const orderForm = document.getElementById('order-form');
        const errorMsg = document.getElementById('order-error-msg');

        btnOpenModal?.addEventListener('click', () => {
            if (!store.isAuthenticated()) {
                window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
                showToast('Debes iniciar sesión para realizar pedidos.', 'warning');
                return;
            }
            updateSubtotal();
            modal.classList.remove('hidden');
        });

        const closeModal = () => modal.classList.add('hidden');
        btnCloseModal?.addEventListener('click', closeModal);
        btnCancelModal?.addEventListener('click', closeModal);

        // Envío de Pedido (RF-04)
        orderForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.classList.add('hidden');

            const address = document.getElementById('order-address').value.trim();
            const phone = document.getElementById('order-phone').value.trim();
            const notes = document.getElementById('order-notes').value.trim();
            const qty = parseFloat(qtyInput.value);

            const submitBtn = document.getElementById('btn-submit-order');
            submitBtn.disabled = true;
            document.getElementById('submit-order-text').textContent = 'Procesando...';

            try {
                const orderData = {
                    direccion_entrega: address,
                    telefono_contacto: phone,
                    notas: notes,
                    items: [
                        {
                            producto_id: prod.id,
                            cantidad: qty
                        }
                    ]
                };

                const orderRes = await api.createOrder(orderData);

                closeModal();
                showToast('¡Tu pedido fue realizado con éxito! El stock ha sido actualizado.', 'success');

                // Redirigir a "Mis Pedidos" (USER_FLOW §2 paso 6)
                setTimeout(() => {
                    window.location.hash = '#/mis-pedidos';
                }, 1000);

            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.classList.remove('hidden');
                submitBtn.disabled = false;
                document.getElementById('submit-order-text').textContent = 'Confirmar Pedido';
            }
        });

    } catch (err) {
        container.innerHTML = `
            <div class="max-w-[800px] mx-auto py-16 text-center">
                <span class="material-symbols-outlined text-red-500 text-4xl mb-2">error</span>
                <h3 class="text-lg font-bold text-on-surface mb-1">No fue posible cargar el producto</h3>
                <p class="text-xs text-text-secondary mb-4">${err.message}</p>
                <a href="#/catalogo" class="btn-outline text-xs">Volver al Catálogo</a>
            </div>
        `;
    }
}
