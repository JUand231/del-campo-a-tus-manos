/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/app.js
 * DESCRIPCIÓN: Enrutador dinámico SPA, barra de navegación y ciclo de vida de la UI
 * ==========================================================
 */

import { store, showToast } from './store.js';
import { api } from './api.js';
import { cart } from './cart.js';
import { initAuthModal } from './views/authModal.js';
import { renderCatalog } from './views/catalogView.js';
import { renderProductDetail } from './views/productDetailView.js';
import { renderOrders } from './views/ordersView.js';
import { renderProducer } from './views/producerView.js';
import { renderAdmin } from './views/adminView.js';
import { renderCart } from './views/cartView.js';
import { renderCheckout } from './views/checkoutView.js';

const appContainer = document.getElementById('app-main');

// Definición de Rutas SPA
async function handleRouting() {
    const hash = window.location.hash || '#/catalogo';
    updateNavbarState();

    if (hash.startsWith('#/producto/')) {
        const id = hash.split('/')[2];
        await renderProductDetail(appContainer, id);
    } else if (hash === '#/mis-pedidos') {
        await renderOrders(appContainer);
    } else if (hash === '#/productor') {
        await renderProducer(appContainer);
    } else if (hash === '#/admin') {
        await renderAdmin(appContainer);
    } else if (hash === '#/como-funciona') {
        renderHowItWorks(appContainer);
    } else if (hash === '#/faq') {
        renderFAQ(appContainer);
    } else if (hash === '#/terms' || hash === '#/terminos') {
        renderTerms(appContainer);
    } else if (hash === '#/privacy' || hash === '#/privacidad') {
        renderPrivacy(appContainer);
    } else if (hash === '#/catalogo' || hash === '#/' || hash === '#') {
        await renderCatalog(appContainer);
    } else if (hash === '#/carrito') {
        await renderCart(appContainer);
    } else if (hash === '#/checkout') {
        await renderCheckout(appContainer);
    } else {
        renderNotFound(appContainer);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Vista 404 personalizada (RULES.md: HTTP-404)
function renderNotFound(container) {
    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-16 flex flex-col items-center justify-center text-center">
            <div class="w-20 h-20 rounded-full flex items-center justify-center mb-4" style="background-color: var(--color-primary-container);">
                <span class="material-symbols-outlined text-[40px]" style="color: var(--color-primary);">search_off</span>
            </div>
            <h1 class="text-2xl font-extrabold text-on-surface mb-2">Página no encontrada (404)</h1>
            <p class="text-sm max-w-md mb-6" style="color: var(--color-text-secondary);">
                La dirección que buscas no existe o fue movida. Te invitamos a volver al catálogo de cosechas.
            </p>
            <a href="#/catalogo" class="btn-institutional text-xs">Volver al Catálogo</a>
        </div>
    `;
}

// Carrito: badge con unidades en el header global (K2)
function updateCartBadge() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;
    const units = cart.units();
    badge.textContent = units > 99 ? '99+' : String(units);
    badge.classList.toggle('hidden', units === 0);
    badge.classList.toggle('flex', units > 0);
}
window.addEventListener('cart-changed', updateCartBadge);
updateCartBadge();

// Actualiza botones y accesos según estado de sesión y rol
function updateNavbarState() {
    const user = store.getUser();
    const navAuthContainer = document.getElementById('nav-auth-actions');
    const producerLink = document.getElementById('nav-producer-link');
    const adminLink = document.getElementById('nav-admin-link');
    const ordersLink = document.getElementById('nav-orders-link');

    if (!navAuthContainer) return;

    if (user) {
        // Usuario Autenticado
        producerLink?.classList.toggle('hidden', !store.isProducer() && !store.isAdmin());
        adminLink?.classList.toggle('hidden', !store.isAdmin());
        ordersLink?.classList.toggle('hidden', !store.isBuyer() && !store.isAdmin());

        navAuthContainer.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="text-right hidden sm:block">
                    <span class="text-xs font-bold text-on-surface block leading-tight truncate max-w-[140px]">${user.nombre}</span>
                    <span class="text-[10px] font-semibold text-primary block leading-none uppercase" style="color: var(--color-primary);">${user.rol_nombre}</span>
                </div>
                <button id="btn-logout" class="btn-outline text-xs px-2.5 py-1.5 flex items-center gap-1" title="Cerrar Sesión">
                    <span class="material-symbols-outlined text-[16px]">logout</span>
                    <span class="hidden md:inline">Salir</span>
                </button>
            </div>
        `;

        document.getElementById('btn-logout')?.addEventListener('click', async () => {
            try {
                await api.logout(); // D5: invalida la cookie HttpOnly en el servidor
            } catch (e) {
                // best-effort: aunque falle la red, se limpia el estado local
            }
            store.clearSession();
            showToast('Has cerrado sesión satisfactoriamente.', 'success');
            window.location.hash = '#/catalogo';
        });

    } else {
        // Visitante
        producerLink?.classList.add('hidden');
        adminLink?.classList.add('hidden');
        ordersLink?.classList.add('hidden');

        navAuthContainer.innerHTML = `
            <button id="btn-open-login" class="btn-outline text-xs px-3 py-1.5">
                Ingresar
            </button>
            <button id="btn-open-register" class="btn-primary-cta text-xs px-3 py-1.5 shadow-sm">
                Registrarse
            </button>
        `;

        document.getElementById('btn-open-login')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'login' } }));
        });

        document.getElementById('btn-open-register')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'register' } }));
        });
    }
}

// Vistas Informativas y Legales (RULES.md: FAQ, T&C, GDPR/RGPD)
function renderHowItWorks(container) {
    container.innerHTML = `
        <div class="max-w-[1000px] mx-auto w-full px-4 sm:px-8 py-12 space-y-8">
            <div class="text-center max-w-2xl mx-auto">
                <h1 class="text-3xl font-extrabold text-on-surface mb-2">¿Cómo funciona Del Campo a Tus Manos?</h1>
                <p class="text-sm text-text-secondary">Un circuito transparente que elimina intermediarios especulativos y garantiza precio justo para el campesino.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-border shadow-sm text-center space-y-3">
                    <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style="background-color: var(--color-primary-container);">
                        <span class="material-symbols-outlined text-[24px]" style="color: var(--color-primary);">agriculture</span>
                    </div>
                    <h3 class="font-bold text-base">1. El Campesino Cosecha</h3>
                    <p class="text-xs text-text-secondary leading-relaxed">El productor publica directamente los lotes listos en su finca con precio y disponibilidad en tiempo real.</p>
                </div>
                <div class="bg-white p-6 rounded-2xl border border-border shadow-sm text-center space-y-3">
                    <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style="background-color: var(--color-secondary-container);">
                        <span class="material-symbols-outlined text-[24px]" style="color: var(--color-secondary);">shopping_basket</span>
                    </div>
                    <h3 class="font-bold text-base">2. Tú Pides Directo</h3>
                    <p class="text-xs text-text-secondary leading-relaxed">Eliges alimentos frescos recolectados en su punto óptimo de maduración sin sobrecostos de plazas intermediarias.</p>
                </div>
                <div class="bg-white p-6 rounded-2xl border border-border shadow-sm text-center space-y-3">
                    <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style="background-color: var(--color-tertiary-container);">
                        <span class="material-symbols-outlined text-[24px]" style="color: var(--color-tertiary);">local_shipping</span>
                    </div>
                    <h3 class="font-bold text-base">3. Entrega y Confianza</h3>
                    <p class="text-xs text-text-secondary leading-relaxed">El productor alista tu canastilla, actualiza el estado y recibes producto del campo garantizado.</p>
                </div>
            </div>
        </div>
    `;
}

function renderFAQ(container) {
    container.innerHTML = `
        <div class="max-w-[800px] mx-auto w-full px-4 sm:px-8 py-12 space-y-6">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-on-surface mb-2">Preguntas Frecuentes (FAQ)</h1>
            <div class="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4 text-sm">
                <div>
                    <h3 class="font-bold text-on-surface mb-1">¿Cómo se garantiza que el dinero llega al productor?</h3>
                    <p class="text-xs text-text-secondary">La plataforma conecta sin comisiones abusivas directamente la oferta del agricultor con el comprador.</p>
                </div>
                <div class="pt-3 border-t border-border">
                    <h3 class="font-bold text-on-surface mb-1">¿Puedo cancelar un pedido realizado?</h3>
                    <p class="text-xs text-text-secondary">Sí. Conforme a la regla RF-06, puedes cancelar tu pedido en línea mientras se encuentre en estado 'Pendiente'. El stock se devuelve inmediatamente al catálogo.</p>
                </div>
                <div class="pt-3 border-t border-border">
                    <h3 class="font-bold text-on-surface mb-1">¿Qué sucede si un producto se queda sin stock?</h3>
                    <p class="text-xs text-text-secondary">Por regla RF-03, los productos con stock 0 se excluyen automáticamente del catálogo público para evitar compras no despachables.</p>
                </div>
            </div>
        </div>
    `;
}

function renderTerms(container) {
    container.innerHTML = `
        <div class="max-w-[800px] mx-auto w-full px-4 sm:px-8 py-12 space-y-4">
            <h1 class="text-2xl font-extrabold text-on-surface">Términos y Condiciones de Uso</h1>
            <div class="bg-white p-6 rounded-2xl border border-border shadow-sm text-xs text-text-secondary space-y-3 leading-relaxed">
                <p>Bienvenido a <strong>Del Campo a Tus Manos</strong>. Al acceder y utilizar este servicio, aceptas cumplir los presentes términos de honestidad y comercio justo.</p>
                <p>1. <strong>Identidad y Roles:</strong> Cada usuario es responsable de la veracidad de la información ingresada al registrarse como Comprador o Productor Agrícola.</p>
                <p>2. <strong>Prohibición de Auto-compra:</strong> Los productores no pueden generar órdenes de compra sobre sus propias publicaciones agrícolas (RF-04).</p>
                <p>3. <strong>Moderación Administrativa:</strong> La plataforma se reserva el derecho de desactivar cuentas o retirar publicaciones que incumplan las normas (RF-08).</p>
            </div>
        </div>
    `;
}

function renderPrivacy(container) {
    container.innerHTML = `
        <div class="max-w-[800px] mx-auto w-full px-4 sm:px-8 py-12 space-y-4">
            <h1 class="text-2xl font-extrabold text-on-surface">Política de Privacidad y Protección de Datos</h1>
            <div class="bg-white p-6 rounded-2xl border border-border shadow-sm text-xs text-text-secondary space-y-3 leading-relaxed">
                <p>En cumplimiento con las directrices de privacidad y normatividad vigente, tus datos de contacto (teléfono, dirección y correo) son utilizados exclusivamente para la coordinación logística y el despacho de cosechas agrícolas.</p>
                <p>Las contraseñas se almacenan de manera unidireccional y cifrada exclusivamente mediante el estándar bcrypt.</p>
            </div>
        </div>
    `;
}

// Inicialización de la aplicación
function initApp() {
    initAuthModal();
    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('auth-changed', () => {
        updateNavbarState();
        handleRouting();
    });

    // Menú Móvil Hamburger
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const closeDrawerBtn = document.getElementById('btn-close-drawer');

    menuBtn?.addEventListener('click', () => {
        mobileDrawer?.classList.remove('hidden');
    });

    closeDrawerBtn?.addEventListener('click', () => {
        mobileDrawer?.classList.add('hidden');
    });

    mobileDrawer?.querySelectorAll('a')?.forEach(link => {
        link.addEventListener('click', () => {
            mobileDrawer?.classList.add('hidden');
        });
    });

    handleRouting();
}

document.addEventListener('DOMContentLoaded', initApp);
