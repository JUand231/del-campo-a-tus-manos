/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/cartView.js
 * DESCRIPCIÓN: Vista del carrito (épica K, ticket K3)
 * - Verifica precio/stock reales por línea al abrir.
 * - Agrupa por productor (el split se confirma en K4).
 * - Estados loading/empty/error (USER_FLOW §6).
 * ==========================================================
 */

import { api } from '../api.js';
import { cart } from '../cart.js';
import { store, showToast, confirmDialog } from '../store.js';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80';

export async function renderCart(container) {
    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-xl font-bold text-on-surface">Mi Carrito</h1>
                <span class="text-xs font-medium text-text-secondary" id="cart-count-label">Verificando disponibilidad...</span>
            </div>
            <div id="cart-body">
                ${[1, 2].map(() => `
                    <div class="bg-white rounded-2xl border border-border p-4 mb-4 space-y-3">
                        <div class="skeleton h-5 w-1/3"></div>
                        <div class="skeleton h-16 w-full"></div>
                        <div class="skeleton h-4 w-1/4 ml-auto"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    await refreshAndRender();
}

async function refreshAndRender() {
    const body = document.getElementById('cart-body');
    const label = document.getElementById('cart-count-label');
    if (!body) return;

    let lines = cart.getCart();
    if (lines.length === 0) {
        renderEmpty(body, label);
        return;
    }

    // Verificar precio y stock reales por línea antes de mostrar
    try {
        const fresh = await Promise.all(
            lines.map(l => api.getProductById(l.producto_id).then(r => r.producto).catch(() => null))
        );
        const kept = [];
        for (let i = 0; i < lines.length; i++) {
            const prod = fresh[i];
            const line = lines[i];
            if (!prod) {
                showToast(`"${line.nombre}" ya no está disponible y se retiró del carrito.`, 'info');
                continue;
            }
            line.nombre = prod.nombre;
            line.precio = Number(prod.precio);
            line.foto_url = prod.foto_url || line.foto_url;
            const stock = Number(prod.cantidad_disponible);
            if (!Number.isFinite(stock) || stock <= 0) {
                showToast(`"${line.nombre}" se agotó y se retiró del carrito.`, 'info');
                continue;
            }
            if (Number(line.cantidad) > stock) {
                line.cantidad = stock;
                showToast(`Ajustamos "${line.nombre}" al stock disponible (${stock}).`, 'info');
            }
            line.stock_actual = stock;
            kept.push(line);
        }
        lines = cart.syncLines(kept);
    } catch (err) {
        body.innerHTML = `
            <div class="p-8 text-center bg-red-50 rounded-xl border border-red-200">
                <span class="material-symbols-outlined text-red-500 text-3xl mb-2">error</span>
                <p class="text-sm font-semibold text-red-700 mb-1">No pudimos verificar tu carrito</p>
                <p class="text-xs text-red-600 mb-4">${err.message}</p>
                <button id="btn-retry-cart" class="btn-outline text-xs">Reintentar</button>
            </div>
        `;
        body.querySelector('#btn-retry-cart')?.addEventListener('click', refreshAndRender);
        return;
    }

    if (lines.length === 0) {
        renderEmpty(body, label);
        return;
    }
    renderGroups(body, label);
}

function renderEmpty(body, label) {
    if (label) label.textContent = '0 unidades';
    body.innerHTML = `
        <div class="py-16 flex flex-col items-center justify-center text-center">
            <div class="w-20 h-20 rounded-full flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                <span class="material-symbols-outlined text-[40px]" style="color: var(--color-primary);">shopping_basket</span>
            </div>
            <h2 class="text-lg font-bold text-on-surface mb-2">Tu carrito está vacío</h2>
            <p class="text-sm max-w-md mb-6" style="color: var(--color-text-secondary);">Explora las cosechas frescas del día y agrega tus favoritas sin intermediarios.</p>
            <a href="#/catalogo" class="btn-primary-cta text-xs">Explorar cosechas</a>
        </div>
    `;
}

function renderGroups(body, label) {
    const groups = cart.groupByProducer();
    const total = cart.total();
    const units = cart.units();
    if (label) label.textContent = `${units} unidad(es) · $${total.toLocaleString('es-CO')}`;

    body.innerHTML = `
        ${groups.map(g => `
        <section class="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5 mb-4">
            <div class="flex items-center gap-2 pb-3 border-b border-border mb-1">
                <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">agriculture</span>
                <h2 class="font-bold text-sm text-on-surface">${g.productor_nombre}</h2>
                <span class="text-[11px] text-text-secondary">· Pedido separado al confirmar</span>
            </div>
            ${g.items.map(l => `
            <div class="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <img src="${l.foto_url || FALLBACK_IMG}"
                     onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"
                     class="w-16 h-16 rounded-lg object-cover shrink-0 bg-[#F5F3F3]" alt="${l.nombre}">
                <div class="min-w-0 flex-1">
                    <h3 class="font-bold text-sm text-on-surface truncate">${l.nombre}</h3>
                    <span class="text-xs text-text-secondary">$${Number(l.precio).toLocaleString('es-CO')} / ${l.unidad_medida}</span>
                    <div class="flex items-center gap-2 mt-2">
                        <button data-cart-action="dec" data-id="${l.producto_id}" class="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border border-border font-bold text-base leading-none" aria-label="Quitar uno">−</button>
                        <span class="text-sm font-bold w-10 text-center">${l.cantidad}</span>
                        <button data-cart-action="inc" data-id="${l.producto_id}" class="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border border-border font-bold text-base leading-none" aria-label="Agregar uno">+</button>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-sm font-extrabold">$${(Number(l.cantidad) * Number(l.precio)).toLocaleString('es-CO')}</span>
                    <button data-cart-action="rm" data-id="${l.producto_id}" class="block ml-auto mt-2 text-red-600 text-[11px] font-semibold hover:underline">Retirar</button>
                </div>
            </div>
            `).join('')}
            <div class="text-right text-xs font-bold pt-2">Subtotal: $${g.subtotal.toLocaleString('es-CO')}</div>
        </section>
        `).join('')}
        <div class="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
                <span class="text-xs text-text-secondary block">Total estimado</span>
                <span class="text-2xl font-extrabold" style="color: var(--color-primary);">$${total.toLocaleString('es-CO')}</span>
            </div>
            <div class="flex gap-2">
                <button id="btn-clear-cart" class="btn-outline text-xs">Vaciar</button>
                <a href="#/checkout" class="btn-primary-cta text-xs text-center">Continuar con la compra</a>
            </div>
        </div>
        <p class="text-[11px] text-text-secondary mt-3">Al confirmar se genera un pedido por productor; cada uno avanza de forma independiente.</p>
    `;

    body.querySelectorAll('[data-cart-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(btn.getAttribute('data-id'));
            const act = btn.getAttribute('data-cart-action');
            if (act === 'inc') {
                const line = cart.getCart().find(x => Number(x.producto_id) === id);
                if (!line) return;
                const r = cart.addItem({ ...line, id: line.producto_id }, 1);
                if (!r.ok) showToast(r.message, 'error');
            } else if (act === 'dec') {
                const line = cart.getCart().find(x => Number(x.producto_id) === id);
                if (!line) return;
                cart.updateQty(id, Number(line.cantidad) - 1);
            } else if (act === 'rm') {
                cart.removeItem(id);
                showToast('Producto retirado del carrito.', 'info');
            }
            await refreshAndRender();
        });
    });

    body.querySelector('#btn-clear-cart')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: '¿Vaciar el carrito?',
            text: 'Se quitarán todos los productos seleccionados.',
            confirmButtonText: 'Sí, vaciar',
            confirmButtonColor: '#d32f2f'
        });
        if (ok) {
            cart.clear();
            showToast('Carrito vaciado.', 'info');
            await refreshAndRender();
        }
    });
}
