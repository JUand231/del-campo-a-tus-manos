/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/checkoutView.js
 * DESCRIPCIÓN: Confirmación del carrito (épica K, ticket K4)
 * - Un pedido por productor (secuencial): conserva RF-05/06 por pedido.
 * - Si un grupo falla (stock/carrera), los demás igual se confirman
 *   y solo quedan en el carrito los pendientes con su error.
 * ==========================================================
 */

import { api } from '../api.js';
import { cart } from '../cart.js';
import { store, showToast } from '../store.js';

// Se conserva lo digitado si hay un fallo parcial y se vuelve atrás.
let formState = { direccion: '', telefono: '', notas: '', metodo: 'contra_entrega', referencia: '' };

export async function renderCheckout(container, results = null) {
    if (cart.getCart().length === 0 && !results) {
        window.location.hash = '#/carrito';
        return;
    }

    if (!store.getUser()) {
        container.innerHTML = `
            <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-16 flex flex-col items-center justify-center text-center">
                <div class="w-20 h-20 rounded-full flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                    <span class="material-symbols-outlined text-[40px]" style="color: var(--color-primary);">login</span>
                </div>
                <h1 class="text-xl font-bold text-on-surface mb-2">Inicia sesión para confirmar tu compra</h1>
                <p class="text-sm max-w-md mb-6" style="color: var(--color-text-secondary);">Tu carrito está guardado y te estará esperando. Necesitamos tu cuenta para generar los pedidos y notificarte por correo.</p>
                <button id="btn-checkout-login" class="btn-institutional text-xs">Ingresar o registrarme</button>
            </div>
        `;
        container.querySelector('#btn-checkout-login')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
        });
        const onAuth = () => {
            window.removeEventListener('auth-changed', onAuth);
            renderCheckout(container);
        };
        window.addEventListener('auth-changed', onAuth);
        return;
    }

    if (results) {
        renderResults(container, results);
        return;
    }

    const groups = cart.groupByProducer();
    const total = cart.total();

    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
            <h1 class="text-xl font-bold text-on-surface mb-1">Confirmar compra</h1>
            <p class="text-xs text-text-secondary mb-6">Se generará un pedido por productor (${groups.length} en total).</p>

            <div class="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5 mb-6">
                <h2 class="font-bold text-sm text-on-surface mb-3">Método de pago</h2>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label data-method-card="contra_entrega" class="cursor-pointer rounded-xl border-2 border-border p-3 flex gap-2 items-start">
                        <input type="radio" name="pay-method" value="contra_entrega" class="mt-1" ${formState.metodo !== 'transferencia' ? 'checked' : ''}>
                        <span>
                            <span class="text-xs font-bold text-on-surface block">Pago contra entrega</span>
                            <span class="text-[11px] text-text-secondary">Pagas en efectivo al recibir tus cosechas.</span>
                        </span>
                    </label>
                    <label data-method-card="transferencia" class="cursor-pointer rounded-xl border-2 border-border p-3 flex gap-2 items-start">
                        <input type="radio" name="pay-method" value="transferencia" class="mt-1" ${formState.metodo === 'transferencia' ? 'checked' : ''}>
                        <span>
                            <span class="text-xs font-bold text-on-surface block">Transferencia / Nequi</span>
                            <span class="text-[11px] text-text-secondary">Escríbenos la referencia del comprobante.</span>
                        </span>
                    </label>
                    <div class="rounded-xl border-2 border-dashed border-border p-3 flex gap-2 items-start opacity-60">
                        <input type="radio" disabled class="mt-1">
                        <span>
                            <span class="text-xs font-bold text-on-surface block">Tarjeta en línea
                                <span class="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style="background-color: var(--color-primary-container); color: var(--color-primary);">Próximamente · Fase 2</span>
                            </span>
                            <span class="text-[11px] text-text-secondary">Los pagos con tarjeta llegarán en la Fase 2.</span>
                        </span>
                    </div>
                </div>
                <div id="co-ref-wrap" class="${formState.metodo === 'transferencia' ? '' : 'hidden'} mt-3">
                    <label class="text-xs font-bold text-text-secondary block mb-1">Referencia / Nº de comprobante *</label>
                    <input id="co-ref" type="text" value="${formState.referencia}" placeholder="Ej. Nequi 812345"
                           class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div class="lg:col-span-7 bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5">
                    <h2 class="font-bold text-sm text-on-surface mb-4">Datos de entrega</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Dirección de entrega *</label>
                            <input id="co-address" type="text" required minlength="5" value="${formState.direccion}"
                                   placeholder="Calle, carrera, apartamento, ciudad"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Teléfono de contacto *</label>
                            <input id="co-phone" type="tel" required minlength="7" value="${formState.telefono}"
                                   placeholder="+57 300 000 0000"
                                   class="w-full h-11 px-3 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-text-secondary block mb-1">Notas (opcional)</label>
                            <textarea id="co-notes" rows="2" placeholder="Horario, portería, indicaciones..."
                                      class="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:border-primary">${formState.notas}</textarea>
                        </div>
                        <div id="co-error" class="text-xs text-red-600 font-semibold hidden"></div>
                    </div>
                </div>

                <div class="lg:col-span-5 bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5">
                    <h2 class="font-bold text-sm text-on-surface mb-3">Resumen por productor</h2>
                    ${groups.map(g => `
                        <div class="py-2 border-b border-border last:border-0">
                            <div class="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                                <span class="material-symbols-outlined text-[16px]" style="color: var(--color-primary);">agriculture</span>
                                ${g.productor_nombre} · ${g.items.length} producto(s)
                            </div>
                            <div class="text-right text-xs font-bold mt-1">Subtotal: $${g.subtotal.toLocaleString('es-CO')}</div>
                        </div>
                    `).join('')}
                    <div class="flex items-center justify-between pt-3 mt-1">
                        <span class="text-xs text-text-secondary">Total</span>
                        <span class="text-xl font-extrabold" style="color: var(--color-primary);">$${total.toLocaleString('es-CO')}</span>
                    </div>
                    <button id="btn-confirm-orders" class="btn-primary-cta w-full h-11 text-xs font-bold mt-4">
                        Confirmar ${groups.length > 1 ? `${groups.length} pedidos` : 'pedido'}
                    </button>
                    <a href="#/carrito" class="block text-center text-[11px] text-text-secondary hover:text-primary underline mt-2">Volver al carrito</a>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#btn-confirm-orders')?.addEventListener('click', confirmAll);

    // K5: resalta el método elegido y muestra/oculta la referencia.
    const paintMethods = () => {
        const sel = (container.querySelector('input[name="pay-method"]:checked') || {}).value;
        container.querySelectorAll('[data-method-card]').forEach(card => {
            const active = card.getAttribute('data-method-card') === sel;
            card.style.borderColor = active ? 'var(--color-primary)' : '';
            card.style.backgroundColor = active ? 'var(--color-primary-container)' : '';
        });
        document.getElementById('co-ref-wrap')?.classList.toggle('hidden', sel !== 'transferencia');
    };
    container.querySelectorAll('input[name="pay-method"]').forEach(r => r.addEventListener('change', paintMethods));
    paintMethods();
}

async function confirmAll() {
    const btn = document.getElementById('btn-confirm-orders');
    const errorDiv = document.getElementById('co-error');
    const direccion = document.getElementById('co-address').value.trim();
    const telefono = document.getElementById('co-phone').value.trim();
    const notas = document.getElementById('co-notes').value.trim();
    const metodo = (document.querySelector('input[name="pay-method"]:checked') || {}).value || 'contra_entrega';
    const refInput = document.getElementById('co-ref');
    const referencia = refInput ? refInput.value.trim() : '';
    formState = { direccion, telefono, notas, metodo, referencia };

    if (direccion.length < 5) {
        errorDiv.textContent = 'La dirección de entrega es obligatoria (mínimo 5 caracteres).';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (telefono.length < 7) {
        errorDiv.textContent = 'El teléfono de contacto es obligatorio (mínimo 7 dígitos).';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (metodo === 'transferencia' && referencia.length < 4) {
        errorDiv.textContent = 'Escribe la referencia o número de comprobante de tu transferencia (mínimo 4 caracteres).';
        errorDiv.classList.remove('hidden');
        return;
    }
    // K5: el método queda trazado en las notas (cero cambios de backend).
    const metodoTag = metodo === 'transferencia'
        ? `Método: Transferencia/Nequi — Ref: ${referencia}`
        : 'Método: Pago contra entrega';
    const notasFinal = notas ? `${notas} | ${metodoTag}` : metodoTag;
    errorDiv.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Procesando pedidos...';

    const groups = cart.groupByProducer();
    const results = [];
    const succeededIds = [];
    for (const g of groups) {
        const items = g.items.map(l => ({ producto_id: l.producto_id, cantidad: l.cantidad }));
        try {
            const res = await api.createOrder({ direccion_entrega: direccion, telefono_contacto: telefono, notas: notasFinal, items });
            results.push({ ok: true, productor: g.productor_nombre, pedidoId: res.pedidoId, total: res.total });
            g.items.forEach(l => succeededIds.push(Number(l.producto_id)));
        } catch (err) {
            results.push({ ok: false, productor: g.productor_nombre, message: err.message });
        }
    }

    if (succeededIds.length > 0 && results.some(r => !r.ok)) {
        // Éxito parcial: del carrito salen solo los grupos confirmados.
        cart.syncLines(cart.getCart().filter(l => !succeededIds.includes(Number(l.producto_id))));
    } else if (results.every(r => r.ok)) {
        cart.clear();
    }

    const container = document.getElementById('app-main');
    renderCheckout(container, results);
}

function renderResults(container, results) {
    const failed = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    if (failed.length === 0) {
        container.innerHTML = `
            <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-16 flex flex-col items-center justify-center text-center">
                <div class="w-20 h-20 rounded-full flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                    <span class="material-symbols-outlined text-[40px]" style="color: var(--color-primary);">check_circle</span>
                </div>
                <h1 class="text-2xl font-extrabold text-on-surface mb-2">¡Tus pedidos fueron realizados con éxito!</h1>
                <p class="text-sm max-w-md mb-6" style="color: var(--color-text-secondary);">Recibirás un correo por cada cambio de estado. Puedes seguirlos en Mis Pedidos.</p>
                <div class="w-full max-w-md bg-white rounded-2xl border border-border shadow-sm p-4 mb-6 text-left space-y-2">
                    ${succeeded.map(r => `
                        <div class="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                            <span class="font-bold text-on-surface">Pedido #DCM-${r.pedidoId} · ${r.productor}</span>
                            <span class="font-extrabold" style="color: var(--color-primary);">$${Number(r.total).toLocaleString('es-CO')}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="flex flex-col sm:flex-row gap-2">
                    <a href="#/mis-pedidos" class="btn-institutional text-xs text-center">Ver Mis Pedidos</a>
                    <a href="#/catalogo" class="btn-outline text-xs text-center">Volver al Catálogo</a>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8">
            <h1 class="text-xl font-bold text-on-surface mb-1">Compra parcial</h1>
            <p class="text-xs text-text-secondary mb-6">Algunos pedidos se confirmaron y otros no. Revisa el detalle:</p>
            <div class="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-5 mb-4 space-y-3">
                ${results.map(r => r.ok ? `
                    <div class="flex items-center gap-2 text-xs p-3 rounded-xl bg-green-50 border border-green-200">
                        <span class="material-symbols-outlined text-green-700">check_circle</span>
                        <span><strong>Pedido #DCM-${r.pedidoId}</strong> (${r.productor}) confirmado por $${Number(r.total).toLocaleString('es-CO')}.</span>
                    </div>
                ` : `
                    <div class="flex items-center gap-2 text-xs p-3 rounded-xl bg-red-50 border border-red-200">
                        <span class="material-symbols-outlined text-red-600">error</span>
                        <span><strong>${r.productor}:</strong> ${r.message}</span>
                    </div>
                `).join('')}
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
                <a href="#/checkout" class="btn-primary-cta text-xs text-center" id="btn-retry-checkout">Reintentar pendientes</a>
                <a href="#/mis-pedidos" class="btn-outline text-xs text-center">Ver Mis Pedidos</a>
            </div>
        </div>
    `;
}
