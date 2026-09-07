/**
 * ==========================================================
 * PROYECTO: Del Campo a Tus Manos
 * ARCHIVO: frontend/js/views/adminView.js
 * DESCRIPCIÓN: Panel de Administración - Métricas y Moderación (RF-08, RF-09)
 * REGLAS: Métricas de solo lectura (frescura <= 5 min), bloqueo de cuentas.
 * TICKET T-10: 3 estados UI (loading/empty/error) · íconos Material · mensajes ES
 * ==========================================================
 */

import { api } from '../api.js';
import { store, showToast, confirmDialog } from '../store.js';

export async function renderAdmin(container) {
    if (!store.isAuthenticated() || !store.isAdmin()) {
        container.innerHTML = `
            <div class="max-w-[600px] mx-auto py-16 px-4 text-center">
                <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style="background-color: var(--color-error-bg);">
                    <span class="material-symbols-outlined text-[32px]" style="color: var(--color-error);">admin_panel_settings</span>
                </div>
                <h2 class="text-xl font-bold text-on-surface mb-2">Acceso Restringido</h2>
                <p class="text-sm text-text-secondary mb-6">Esta sección requiere credenciales de Administrador General del sistema (RF-08, RF-09).</p>
                <a href="#/catalogo" class="btn-outline text-xs">Volver al Catálogo</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="max-w-[1200px] mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
            <!-- Encabezado del Administrador -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1" style="color: var(--color-primary);">
                        <span class="material-symbols-outlined text-[16px]">shield</span>
                        <span>Panel de Administración Global</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">Supervisión, Métricas y Moderación</h1>
                    <p class="text-xs sm:text-sm text-text-secondary mt-1">
                        Control del estado de cuentas de usuarios, moderación de publicaciones y métricas de impacto.
                    </p>
                </div>
                <button id="btn-refresh-metrics" class="btn-outline text-xs py-2 px-3">
                    <span class="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Actualizar Métricas</span>
                </button>
            </div>

            <!-- Sección 1: Métricas Globales del Sistema (RF-09 - Solo Lectura) -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">analytics</span>
                        Métricas de la Plataforma
                    </h2>
                    <span id="metrics-cache-info" class="text-xs text-text-secondary">Cargando métricas...</span>
                </div>
                <!-- LOADING STATE: skeletons iniciales -->
                <div id="metrics-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="skeleton h-24 rounded-xl"></div>
                    <div class="skeleton h-24 rounded-xl"></div>
                    <div class="skeleton h-24 rounded-xl"></div>
                    <div class="skeleton h-24 rounded-xl"></div>
                </div>
            </section>

            <!-- Sección 2: Moderación de Cuentas de Usuario (RF-08) -->
            <section class="space-y-4 pt-4 border-t border-border">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">manage_accounts</span>
                        Moderación de Usuarios Registrados
                    </h2>
                    <span id="users-count-badge" class="text-xs text-text-secondary font-medium">Cargando...</span>
                </div>
                <div class="bg-white rounded-xl border border-border overflow-x-auto shadow-sm">
                    <table class="w-full text-left text-xs" id="admin-users-table">
                        <thead class="bg-[#F5F3F3] text-text-secondary uppercase font-bold border-b border-border">
                            <tr>
                                <th class="p-3">ID</th>
                                <th class="p-3">Nombre</th>
                                <th class="p-3">Correo</th>
                                <th class="p-3">Rol</th>
                                <th class="p-3">Municipio</th>
                                <th class="p-3">Estado</th>
                                <th class="p-3 text-right">Acción Moderación</th>
                            </tr>
                        </thead>
                        <!-- LOADING STATE: fila de carga -->
                        <tbody id="admin-users-tbody" class="divide-y divide-border">
                            <tr><td colspan="7" class="p-4 text-center text-text-secondary">
                                <span class="skeleton inline-block h-4 w-48 rounded"></span>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Sección 3: Moderación de Publicaciones (RF-08) -->
            <section class="space-y-4 pt-4 border-t border-border">
                <div class="flex items-center justify-between">
                    <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="color: var(--color-primary);">policy</span>
                        Moderación de Publicaciones Agrícolas
                    </h2>
                    <span id="products-count-badge" class="text-xs text-text-secondary font-medium">Cargando...</span>
                </div>
                <div class="bg-white rounded-xl border border-border overflow-x-auto shadow-sm">
                    <table class="w-full text-left text-xs" id="admin-products-table">
                        <thead class="bg-[#F5F3F3] text-text-secondary uppercase font-bold border-b border-border">
                            <tr>
                                <th class="p-3">ID</th>
                                <th class="p-3">Producto</th>
                                <th class="p-3">Productor</th>
                                <th class="p-3">Categoría</th>
                                <th class="p-3">Precio</th>
                                <th class="p-3">Stock</th>
                                <th class="p-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <!-- LOADING STATE: fila de carga -->
                        <tbody id="admin-products-tbody" class="divide-y divide-border">
                            <tr><td colspan="7" class="p-4 text-center text-text-secondary">
                                <span class="skeleton inline-block h-4 w-48 rounded"></span>
                            </td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    `;

    document.getElementById('btn-refresh-metrics')?.addEventListener('click', () => {
        loadMetrics(true);
    });

    await loadMetrics(false);
    await loadUsers();
    await loadProducts();
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTRICAS (RF-09 — solo lectura, caché ≤ 5 min)
// ─────────────────────────────────────────────────────────────────────────────
async function loadMetrics(forceRefresh = false) {
    const grid = document.getElementById('metrics-cards-grid');
    const infoSpan = document.getElementById('metrics-cache-info');
    if (!grid) return;

    // LOADING STATE
    grid.innerHTML = `
        <div class="skeleton h-24 rounded-xl"></div>
        <div class="skeleton h-24 rounded-xl"></div>
        <div class="skeleton h-24 rounded-xl"></div>
        <div class="skeleton h-24 rounded-xl"></div>
    `;

    try {
        const res = await api.getAdminMetrics(forceRefresh);
        const m = res.data;

        if (!m) throw new Error('No se pudieron obtener las métricas del servidor.');

        // Indicador de frescura del caché (RF-09: frescura máxima 5 min)
        infoSpan.textContent = m.origen === 'cache'
            ? `Caché · fresura: ${m.frescura_segundos}s (máx. 5 min)`
            : '⚡ Calculado en tiempo real';

        // DATOS STATE: 4 tarjetas de métricas con tokens de DESIGN.md
        grid.innerHTML = `
            <div class="bg-white p-5 rounded-2xl border border-border shadow-sm space-y-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-text-secondary font-semibold">Usuarios Activos</span>
                    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">group</span>
                </div>
                <span class="text-3xl font-black text-on-surface block">${m.usuarios_activos}</span>
                <span class="text-[11px] font-medium" style="color: var(--color-success);">Compradores y Productores</span>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-border shadow-sm space-y-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-text-secondary font-semibold">Cosechas en Catálogo</span>
                    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">inventory_2</span>
                </div>
                <span class="text-3xl font-black text-on-surface block">${m.productos_publicados}</span>
                <span class="text-[11px] font-medium" style="color: var(--color-primary);">Con stock disponible</span>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-border shadow-sm space-y-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-text-secondary font-semibold">Pedidos Completados</span>
                    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-tertiary);">check_circle</span>
                </div>
                <span class="text-3xl font-black text-on-surface block">${m.pedidos_completados}</span>
                <span class="text-[11px] font-medium" style="color: var(--color-text-secondary);">
                    ${m.pedidos_pendientes} pendientes · ${m.pedidos_en_proceso} en ruta · ${m.pedidos_cancelados} cancelados
                </span>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-border shadow-sm space-y-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-text-secondary font-semibold">Total Transaccionado</span>
                    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">payments</span>
                </div>
                <span class="text-3xl font-black block" style="color: var(--color-primary);">
                    $${Number(m.total_recaudado).toLocaleString('es-CO')}
                </span>
                <span class="text-[11px] text-text-secondary font-medium">100% directo al campo</span>
            </div>
        `;
    } catch (err) {
        // ERROR STATE: mensaje en español sin datos internos (RULES.md: ERR-MASK)
        infoSpan.textContent = 'No disponible';
        grid.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-border">
                <span class="material-symbols-outlined text-[40px] mb-2" style="color: var(--color-error);">cloud_off</span>
                <p class="text-sm font-bold text-on-surface mb-1">No se pudieron cargar las métricas</p>
                <p class="text-xs text-text-secondary mb-4">Hubo un problema de comunicación con el servidor. Intenta de nuevo.</p>
                <button onclick="document.getElementById('btn-refresh-metrics').click()" class="btn-outline text-xs">
                    <span class="material-symbols-outlined text-[16px]">refresh</span>
                    Reintentar
                </button>
            </div>
        `;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS (RF-08 — moderación)
// ─────────────────────────────────────────────────────────────────────────────
async function loadUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    const badge = document.getElementById('users-count-badge');
    if (!tbody) return;

    try {
        const res = await api.getAdminUsers();
        const users = res.usuarios || [];
        badge.textContent = `${users.length} cuenta(s)`;

        // EMPTY STATE
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-10 text-center">
                        <span class="material-symbols-outlined text-[36px] mb-2 block" style="color: var(--color-primary);">group_off</span>
                        <p class="text-sm font-semibold text-on-surface">No hay usuarios registrados</p>
                    </td>
                </tr>
            `;
            return;
        }

        // DATOS STATE
        tbody.innerHTML = users.map(u => {
            const isActive = Number(u.activo) === 1;
            const isSelf = Number(u.id) === Number(store.getUser()?.id);

            let rolBadge = 'bg-blue-100 text-blue-800';
            if (u.rol_nombre === 'ADMIN') rolBadge = 'bg-purple-100 text-purple-800';
            if (u.rol_nombre === 'PRODUCTOR') rolBadge = 'bg-green-100 text-green-800';

            return `
                <tr class="hover:bg-[#FAFAFA] transition-colors">
                    <td class="p-3 font-mono font-bold text-text-secondary">${u.id}</td>
                    <td class="p-3 font-semibold text-on-surface">${u.nombre}</td>
                    <td class="p-3 text-text-secondary">${u.email}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${rolBadge}">
                            ${u.rol_nombre}
                        </span>
                    </td>
                    <td class="p-3 text-text-secondary">${u.municipio || 'N/A'}</td>
                    <td class="p-3">
                        <span class="inline-flex items-center gap-1 font-bold text-xs ${isActive ? 'text-green-700' : 'text-red-600'}">
                            <span class="w-2 h-2 rounded-full ${isActive ? 'bg-green-600' : 'bg-red-500'}"></span>
                            ${isActive ? 'Activo' : 'Desactivado'}
                        </span>
                    </td>
                    <td class="p-3 text-right">
                        ${isSelf ? `
                            <span class="text-[11px] text-text-secondary italic">Sesión Actual</span>
                        ` : `
                            <button class="btn-toggle-user inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors
                                          ${isActive
                                            ? 'border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400'
                                            : 'border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400'}"
                                    data-id="${u.id}" data-activo="${isActive ? 0 : 1}">
                                <span class="material-symbols-outlined text-[14px]">${isActive ? 'block' : 'check_circle'}</span>
                                ${isActive ? 'Desactivar' : 'Reactivar'}
                            </button>
                        `}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-toggle-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nextActivo = Number(btn.getAttribute('data-activo'));
                const actionLabel = nextActivo === 1 ? 'Reactivar' : 'Desactivar';

                const confirmed = await confirmDialog({
                    title: `¿${actionLabel} esta cuenta?`,
                    text: `El usuario #${id} ${nextActivo === 1 ? 'recuperará el acceso a la plataforma.' : 'no podrá iniciar sesión hasta ser reactivado (RF-08).'}`,
                    confirmButtonText: `Sí, ${actionLabel.toLowerCase()}`,
                    confirmButtonColor: nextActivo === 1 ? '#2E7D32' : '#d32f2f'
                });
                if (!confirmed) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Procesando...';
                    await api.toggleUserStatus(id, nextActivo);
                    showToast(`Usuario #${id} ${nextActivo === 1 ? 'reactivado' : 'desactivado'} correctamente.`, 'success');
                    await loadUsers();
                    await loadMetrics(true);
                } catch (err) {
                    // ERR-MASK: no exponer detalles internos
                    showToast('No se pudo actualizar el estado del usuario. Intenta de nuevo.', 'error');
                    btn.disabled = false;
                }
            });
        });

    } catch (err) {
        // ERROR STATE
        badge.textContent = 'Error';
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center">
                    <span class="material-symbols-outlined text-[36px] mb-2 block" style="color: var(--color-error);">error</span>
                    <p class="text-sm font-semibold text-on-surface mb-1">No se pudo cargar la lista de usuarios</p>
                    <p class="text-xs text-text-secondary">Hubo un problema con el servidor. Recarga la página.</p>
                </td>
            </tr>
        `;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICACIONES (RF-08 — moderación)
// ─────────────────────────────────────────────────────────────────────────────
async function loadProducts() {
    const tbody = document.getElementById('admin-products-tbody');
    const badge = document.getElementById('products-count-badge');
    if (!tbody) return;

    try {
        const res = await api.getAdminProducts();
        const prods = res.productos || [];
        badge.textContent = `${prods.length} publicación(es)`;

        // EMPTY STATE
        if (prods.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-10 text-center">
                        <span class="material-symbols-outlined text-[36px] mb-2 block" style="color: var(--color-primary);">inventory_2</span>
                        <p class="text-sm font-semibold text-on-surface">No hay publicaciones en el catálogo</p>
                    </td>
                </tr>
            `;
            return;
        }

        // DATOS STATE
        tbody.innerHTML = prods.map(p => `
            <tr class="hover:bg-[#FAFAFA] transition-colors">
                <td class="p-3 font-mono font-bold text-text-secondary">${p.id}</td>
                <td class="p-3 font-semibold text-on-surface">${p.nombre}</td>
                <td class="p-3 text-text-secondary">${p.productor_nombre}</td>
                <td class="p-3 text-text-secondary">${p.categoria_nombre}</td>
                <td class="p-3 font-bold" style="color: var(--color-primary);">$${Number(p.precio).toLocaleString('es-CO')}</td>
                <td class="p-3">
                    <span class="${p.cantidad_disponible > 0 ? 'text-green-700' : 'text-red-600'} font-semibold">
                        ${p.cantidad_disponible} ${p.unidad_medida}
                    </span>
                </td>
                <td class="p-3 text-right">
                    <button class="btn-mod-delete inline-flex items-center gap-1 text-[11px] font-bold text-red-600
                                   hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200
                                   hover:border-red-400 transition-colors"
                            data-id="${p.id}" data-nombre="${p.nombre}">
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-mod-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nombre = btn.getAttribute('data-nombre') || `publicación #${id}`;

                const confirmed = await confirmDialog({
                    title: `¿Moderar publicación?`,
                    text: `Eliminarás permanentemente "${nombre}" del catálogo. Esta acción no se puede deshacer.`,
                    confirmButtonText: 'Sí, eliminar',
                    confirmButtonColor: '#d32f2f'
                });
                if (!confirmed) return;

                try {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">hourglass_top</span> Eliminando...';
                    await api.deleteAdminProduct(id);
                    showToast(`Publicación "${nombre}" eliminada por moderación.`, 'success');
                    await loadProducts();
                    await loadMetrics(true);
                } catch (err) {
                    // ERR-MASK: no exponer detalles internos
                    showToast('No se pudo eliminar la publicación. Intenta de nuevo.', 'error');
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">delete</span> Eliminar';
                }
            });
        });

    } catch (err) {
        // ERROR STATE
        badge.textContent = 'Error';
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center">
                    <span class="material-symbols-outlined text-[36px] mb-2 block" style="color: var(--color-error);">error</span>
                    <p class="text-sm font-semibold text-on-surface mb-1">No se pudo cargar la lista de publicaciones</p>
                    <p class="text-xs text-text-secondary">Hubo un problema con el servidor. Recarga la página.</p>
                </td>
            </tr>
        `;
    }
}
